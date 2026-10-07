"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  EmptyState,
  ExcelButton,
  inputClass,
  LoadingBlock,
  Modal,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { InfoNote, MiniStat, PageBar } from "@/components/firm/PageBar";
import { api, asPage, fetchAll } from "@/lib/api/client";
import type { Order, User } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone, initials, pageNumbers, relativeTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

const PAGE_SIZE = 20;

type Segment = "all" | "new" | "returning" | "active" | "inactive";

const SEGMENTS: { id: Segment; label: string; icon: string; hint: string }[] = [
  { id: "all", label: "Barcha mijozlar", icon: "groups", hint: "Firmangizga murojaat qilganlar" },
  { id: "new", label: "Yangi", icon: "fiber_new", hint: "So'nggi 30 kunda kelgan" },
  { id: "returning", label: "Doimiy", icon: "autorenew", hint: "2 va undan ko'p buyurtma" },
  { id: "active", label: "Eng faol", icon: "local_fire_department", hint: "Buyurtma soni va summasi" },
  { id: "inactive", label: "Uzoq kelmagan", icon: "bedtime", hint: "90 kundan beri buyurtma yo'q" },
];

const SORTS = [
  { id: "", label: "Segment tartibi" },
  { id: "-orders_count_anno", label: "Buyurtma soni ↓" },
  { id: "-total_spent_anno", label: "Sarflagan summa ↓" },
  { id: "-last_order_at_anno", label: "Oxirgi buyurtma ↓" },
  { id: "-date_joined", label: "Ro'yxatdan o'tgan ↓" },
  { id: "full_name", label: "Ism (A–Z)" },
];

const customerName = (u: User) => u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || "Ism kiritilmagan";
const customerAddress = (u: User) => u.formatted_address || u.home_address || [u.region, u.district].filter(Boolean).join(", ");

function loyaltyTier(u: User) {
  const n = u.orders_count ?? 0;
  if (n >= 5) return { label: "VIP", cls: "border-amber-400/50 bg-amber-400/15 text-amber-300" };
  if (n >= 2) return { label: "Doimiy", cls: "border-primary/40 bg-primary/10 text-primary" };
  if (n === 1) return { label: "1-buyurtma", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" };
  return { label: "Buyurtmasiz", cls: "border-[#26352c] bg-[#0e1210] text-on-surface-variant" };
}

export default function MijozlarPage() {
  const router = useRouter();
  const { query, setQuery } = useSearch();
  const { showError } = useToast();
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState<Segment>("all");
  const [ordering, setOrdering] = useState("");
  const [detail, setDetail] = useState<User | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(
    () => ({
      segment: segment === "all" ? undefined : segment,
      search: query || undefined,
      ordering: ordering || undefined,
    }),
    [segment, query, ordering],
  );

  const { data, loading, error, updatedAt } = useAsync(
    async () => asPage<User>(await api("/admin/customers/", { query: { ...params, page, page_size: PAGE_SIZE } })),
    [page, params],
    { keepPrevious: true },
  );

  const { data: counts } = useAsync(
    () => api<Record<Segment, number>>("/admin/customers/segments/", { query: { search: query || undefined } }),
    [query],
    { keepPrevious: true },
  );

  const { data: history, loading: historyLoading } = useAsync(
    async () => {
      if (!detail) return [];
      return asPage<Order>(
        await api("/admin/orders/", { query: { customer: detail.id, page_size: 50, ordering: "-created_at" } }),
      ).results;
    },
    [detail?.id],
  );

  async function openChat(u: User) {
    try {
      const room = await api<{ id: number }>("/admin/chats/open/", { method: "POST", body: { customer_id: u.id } });
      router.push(`/aloqa?room=${room.id}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Suhbat ochilmadi");
    }
  }

  async function exportTable() {
    setExporting(true);
    try {
      const list = await fetchAll<User>("/admin/customers/", params);
      downloadExcel(`mijozlar-${segment}`, {
        name: SEGMENTS.find((s) => s.id === segment)?.label ?? "Mijozlar",
        headers: [
          "ID",
          "F.I.Sh",
          "Telefon",
          "Manzil",
          "Buyurtmalar",
          "Sarflagan (UZS)",
          "Birinchi buyurtma",
          "Oxirgi buyurtma",
          "Ro'yxatdan o'tgan",
          "Holat",
        ],
        rows: list.map((u) => [
          u.id,
          customerName(u),
          formatPhone(u.phone),
          customerAddress(u),
          u.orders_count ?? 0,
          Math.round(Number(u.total_spent ?? 0)),
          u.first_order_at ? formatDate(u.first_order_at) : "",
          u.last_order_at ? formatDate(u.last_order_at) : "",
          formatDate(u.date_joined),
          u.is_active ? "Faol" : "Bloklangan",
        ]),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Eksport bo'lmadi");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const currentSeg = SEGMENTS.find((s) => s.id === segment) ?? SEGMENTS[0];
  const rows = data?.results ?? [];

  const historyStats = useMemo(() => {
    const list = history ?? [];
    const completed = list.filter((o) => o.status === "completed");
    const revenue = completed.reduce((s, o) => s + Number(o.quoted_price || 0), 0);
    return {
      total: list.length,
      completed: completed.length,
      cancelled: list.filter((o) => o.status === "cancelled").length,
      active: list.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
      avg: completed.length ? revenue / completed.length : 0,
    };
  }, [history]);

  function changeSegment(id: Segment) {
    setSegment(id);
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <PageBar
        updatedAt={updatedAt}
        description="Firmangiz mijozlar bazasi: yangi va doimiy mijozlar, eng faollar va uzoq kelmaganlar. Mijoz kartasida buyurtmalar tarixi va suhbat tugmasi bor."
        actions={<ExcelButton onClick={() => void exportTable()} disabled={exporting || !data?.count} label={exporting ? "Tayyorlanmoqda..." : "Excel"} />}
      />

      <InfoNote icon="smartphone" tone="info">
        <b>Mijozlar faqat E-MAKON ilovasi orqali qo&apos;shiladi.</b> Mijoz ilovada ro&apos;yxatdan o&apos;tib, firmangiz xizmatiga
        buyurtma bergach shu ro&apos;yxatda avtomatik paydo bo&apos;ladi. Firma mijozni qo&apos;lda qo&apos;sha olmaydi.
      </InfoNote>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {SEGMENTS.map((s) => (
          <MiniStat
            key={s.id}
            label={s.label}
            value={counts?.[s.id] ?? "—"}
            icon={s.icon}
            hint={s.hint}
            tone={segment === s.id ? "primary" : "default"}
            active={segment === s.id}
            onClick={() => changeSegment(s.id)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            className={`${inputClass} pl-10`}
            placeholder="Ism yoki telefon bo'yicha qidirish"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-on-surface-variant">
            <b className="text-on-surface">{currentSeg.label}</b> · {data?.count ?? 0} ta
          </p>
          <div className="w-full sm:w-56">
            <select
              className={inputClass}
              value={ordering}
              aria-label="Saralash"
              onChange={(e) => {
                setOrdering(e.target.value);
                setPage(1);
              }}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 shadow-lg">
        {loading ? (
          <LoadingBlock />
        ) : error && !data ? (
          <p className="p-6 text-sm text-error">{error}</p>
        ) : !rows.length ? (
          <EmptyState
            icon="group"
            title="Mijozlar topilmadi"
            description={
              query
                ? "Qidiruv bo'yicha mijoz topilmadi."
                : "Bu segmentda hozircha mijoz yo'q. Mijozlar E-MAKON ilovasidan buyurtma berganda paydo bo'ladi."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-[#263b2a]/50 md:hidden">
              {rows.map((u, idx) => (
                <li key={u.id}>
                  <button type="button" onClick={() => setDetail(u)} className="flex w-full items-start gap-3 p-4 text-left">
                    <CustomerAvatar user={u} rank={segment === "active" && page === 1 ? idx + 1 : null} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-base font-semibold text-on-surface">{customerName(u)}</p>
                        <span className="shrink-0 text-sm font-semibold">{formatMoney(u.total_spent ?? 0)}</span>
                      </div>
                      <p className="text-sm text-on-surface-variant">{formatPhone(u.phone)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <TierPill user={u} />
                        <span className="text-on-surface-variant">{u.orders_count ?? 0} ta buyurtma</span>
                        {u.last_order_at ? <span className="text-on-surface-variant">· {relativeTime(u.last_order_at)}</span> : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#263b2a] text-xs uppercase tracking-wide text-on-surface-variant">
                    {["Mijoz", "Telefon", "Buyurtmalar", "Sarflagan", "Oxirgi buyurtma", ""].map((h) => (
                      <th key={h} className="whitespace-nowrap px-5 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263b2a]/40">
                  {rows.map((u, idx) => (
                    <tr key={u.id} className="cursor-pointer transition hover:bg-white/5" onClick={() => setDetail(u)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar user={u} rank={segment === "active" && page === 1 ? idx + 1 : null} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold text-on-surface">
                              <span className="truncate">{customerName(u)}</span>
                              {!u.is_active ? <StatusPill variant="error">Bloklangan</StatusPill> : null}
                            </p>
                            <p className="max-w-[260px] truncate text-xs text-on-surface-variant">{customerAddress(u) || "Manzil kiritilmagan"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-on-surface-variant">{formatPhone(u.phone)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{u.orders_count ?? 0}</span>
                          <TierPill user={u} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-semibold">{formatMoney(u.total_spent ?? 0)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-on-surface-variant">
                        {u.last_order_at ? (
                          <>
                            <p>{formatDate(u.last_order_at)}</p>
                            <p className="text-xs">{relativeTime(u.last_order_at)}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openChat(u);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                          Yozish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              current={page}
              pages={pageNumbers(page, totalPages)}
              onPageChange={setPage}
              info={
                <>
                  Jami <strong className="text-primary">{data?.count ?? 0}</strong> ta mijoz · {page}/{totalPages} sahifa
                </>
              }
            />
          </>
        )}
      </div>

      <Modal
        open={!!detail}
        size="lg"
        title={detail ? customerName(detail) : "Mijoz kartasi"}
        description={detail ? `${formatPhone(detail.phone)} · ilovada ${formatDate(detail.date_joined)} dan beri` : undefined}
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <>
              <SecondaryButton onClick={() => setDetail(null)}>Yopish</SecondaryButton>
              <a
                href={`tel:${detail.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#26352c] bg-[#151c18] px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-[#1f2922]"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                Qo&apos;ng&apos;iroq
              </a>
              <PrimaryButton icon="chat" onClick={() => void openChat(detail)}>
                Suhbat ochish
              </PrimaryButton>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-container to-[#1b2a1e] text-lg font-bold text-white">
                {initials(customerName(detail))}
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TierPill user={detail} />
                  <StatusPill variant={detail.is_active ? "success" : "error"}>{detail.is_active ? "Faol" : "Bloklangan"}</StatusPill>
                </div>
                <p className="break-words text-on-surface-variant">{customerAddress(detail) || "Manzil kiritilmagan"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Buyurtmalar", `${detail.orders_count ?? 0} ta`],
                ["Sarflagan", formatMoney(detail.total_spent ?? 0)],
                ["Birinchi buyurtma", formatDate(detail.first_order_at)],
                ["Oxirgi buyurtma", formatDate(detail.last_order_at)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl border border-[#26352c] bg-[#0e1210] p-3">
                  <p className="text-xs text-on-surface-variant">{label}</p>
                  <p className="truncate text-base font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Firmangizdagi buyurtmalari</h3>
                {history?.length ? (
                  <p className="text-xs text-on-surface-variant">
                    {historyStats.completed} bajarilgan · {historyStats.active} jarayonda · {historyStats.cancelled} bekor
                    {historyStats.avg ? ` · o'rtacha chek ${formatMoney(historyStats.avg)}` : ""}
                  </p>
                ) : null}
              </div>
              {historyLoading ? (
                <LoadingBlock />
              ) : history?.length ? (
                <ol className="relative max-h-80 space-y-3 overflow-y-auto border-l border-[#26352c] pl-4 pr-1">
                  {history.map((o) => (
                    <li key={o.id} className="relative">
                      <span
                        className={`absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-[#151917] ${
                          o.status === "completed" ? "bg-primary" : o.status === "cancelled" ? "bg-error" : "bg-amber-400"
                        }`}
                      />
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            #{o.id} · {o.service_name}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {formatDateTime(o.created_at)}
                            {o.assigned_worker_name ? ` · ${o.assigned_worker_name}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusPill variant={ORDER_STATUS_TONE[o.status]}>{o.work_stage_label || ORDER_STATUS_LABEL[o.status]}</StatusPill>
                          <p className="mt-1 text-xs font-semibold">{formatMoney(o.quoted_price)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-on-surface-variant">Firmangizga hali buyurtma bermagan.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function CustomerAvatar({ user, rank }: { user: User; rank: number | null }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${
          user.is_active ? "border-primary-container/50 bg-[#1b382b] text-primary" : "border-error/40 bg-[#381617] text-error"
        }`}
      >
        {initials(customerName(user))}
      </span>
      {rank && rank <= 3 ? (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-black">
          {rank}
        </span>
      ) : null}
    </span>
  );
}

function TierPill({ user }: { user: User }) {
  const tier = loyaltyTier(user);
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tier.cls}`}>{tier.label}</span>;
}
