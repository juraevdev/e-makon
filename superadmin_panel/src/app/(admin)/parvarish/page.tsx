"use client";

import { useMemo, useState } from "react";
import {
  EmptyState,
  ExcelButton,
  LiveBadge,
  LoadingBlock,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatCard,
  StatusPill,
  TabBar,
  inputClass,
} from "@/components/ui";
import { CareActionDialog } from "@/components/care/CareActionDialog";
import { CareContractDetail } from "@/components/care/CareContractDetail";
import {
  ACTIONS_BY_STATUS,
  CARE_ACTIONS,
  contractSearchText,
  nextVisit,
  overdueVisits,
  PAYMENT_LABEL,
  STATUS_TABS,
  type CareAction,
} from "@/components/care/careMeta";
import { fetchAllPages } from "@/components/care/fetchAllPages";
import type { VisitPatch } from "@/components/care/VisitTimeline";
import { api } from "@/lib/api/client";
import type { CareClientType, CareContract, CareStatus, CareSummary, CareVisit } from "@/lib/api/types";
import {
  CARE_CLIENT_TYPE_LABEL,
  CARE_FREQUENCY_LABEL,
  CARE_STATUS_LABEL,
  CARE_STATUS_TONE,
  CARE_VISIT_STATUS_LABEL,
  WEEKDAY_SHORT,
} from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type Tab = "all" | CareStatus;
type Sort = "newest" | "next_visit" | "amount" | "end_date";

const ACTION_DONE: Record<CareAction, string> = {
  approve: "Shartnoma tasdiqlandi, tashriflar rejalashtirildi",
  reject: "Shartnoma rad etildi, firma xabardor qilindi",
  submit: "Shartnoma qayta tasdiqqa olindi",
  pause: "Shartnoma to'xtatildi",
  resume: "Shartnoma davom ettirildi",
  complete: "Shartnoma yakunlandi",
  cancel: "Shartnoma bekor qilindi",
};

function errText(err: unknown) {
  return err instanceof Error ? err.message : "Xatolik yuz berdi";
}

export default function ParvarishPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [clientType, setClientType] = useState<"" | CareClientType>("");
  const [firm, setFirm] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [action, setAction] = useState<CareAction | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload, setData, updatedAt } = useAsync(
    () => fetchAllPages<CareContract>("/admin/care-contracts/", { ordering: "-created_at" }),
    [],
    { keepPrevious: true },
  );
  const { data: summary } = useAsync(() => api<CareSummary>("/admin/care-contracts/summary/"), []);

  const all = useMemo(() => data?.results ?? [], [data]);
  const term = (search || query).trim().toLowerCase();

  const firms = useMemo(
    () => [...new Set(all.map((c) => c.firm_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [all],
  );

  const scoped = useMemo(
    () =>
      all.filter(
        (c) =>
          (!clientType || c.client_type === clientType) &&
          (!firm || c.firm_name === firm) &&
          (!term || contractSearchText(c).includes(term)),
      ),
    [all, clientType, firm, term],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: scoped.length };
    for (const c of scoped) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, [scoped]);

  const rows = useMemo(() => {
    const list = tab === "all" ? [...scoped] : scoped.filter((c) => c.status === tab);
    const nextKey = (c: CareContract) => nextVisit(c)?.visit_date ?? "9999-12-31";
    if (sort === "next_visit") list.sort((a, b) => nextKey(a).localeCompare(nextKey(b)));
    else if (sort === "amount") list.sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
    else if (sort === "end_date") list.sort((a, b) => a.end_date.localeCompare(b.end_date));
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [scoped, tab, sort]);

  const activeValue = useMemo(
    () => all.filter((c) => c.status === "active").reduce((sum, c) => sum + Number(c.total_amount || 0), 0),
    [all],
  );

  const inList = all.find((c) => c.id === selectedId) ?? null;
  const { data: fetched } = useAsync(
    async () => (selectedId && !inList ? api<CareContract>(`/admin/care-contracts/${selectedId}/`) : null),
    [selectedId, Boolean(inList)],
  );
  const selected = inList ?? (fetched?.id === selectedId ? fetched : null);

  function applyFresh(fresh: CareContract) {
    setData((prev) =>
      prev ? { ...prev, results: prev.results.map((c) => (c.id === fresh.id ? fresh : c)) } : prev,
    );
  }

  async function runAction(act: CareAction, note: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${selected.id}/${act}/`, {
        method: "POST",
        body: { note },
      });
      applyFresh(fresh);
      setAction(null);
      showSuccess(ACTION_DONE[act]);
    } catch (err) {
      showError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendComment(text: string) {
    if (!selected) return false;
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${selected.id}/comment/`, {
        method: "POST",
        body: { note: text },
      });
      applyFresh(fresh);
      showSuccess("Izoh firmaga yuborildi");
      return true;
    } catch (err) {
      showError(errText(err));
      return false;
    }
  }

  async function updateVisit(visit: CareVisit, patch: VisitPatch) {
    if (!selected) return false;
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${selected.id}/visits/${visit.id}/`, {
        method: "POST",
        body: patch,
      });
      applyFresh(fresh);
      showSuccess(patch.status ? `Tashrif: ${CARE_VISIT_STATUS_LABEL[patch.status]}` : "Tashrif yangilandi");
      return true;
    } catch (err) {
      showError(errText(err));
      return false;
    }
  }

  function openAction(c: CareContract, act: CareAction) {
    setSelectedId(c.id);
    setAction(act);
  }

  function exportExcel() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`parvarish-shartnomalari-${stamp}`, [
      {
        name: "Shartnomalar",
        headers: [
          "ID",
          "Nomi",
          "Firma",
          "Mijoz",
          "Mijoz turi",
          "Telefon",
          "Manzil",
          "Xizmat",
          "Chastota",
          "Hafta kunlari",
          "Boshlanish",
          "Tugash",
          "Keyingi tashrif",
          "Tashrif narxi",
          "Jami summa",
          "Valyuta",
          "To'lov tartibi",
          "Bajarilgan",
          "Rejadagi",
          "Holat",
          "Yaratilgan",
        ],
        rows: rows.map((c) => [
          c.id,
          c.title,
          c.firm_name,
          c.customer_name,
          CARE_CLIENT_TYPE_LABEL[c.client_type],
          c.customer_phone,
          c.address,
          c.service_name,
          CARE_FREQUENCY_LABEL[c.frequency],
          (c.preferred_weekdays ?? []).map((d) => WEEKDAY_SHORT[d]).join(", "),
          c.start_date,
          c.end_date,
          nextVisit(c)?.visit_date ?? "",
          Number(c.price_per_visit),
          Number(c.total_amount),
          c.currency,
          PAYMENT_LABEL[c.payment_terms] ?? c.payment_terms,
          c.visits_done,
          c.planned_visits,
          CARE_STATUS_LABEL[c.status],
          c.created_at.slice(0, 10),
        ]),
      },
      {
        name: "Tashriflar",
        headers: ["Shartnoma", "Firma", "Mijoz", "Sana", "Holat", "Xodim", "Hisobot"],
        rows: rows.flatMap((c) =>
          c.visits.map((v) => [
            c.id,
            c.firm_name,
            c.customer_name,
            v.visit_date,
            CARE_VISIT_STATUS_LABEL[v.status] ?? v.status,
            v.assigned_worker_name,
            v.report_notes,
          ]),
        ),
      },
    ]);
  }

  const pending = summary?.pending ?? counts.pending ?? 0;
  const filtersOn = Boolean(term || clientType || firm);

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="max-w-3xl text-sm text-on-surface-variant md:text-base">
            Firmalar uy xo&apos;jaliklari va tashkilotlar bilan tuzgan uzoq muddatli parvarish shartnomalari. Tasdiqlang,
            tashriflar ijrosini kuzating va firmaga izoh qoldiring.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <LiveBadge updatedAt={updatedAt} />
          <SecondaryButton icon="refresh" onClick={() => void reload()}>
            Yangilash
          </SecondaryButton>
          <ExcelButton onClick={exportExcel} disabled={!rows.length} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Jami shartnomalar"
          value={String(summary?.total ?? all.length)}
          icon="handshake"
          hint={summary ? `${summary.households} uy · ${summary.organizations} tashkilot` : undefined}
        />
        <StatCard label="Tasdiq kutmoqda" value={String(pending)} icon="hourglass_top" hint="Sizning qaroringiz kerak" />
        <StatCard label="Faol" value={String(summary?.active ?? counts.active ?? 0)} icon="verified" />
        <StatCard label="Bugungi tashriflar" value={String(summary?.visits_today ?? 0)} icon="today" />
        <StatCard label="7 kunlik tashriflar" value={String(summary?.visits_week ?? 0)} icon="date_range" />
        <StatCard label="Faol shartnomalar qiymati" value={formatMoney(activeValue, "").trim()} suffix="so'm" icon="payments" />
      </div>

      {pending > 0 && tab !== "pending" ? (
        <button
          type="button"
          onClick={() => setTab("pending")}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200 transition hover:bg-amber-500/15"
        >
          <span className="material-symbols-outlined animate-pulse text-amber-300">notification_important</span>
          <span className="flex-1">
            <b>{pending} ta shartnoma</b> tasdiqingizni kutmoqda. Firma va mijoz shartnoma faollashishini kutyapti.
          </span>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      ) : null}

      <div className="space-y-3">
        <TabBar<Tab>
          value={tab}
          onChange={setTab}
          tabs={STATUS_TABS.filter((t) => t.id === "all" || t.id !== "draft" || counts.draft).map((t) => ({
            id: t.id,
            label: t.label,
            icon: t.icon,
            count: counts[t.id] ?? 0,
          }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              className={`${inputClass} pl-10`}
              placeholder="Mijoz, firma, telefon, manzil yoki #ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={inputClass} value={firm} onChange={(e) => setFirm(e.target.value)}>
            <option value="">Barcha firmalar</option>
            {firms.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select className={inputClass} value={clientType} onChange={(e) => setClientType(e.target.value as "" | CareClientType)}>
            <option value="">Barcha mijoz turlari</option>
            <option value="household">{CARE_CLIENT_TYPE_LABEL.household}</option>
            <option value="organization">{CARE_CLIENT_TYPE_LABEL.organization}</option>
          </select>
          <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Eng yangilari</option>
            <option value="next_visit">Keyingi tashrif bo&apos;yicha</option>
            <option value="end_date">Tugash sanasi bo&apos;yicha</option>
            <option value="amount">Summa bo&apos;yicha</option>
          </select>
        </div>
        {data?.truncated ? (
          <p className="text-xs text-amber-300">
            Ko&apos;rsatilmoqda: {data.results.length} / {data.count} ta shartnoma (eng yangilari).
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card/90 shadow-lg shadow-black/20">
        {loading ? (
          <LoadingBlock />
        ) : error && !data ? (
          <EmptyState
            icon="error"
            title="Shartnomalar yuklanmadi"
            description={error}
            action={
              <PrimaryButton icon="refresh" onClick={() => void reload()}>
                Qayta urinish
              </PrimaryButton>
            }
          />
        ) : !rows.length ? (
          <EmptyState
            icon="handshake"
            title="Shartnomalar topilmadi"
            description={filtersOn ? "Qidiruv yoki filtrlarni o'zgartirib ko'ring." : "Bu holatda shartnoma yo'q."}
            action={
              filtersOn ? (
                <SecondaryButton
                  icon="filter_alt_off"
                  onClick={() => {
                    setSearch("");
                    setFirm("");
                    setClientType("");
                  }}
                >
                  Filtrlarni tozalash
                </SecondaryButton>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#26352c] text-xs uppercase tracking-wide text-on-surface-variant">
                    {["Shartnoma / mijoz", "Firma", "Reja", "Keyingi tashrif", "Narx", "Ijro", "Holat", ""].map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#26352c]/50">
                  {rows.map((c) => (
                    <ContractRow key={c.id} c={c} onOpen={() => setSelectedId(c.id)} onAction={(a) => openAction(c, a)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[#26352c]/50 lg:hidden">
              {rows.map((c) => (
                <ContractCard key={c.id} c={c} onOpen={() => setSelectedId(c.id)} onAction={(a) => openAction(c, a)} />
              ))}
            </div>
          </>
        )}
      </div>

      <Modal
        open={selectedId !== null}
        size="xl"
        title={selected ? `Shartnoma #${selected.id}` : "Shartnoma"}
        description={selected ? `${selected.firm_name || "—"} · ${selected.customer_name || "—"}` : undefined}
        onClose={() => {
          if (busy) return;
          setSelectedId(null);
          setAction(null);
        }}
        footer={
          selected ? (
            <>
              {ACTIONS_BY_STATUS[selected.status].map((a) => {
                const conf = CARE_ACTIONS[a];
                const Btn = conf.variant === "primary" ? PrimaryButton : SecondaryButton;
                return (
                  <Btn
                    key={a}
                    icon={conf.icon}
                    disabled={busy}
                    onClick={() => setAction(a)}
                    className={conf.variant === "danger" ? "text-error! hover:border-error/50!" : ""}
                  >
                    {conf.label}
                  </Btn>
                );
              })}
              {!ACTIONS_BY_STATUS[selected.status].length ? (
                <p className="self-center text-sm text-on-surface-variant">
                  Shartnoma yopilgan — faqat izoh qoldirish mumkin.
                </p>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <CareContractDetail
            key={selected.id}
            contract={selected}
            onComment={sendComment}
            onVisitUpdate={updateVisit}
          />
        ) : (
          <LoadingBlock />
        )}
      </Modal>

      {selected ? (
        <CareActionDialog
          key={`${selected.id}-${action ?? "none"}`}
          contract={selected}
          action={action}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={(a, note) => void runAction(a, note)}
        />
      ) : null}
    </div>
  );
}

function QuickActions({ c, onAction }: { c: CareContract; onAction: (a: CareAction) => void }) {
  if (c.status !== "pending") return null;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction("approve");
        }}
        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
      >
        <span className="material-symbols-outlined text-[16px]">check</span>
        Tasdiqlash
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction("reject");
        }}
        className="inline-flex items-center gap-1 rounded-full border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/20"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
        Rad
      </button>
    </div>
  );
}

function Progress({ c }: { c: CareContract }) {
  const planned = c.planned_visits || c.visits.length;
  const pct = planned ? Math.round((c.visits_done / planned) * 100) : 0;
  return (
    <div className="w-28">
      <div className="flex justify-between text-[11px] text-on-surface-variant">
        <span>
          {c.visits_done}/{planned}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#26352c]">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NextVisitCell({ c }: { c: CareContract }) {
  const next = nextVisit(c);
  const overdue = overdueVisits(c).length;
  return (
    <div>
      <p className="whitespace-nowrap font-medium">{next ? formatDate(next.visit_date) : "—"}</p>
      {next?.assigned_worker_name ? <p className="truncate text-[11px] text-on-surface-variant">{next.assigned_worker_name}</p> : null}
      {overdue && ["active", "paused"].includes(c.status) ? (
        <p className="text-[11px] font-semibold text-error">{overdue} ta hisobotsiz</p>
      ) : null}
    </div>
  );
}

function planText(c: CareContract) {
  const days = c.preferred_weekdays?.length ? ` · ${c.preferred_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : "";
  return `${CARE_FREQUENCY_LABEL[c.frequency]}${days}`;
}

function ContractRow({ c, onOpen, onAction }: { c: CareContract; onOpen: () => void; onAction: (a: CareAction) => void }) {
  return (
    <tr className="cursor-pointer transition hover:bg-white/5" onClick={onOpen}>
      <td className="max-w-[260px] px-4 py-3">
        <p className="truncate font-semibold">
          <span className="mr-1.5 text-xs text-on-surface-variant">#{c.id}</span>
          {c.customer_name || c.title || "—"}
        </p>
        <p className="truncate text-xs text-on-surface-variant">
          {CARE_CLIENT_TYPE_LABEL[c.client_type]}
          {c.customer_phone ? ` · ${formatPhone(c.customer_phone)}` : ""}
        </p>
        {c.title && c.title !== c.customer_name ? <p className="truncate text-xs text-on-surface-variant/80">{c.title}</p> : null}
      </td>
      <td className="max-w-[180px] truncate px-4 py-3 font-medium text-primary">{c.firm_name || "—"}</td>
      <td className="px-4 py-3 text-xs">
        <p className="font-medium text-on-surface">{planText(c)}</p>
        <p className="whitespace-nowrap text-on-surface-variant">
          {formatDate(c.start_date)} – {formatDate(c.end_date)}
        </p>
      </td>
      <td className="px-4 py-3 text-xs">
        <NextVisitCell c={c} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <p className="font-semibold">{formatMoney(c.total_amount, c.currency)}</p>
        <p className="text-[11px] text-on-surface-variant">{formatMoney(c.price_per_visit, c.currency)} / tashrif</p>
      </td>
      <td className="px-4 py-3">
        <Progress c={c} />
      </td>
      <td className="px-4 py-3">
        <StatusPill variant={CARE_STATUS_TONE[c.status]} pulse={c.status === "pending"}>
          {CARE_STATUS_LABEL[c.status]}
        </StatusPill>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <QuickActions c={c} onAction={onAction} />
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </div>
      </td>
    </tr>
  );
}

function ContractCard({ c, onOpen, onAction }: { c: CareContract; onOpen: () => void; onAction: (a: CareAction) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="space-y-3 px-4 py-4 transition hover:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            <span className="mr-1.5 text-xs text-on-surface-variant">#{c.id}</span>
            {c.customer_name || c.title || "—"}
          </p>
          <p className="truncate text-xs text-primary">{c.firm_name || "—"}</p>
        </div>
        <StatusPill variant={CARE_STATUS_TONE[c.status]} pulse={c.status === "pending"}>
          {CARE_STATUS_LABEL[c.status]}
        </StatusPill>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-on-surface-variant">Reja</p>
          <p className="font-medium">{planText(c)}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Keyingi tashrif</p>
          <NextVisitCell c={c} />
        </div>
        <div>
          <p className="text-on-surface-variant">Jami summa</p>
          <p className="font-semibold">{formatMoney(c.total_amount, c.currency)}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Ijro</p>
          <Progress c={c} />
        </div>
      </div>
      <QuickActions c={c} onAction={onAction} />
    </div>
  );
}
