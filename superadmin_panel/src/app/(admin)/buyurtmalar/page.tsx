"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  ExcelButton,
  inputClass,
  LiveBadge,
  LoadingBlock,
  Pagination,
  ScheduleBoard,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { fetchAll, todayStamp } from "@/components/catalog/fetchAll";
import { fakeEntry, fakeReason, isFakeOrder } from "@/components/orders/fake";
import { OrderDetailModal, PAYMENT_LABEL, PAYMENT_TONE } from "@/components/orders/OrderDetailModal";
import { api, asPage } from "@/lib/api/client";
import type { Order, OrderStatus, PartnerFirm, PaymentStatus, Service, User } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatDateTime, formatMoney, formatPhone, initials, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type TabId = "all" | "payment" | "active" | "completed" | "cancelled" | "fake";
type Period = "all" | "today" | "7" | "30";

const TABS: { id: TabId; label: string; icon: string; match: (o: Order) => boolean }[] = [
  { id: "all", label: "Barchasi", icon: "receipt_long", match: () => true },
  { id: "payment", label: "To'lov tekshiruvi", icon: "price_check", match: (o) => (["checking"] as PaymentStatus[]).includes(o.payment_status) },
  { id: "active", label: "Faol", icon: "autorenew", match: (o) => (["new", "in_review", "contacted"] as OrderStatus[]).includes(o.status) },
  { id: "completed", label: "Tugallangan", icon: "task_alt", match: (o) => o.status === "completed" },
  { id: "cancelled", label: "Bekor qilingan", icon: "cancel", match: (o) => o.status === "cancelled" },
  { id: "fake", label: "Soxta zayavkalar", icon: "report", match: isFakeOrder },
];

const PERIODS: { id: Period; label: string; days?: number }[] = [
  { id: "all", label: "Barcha vaqt" },
  { id: "today", label: "Bugun" },
  { id: "7", label: "Oxirgi 7 kun", days: 7 },
  { id: "30", label: "Oxirgi 30 kun", days: 30 },
];

const PAGE_SIZE = 25;

const catalogIdOf = (o: Order) => o.service?.base_service ?? o.service_id;

function scheduleLabel(o: Order) {
  if (!o.scheduled_date) return "";
  const t = o.scheduled_start ? `${o.scheduled_start}${o.scheduled_end ? `–${o.scheduled_end}` : ""}` : o.time_slot || "";
  return `${formatDate(o.scheduled_date)}${t ? ` · ${t}` : ""}`;
}

type BlockTarget = { customerId: number; name: string; phone: string; orderId: number; unblock: boolean };

export default function BuyurtmalarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<TabId>("all");
  const [firmFilter, setFirmFilter] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fresh, setFresh] = useState<{ order: Order; at: number } | null>(null);
  const [scheduleFirm, setScheduleFirm] = useState<number | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);

  const { data, loading, error, reload, updatedAt, refreshing } = useAsync(
    () =>
      fetchAll<Order>(
        "/admin/orders/",
        { organization: firmFilter || undefined, search: query || undefined, ordering: "-created_at" },
        5,
      ),
    [firmFilter, query],
    { keepPrevious: true, live: 10000 },
  );

  const { data: firms } = useAsync(
    async () => asPage<PartnerFirm>(await api("/admin/firms/", { query: { page_size: 100 } })).results,
    [],
    { live: false },
  );

  const { data: catalog } = useAsync(
    async () =>
      (await fetchAll<Service>("/admin/services/", { roots: 1 }, 3)).results
        .filter((s) => s.is_catalog_type)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
    { live: false },
  );

  const { data: blockedIds, reload: reloadBlocked } = useAsync(
    async () => {
      try {
        const res = await fetchAll<User>("/admin/customers/", { is_active: "false" }, 3);
        return res.results.map((u) => u.id);
      } catch {
        return [] as number[];
      }
    },
    [],
    { keepPrevious: true, live: 30000 },
  );
  const blocked = useMemo(() => new Set(blockedIds ?? []), [blockedIds]);
  const catalogName = useMemo(() => new Map((catalog ?? []).map((c) => [c.id, c.name])), [catalog]);

  const all = useMemo(() => data?.results ?? [], [data]);
  const now = updatedAt;

  const base = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const days = PERIODS.find((p) => p.id === period)?.days;
    const todayKey = now ? new Date(now).toDateString() : "";
    return all.filter((o) => {
      if (catalogFilter && String(catalogIdOf(o)) !== catalogFilter) return false;
      if (period === "today" && new Date(o.created_at).toDateString() !== todayKey) return false;
      if (days && now - new Date(o.created_at).getTime() > days * 86400000) return false;
      if (needle) {
        const hay = `#${o.id} ${o.id} ${o.customer_name} ${o.customer_phone} ${o.phone_number} ${o.firm_name} ${o.service_name} ${o.address}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, catalogFilter, period, search, now]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, base.filter(t.match).length])) as Record<TabId, number>, [base]);
  const list = useMemo(() => base.filter(TABS.find((t) => t.id === tab)!.match), [base, tab]);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const todayKey = now ? new Date(now).toDateString() : "";
  const today = all.filter((o) => new Date(o.created_at).toDateString() === todayKey);
  const activeCount = all.filter((o) => ["new", "in_review", "contacted"].includes(o.status)).length;
  const todayRevenue = today.filter((o) => o.quoted_price).reduce((sum, o) => sum + Number(o.quoted_price), 0);
  const fakeTotal = all.filter(isFakeOrder).length;

  const boardFirm = scheduleFirm ?? (firmFilter ? Number(firmFilter) : null) ?? firms?.[0]?.id ?? null;
  const filtersActive = Boolean(firmFilter || catalogFilter || period !== "all" || search);

  const listItem = selectedId === null ? null : all.find((o) => o.id === selectedId) ?? null;
  const selected =
    selectedId === null
      ? null
      : fresh && fresh.order.id === selectedId && (!listItem || fresh.at >= updatedAt)
        ? fresh.order
        : listItem ?? (fresh?.order.id === selectedId ? fresh.order : null);

  function changeFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function clearFilters() {
    setFirmFilter("");
    setCatalogFilter("");
    setPeriod("all");
    setSearch("");
    setPage(1);
  }

  async function openById(id: number) {
    if (all.some((o) => o.id === id)) {
      setSelectedId(id);
      return;
    }
    try {
      const order = await api<Order>(`/admin/orders/${id}/`);
      setFresh({ order, at: Date.now() });
      setSelectedId(id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Buyurtma topilmadi");
    }
  }

  function askBlock(o: Order, unblock: boolean) {
    if (!o.customer_id) {
      showError("Mijoz aniqlanmadi");
      return;
    }
    setBlockTarget({
      customerId: o.customer_id,
      name: o.customer_name || "Mijoz",
      phone: o.customer_phone || o.phone_number,
      orderId: o.id,
      unblock,
    });
  }

  async function confirmBlock() {
    if (!blockTarget) return;
    setBlockBusy(true);
    try {
      await api(`/admin/customers/${blockTarget.customerId}/${blockTarget.unblock ? "unblock" : "block"}/`, { method: "POST" });
      showSuccess(
        blockTarget.unblock
          ? `${blockTarget.name} blokdan chiqarildi`
          : `${blockTarget.name} bloklandi — endi ilovaga kira olmaydi va buyurtma bera olmaydi`,
      );
      setBlockTarget(null);
      await reloadBlocked();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Bajarilmadi");
    } finally {
      setBlockBusy(false);
    }
  }

  function exportExcel() {
    downloadExcel(`buyurtmalar-${todayStamp()}`, {
      name: TABS.find((t) => t.id === tab)?.label ?? "Buyurtmalar",
      headers: [
        "ID",
        "Mijoz",
        "Telefon",
        "Firma",
        "Xizmat",
        "Katalog turi",
        "Holat",
        "Ish bosqichi",
        "To'lov",
        "Reja (sana · vaqt)",
        "Narx (UZS)",
        "Platforma ulushi",
        "Manzil",
        "Yaratilgan",
        "Soxta",
        "Soxta sababi",
        "Mijoz bloklangan",
      ],
      rows: list.map((o) => [
        o.id,
        o.customer_name || "",
        o.phone_number || o.customer_phone || "",
        o.firm_name || "",
        o.service_name || "",
        catalogName.get(catalogIdOf(o)) ?? o.service?.base_service_name ?? "",
        ORDER_STATUS_LABEL[o.status] ?? o.status,
        o.work_stage_label || "",
        PAYMENT_LABEL[o.payment_status] ?? o.payment_status,
        scheduleLabel(o),
        o.quoted_price ? Number(o.quoted_price) : "",
        o.platform_share ? Number(o.platform_share) : "",
        o.address || "",
        formatDateTime(o.created_at),
        isFakeOrder(o) ? "Ha" : "",
        isFakeOrder(o) ? fakeReason(o) : "",
        blocked.has(o.customer_id) ? "Ha" : "",
      ]),
    });
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-5 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge updatedAt={updatedAt} />
          {refreshing ? <span className="text-xs text-on-surface-variant">Yangilanmoqda...</span> : null}
          {data?.truncated ? (
            <span className="text-xs text-amber-200">
              Oxirgi {data.results.length} ta (jami {data.count}) buyurtma yuklandi — firma yoki qidiruv bilan toraytiring
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelButton onClick={exportExcel} disabled={!list.length} label={`Excel (${list.length})`} />
          <SecondaryButton icon="refresh" onClick={() => void reload()}>
            Yangilash
          </SecondaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Bugungi buyurtmalar", value: String(today.length), suffix: "ta", icon: "shopping_bag", tone: "text-primary" },
          { label: "Jarayondagi", value: String(activeCount), suffix: "faol", icon: "autorenew", tone: "text-primary" },
          { label: "Bugungi kelishilgan narx", value: formatMoney(todayRevenue), suffix: "", icon: "payments", tone: "text-primary" },
          { label: "Soxta zayavkalar", value: String(fakeTotal), suffix: "ta", icon: "report", tone: "text-error", tab: "fake" as TabId },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            disabled={!card.tab}
            onClick={() => card.tab && changeFilter(setTab)(card.tab)}
            className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#131b15]/90 p-4 text-left shadow-lg sm:p-5 ${
              card.tab ? (fakeTotal ? "border-error/40 hover:bg-error/5" : "border-[#263b2a] hover:bg-white/5") : "cursor-default border-[#263b2a]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-on-surface-variant sm:text-sm">{card.label}</p>
              <span className={`material-symbols-outlined ${card.tone}`}>{card.icon}</span>
            </div>
            <p className="mt-3 text-xl font-bold sm:text-2xl">
              {card.value}
              {card.suffix ? <span className="ml-1 text-sm font-normal text-on-surface-variant">{card.suffix}</span> : null}
            </p>
          </button>
        ))}
      </div>

      <TabBar<TabId>
        value={tab}
        onChange={changeFilter(setTab)}
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon, count: counts[t.id] }))}
      />

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            className={`${inputClass} pl-10`}
            value={search}
            onChange={(e) => changeFilter(setSearch)(e.target.value)}
            placeholder="#ID, mijoz, telefon, manzil..."
          />
        </div>
        <select className={inputClass} value={firmFilter} onChange={(e) => changeFilter(setFirmFilter)(e.target.value)} aria-label="Firma">
          <option value="">Barcha firmalar</option>
          {(firms ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={catalogFilter} onChange={(e) => changeFilter(setCatalogFilter)(e.target.value)} aria-label="Katalog turi">
          <option value="">Barcha katalog turlari</option>
          {(catalog ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={period} onChange={(e) => changeFilter(setPeriod)(e.target.value as Period)} aria-label="Davr">
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <SecondaryButton icon="filter_alt_off" disabled={!filtersActive} onClick={clearFilters} className="justify-center">
          Tozalash
        </SecondaryButton>
      </div>

      {tab === "fake" ? (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-on-surface">
          <span className="font-semibold text-error">Soxta zayavkalar</span> — firma bekor qilib, izohni &quot;SOXTA&quot; bilan boshlagan
          buyurtmalar. Mijoz qayta-qayta soxta buyurtma bersa, uni bloklang: bloklangan mijoz ilovaga kira olmaydi.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 shadow-lg">
        {loading && !data ? (
          <LoadingBlock />
        ) : error && !data ? (
          <div className="p-6 text-center">
            <p className="mb-3 text-error">{error}</p>
            <SecondaryButton icon="refresh" onClick={() => void reload()}>
              Qayta urinish
            </SecondaryButton>
          </div>
        ) : !list.length ? (
          <EmptyState
            icon={tab === "fake" ? "verified_user" : "receipt_long"}
            title={tab === "fake" ? "Soxta zayavkalar yo'q" : "Buyurtmalar topilmadi"}
            description={filtersActive ? "Filtrlarni o'zgartirib ko'ring." : undefined}
            action={filtersActive ? <SecondaryButton onClick={clearFilters}>Filtrni tozalash</SecondaryButton> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#263b2a] text-xs uppercase text-on-surface-variant">
                    {["#", "Mijoz", "Firma", "Xizmat", "Reja", "Narx", "To'lov", "Holat", ""].map((h, i) => (
                      <th key={`${h}-${i}`} className="px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263b2a]/40">
                  {pageRows.map((o) => {
                    const fake = fakeEntry(o);
                    const isBlocked = blocked.has(o.customer_id);
                    const typeName = catalogName.get(catalogIdOf(o));
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedId(o.id)}
                        className={`cursor-pointer transition hover:bg-white/5 ${fake ? "bg-error/[0.06] shadow-[inset_3px_0_0_0_rgba(255,107,107,0.8)]" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container/30 text-xs font-bold text-primary">
                              {initials(o.customer_name || o.customer_phone || "?")}
                            </div>
                            <div>
                              <div className="font-semibold text-primary">#{o.id}</div>
                              <div className="whitespace-nowrap text-xs text-on-surface-variant">{formatDateTime(o.created_at)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{o.customer_name || "—"}</div>
                          <div className="whitespace-nowrap text-xs text-on-surface-variant">{formatPhone(o.phone_number || o.customer_phone || "")}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {fake ? (
                              <span
                                title={fakeReason(o) || "Soxta zayavka"}
                                className="rounded-full border border-error/50 bg-error/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error"
                              >
                                Soxta
                              </span>
                            ) : null}
                            {isBlocked ? (
                              <span className="rounded-full border border-error/30 px-2 py-0.5 text-[10px] font-semibold text-error">Bloklangan</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {o.firm_id ? (
                            <Link href={`/firmalar/${o.firm_id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                              {o.firm_name || "Firma"}
                            </Link>
                          ) : (
                            <span className="text-on-surface-variant">Tayinlanmagan</span>
                          )}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="truncate font-medium">{o.service_name}</div>
                          {typeName && typeName !== o.service_name ? (
                            <div className="truncate text-xs text-on-surface-variant">{typeName}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">{scheduleLabel(o) || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {formatMoney(o.quoted_price, o.currency)}
                          {o.platform_share ? <div className="text-xs font-normal text-primary">{formatMoney(o.platform_share)}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <StatusPill variant={PAYMENT_TONE[o.payment_status] ?? "neutral"}>
                            {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
                            {o.payment && o.payment_status !== "not_required" ? ` · ${o.payment.provider_label}` : ""}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill variant={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</StatusPill>
                          {o.work_stage_label ? (
                            <p className="mt-1 whitespace-nowrap text-[11px] text-on-surface-variant">
                              {o.work_stage_label}
                              {o.eta_minutes && o.work_stage === "on_the_way" ? ` · ~${o.eta_minutes} daq` : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fake ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                askBlock(o, isBlocked);
                              }}
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                isBlocked
                                  ? "border-[#26352c] text-on-surface-variant hover:text-on-surface"
                                  : "border-error/50 bg-error/10 text-error hover:bg-error/20"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">{isBlocked ? "lock_open" : "block"}</span>
                              {isBlocked ? "Blokdan chiqarish" : "Mijozni bloklash"}
                            </button>
                          ) : (
                            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              info={`${list.length} ta buyurtmadan ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, list.length)}`}
              pages={pageNumbers(current, totalPages)}
              current={current}
              onPageChange={(p) => setPage(Math.min(Math.max(1, p), totalPages))}
            />
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-on-surface-variant">Firma bandligi:</span>
          <select
            className={`${inputClass} sm:w-80`}
            value={boardFirm ?? ""}
            onChange={(e) => setScheduleFirm(e.target.value ? Number(e.target.value) : null)}
          >
            {!firms?.length ? <option value="">Firmalar yo&apos;q</option> : null}
            {(firms ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <ScheduleBoard organizationId={boardFirm} onOpenOrder={(id) => void openById(id)} />
      </div>

      {selected ? (
        <OrderDetailModal
          key={selected.id}
          order={selected}
          catalogName={catalogName.get(catalogIdOf(selected))}
          customerBlocked={blocked.has(selected.customer_id)}
          onClose={() => setSelectedId(null)}
          onUpdated={(order) => {
            setFresh({ order, at: Date.now() });
            void reload();
          }}
          onBlock={() => askBlock(selected, false)}
          onUnblock={() => askBlock(selected, true)}
        />
      ) : null}

      <ConfirmDialog
        open={!!blockTarget}
        variant={blockTarget?.unblock ? "primary" : "danger"}
        busy={blockBusy}
        title={blockTarget?.unblock ? "Mijozni blokdan chiqarish" : "Mijozni bloklash"}
        confirmText={blockTarget?.unblock ? "Blokdan chiqarish" : "Bloklash"}
        description={
          blockTarget ? (
            blockTarget.unblock ? (
              <>
                <b className="text-on-surface">{blockTarget.name}</b> ({formatPhone(blockTarget.phone || "")}) yana ilovaga kira oladi va buyurtma
                bera oladi.
              </>
            ) : (
              <>
                <b className="text-on-surface">{blockTarget.name}</b> ({formatPhone(blockTarget.phone || "")}) #{blockTarget.orderId} buyurtma
                bo&apos;yicha soxta zayavka uchun bloklanadi. Hisob o&apos;chiriladi: ilovaga kira olmaydi va yangi buyurtma bera olmaydi. Kerak
                bo&apos;lsa keyin blokdan chiqarish mumkin.
              </>
            )
          ) : (
            ""
          )
        }
        onCancel={() => setBlockTarget(null)}
        onConfirm={() => void confirmBlock()}
      />
    </div>
  );
}
