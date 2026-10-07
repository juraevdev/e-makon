"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  EmptyState,
  ExcelButton,
  Field,
  inputClass,
  LiveBadge,
  LoadingBlock,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import type { Investor } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatDateTime, formatMoney, formatPhone, initials, relativeTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage, fetchAllPages } from "@/components/people/api";
import { ErrorPanel, MiniStat, SearchBox, SelectFilter } from "@/components/people/form";
import { InvestorFormModal } from "@/components/people/InvestorFormModal";

type StatusFilter = "all" | Investor["status"];
type SortKey = "new" | "amount" | "share" | "name";

const STATUS_META: Record<Investor["status"], { label: string; tone: "success" | "warning" | "error" }> = {
  active: { label: "Faol", tone: "success" },
  pending: { label: "Kutilmoqda", tone: "warning" },
  ended: { label: "Tugagan", tone: "error" },
};

function totalsByCurrency(list: Investor[]) {
  const map = new Map<string, number>();
  for (const i of list) map.set(i.currency || "UZS", (map.get(i.currency || "UZS") ?? 0) + Number(i.investment_amount || 0));
  return [...map.entries()].sort((a, b) => (a[0] === "UZS" ? -1 : b[0] === "UZS" ? 1 : b[1] - a[1]));
}

function InvestorCard({ inv, onOpen }: { inv: Investor; onOpen: () => void }) {
  const share = Math.min(100, Math.max(0, Number(inv.share_percent) || 0));
  const meta = STATUS_META[inv.status] ?? STATUS_META.active;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex flex-col gap-4 rounded-2xl border bg-gradient-to-b from-[#151a18] to-[#101412] p-5 text-left transition hover:border-primary/60 ${
        inv.status === "ended" ? "border-[#3a2a2b] opacity-80" : "border-primary-container/35"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-container/50 bg-[#1b382b] text-[13px] font-bold text-primary">
          {initials(inv.full_name || inv.company_name || "?")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-on-surface group-hover:text-primary">{inv.full_name}</h3>
          <p className="truncate text-xs text-on-surface-variant">{inv.company_name || "Shaxsiy investor"}</p>
        </div>
        <StatusPill variant={meta.tone} pulse={inv.status === "active"}>
          {meta.label}
        </StatusPill>
      </div>
      <div className="space-y-1 text-xs text-on-surface-variant">
        {inv.phone ? (
          <p className="flex items-center gap-2 font-mono">
            <span className="material-symbols-outlined text-[16px] text-primary">call</span>
            {formatPhone(inv.phone)}
          </p>
        ) : null}
        {inv.email ? (
          <p className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[16px] text-primary">mail</span>
            <span className="truncate">{inv.email}</span>
          </p>
        ) : null}
      </div>
      <div className="mt-auto space-y-3 border-t border-white/10 pt-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-on-surface-variant">Investitsiya</p>
            <p className="truncate text-base font-bold text-on-surface">{formatMoney(inv.investment_amount, inv.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-on-surface-variant">Ulush</p>
            <p className="text-base font-bold text-primary">{share}%</p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#26352c]">
          <div className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary" style={{ width: `${share}%` }} />
        </div>
        {inv.status === "ended" ? (
          <p className="truncate text-[11px] text-error">Sabab: {inv.exit_reason || "ko'rsatilmagan"}</p>
        ) : (
          <p className="text-[11px] text-on-surface-variant">Qo&apos;shilgan {relativeTime(inv.created_at)}</p>
        )}
      </div>
    </button>
  );
}

function DetailRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#26352c] bg-[#0d100f] px-3.5 py-2.5">
      <span className="material-symbols-outlined mt-0.5 text-[18px] text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-on-surface-variant">{label}</p>
        <div className="break-words text-sm text-on-surface">{children}</div>
      </div>
    </div>
  );
}

export default function InvestorlarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [busyEnd, setBusyEnd] = useState(false);

  const { data, loading, error, reload, updatedAt } = useAsync(
    () => fetchAllPages<Investor>("/admin/investors/", { search: query || undefined }),
    [query],
    { keepPrevious: true },
  );
  const all = useMemo(() => data ?? [], [data]);
  const detail = all.find((i) => i.id === detailId) ?? null;

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: all.length, active: 0, pending: 0, ended: 0 };
    for (const i of all) if (i.status in c) c[i.status]++;
    return c;
  }, [all]);

  const activeList = useMemo(() => all.filter((i) => i.status === "active"), [all]);
  const totals = useMemo(() => totalsByCurrency(activeList), [activeList]);
  const activeShare = useMemo(() => activeList.reduce((s, i) => s + (Number(i.share_percent) || 0), 0), [activeList]);

  const list = useMemo(() => {
    const filtered = status === "all" ? all : all.filter((i) => i.status === status);
    const sorted = [...filtered];
    if (sort === "amount") sorted.sort((a, b) => Number(b.investment_amount) - Number(a.investment_amount));
    else if (sort === "share") sorted.sort((a, b) => Number(b.share_percent) - Number(a.share_percent));
    else if (sort === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted;
  }, [all, status, sort]);

  function openCreate() {
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function endAgreement() {
    if (!detail) return;
    if (!exitReason.trim()) {
      showError("Kelishuvni tugatish sababini yozing");
      return;
    }
    setBusyEnd(true);
    try {
      await api(`/admin/investors/${detail.id}/end_agreement/`, {
        method: "POST",
        body: { exit_reason: exitReason.trim() },
      });
      showSuccess(`"${detail.full_name}" bilan kelishuv tugatildi`);
      setEnding(false);
      setExitReason("");
      await reload();
    } catch (e) {
      showError(errorMessage(e, "Kelishuvni tugatib bo'lmadi"));
    } finally {
      setBusyEnd(false);
    }
  }

  function exportExcel() {
    downloadExcel("investorlar", [
      {
        name: "Investorlar",
        headers: ["ID", "F.I.Sh.", "Kompaniya", "Telefon", "Email", "Manzil", "Summa", "Valyuta", "Ulush (%)", "Holat", "Qo'shilgan", "Tugagan", "Chiqish sababi", "Izoh"],
        rows: list.map((i) => [
          i.id,
          i.full_name,
          i.company_name,
          i.phone ? formatPhone(i.phone) : "",
          i.email,
          i.address,
          Number(i.investment_amount || 0),
          i.currency,
          Number(i.share_percent || 0),
          STATUS_META[i.status]?.label ?? i.status,
          formatDate(i.created_at),
          i.ended_at ? formatDate(i.ended_at) : "",
          i.exit_reason,
          i.notes,
        ]),
      },
      {
        name: "Jami (faol)",
        headers: ["Valyuta", "Faol investitsiya"],
        rows: totals.map(([cur, sum]) => [cur, sum]),
      },
    ]);
  }

  const [mainCurrency, mainTotal] = totals[0] ?? ["UZS", 0];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8">
      <PageHeader
        title="Investor hamkorlar"
        description="Platformaga kapital kiritgan investorlar — profil, ulush va kelishuv statusi."
        actions={
          <>
            <LiveBadge updatedAt={updatedAt || undefined} />
            <ExcelButton onClick={exportExcel} disabled={!list.length} />
            <PrimaryButton icon="person_add" onClick={openCreate}>
              Yangi investor
            </PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon="handshake" label="Jami investorlar" value={counts.all} hint={`${counts.pending} kutilmoqda`} />
        <MiniStat icon="verified" label="Faol kelishuvlar" value={counts.active} hint={`${counts.ended} tugagan`} />
        <MiniStat
          icon="account_balance"
          label={`Faol kapital (${mainCurrency})`}
          value={formatMoney(mainTotal, mainCurrency)}
          tone="sky"
          hint={totals.length > 1 ? totals.slice(1).map(([c, s]) => formatMoney(s, c)).join(" · ") : "Faol investorlar bo'yicha"}
        />
        <MiniStat
          icon="pie_chart"
          label="Taqsimlangan ulush"
          value={`${activeShare.toFixed(activeShare % 1 ? 2 : 0)}%`}
          tone={activeShare > 100 ? "error" : "amber"}
          hint={activeShare > 100 ? "Diqqat: 100% dan oshgan" : "Faol investorlar jami"}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-[#26352c] bg-[#121614]/80 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchBox placeholder="Ism, kompaniya, telefon yoki email..." className="sm:flex-1" />
          <SelectFilter
            label="Saralash"
            icon="sort"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: "new", label: "Eng yangilari" },
              { value: "amount", label: "Summa bo'yicha" },
              { value: "share", label: "Ulush bo'yicha" },
              { value: "name", label: "Ism bo'yicha" },
            ]}
            className="sm:w-56"
          />
        </div>
        <TabBar
          value={status}
          onChange={setStatus}
          tabs={[
            { id: "all", label: "Barchasi", icon: "list", count: counts.all },
            { id: "active", label: "Faol", icon: "check_circle", count: counts.active },
            { id: "pending", label: "Kutilmoqda", icon: "hourglass_top", count: counts.pending },
            { id: "ended", label: "Tugagan", icon: "cancel", count: counts.ended },
          ]}
        />
      </div>

      {loading && !data ? (
        <LoadingBlock />
      ) : error && !data ? (
        <ErrorPanel title="Investorlarni yuklab bo'lmadi" message={error} onRetry={() => void reload()} />
      ) : !list.length ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="handshake"
            title={all.length ? "Mos investor topilmadi" : "Investorlar yo'q"}
            description={all.length ? "Qidiruv yoki holat filtrini o'zgartiring." : "Birinchi investorni qo'shing."}
            action={
              <PrimaryButton icon="person_add" onClick={openCreate}>
                Investor qo&apos;shish
              </PrimaryButton>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => (
            <InvestorCard key={i.id} inv={i} onOpen={() => setDetailId(i.id)} />
          ))}
        </div>
      )}

      <InvestorFormModal key={`inv-${formKey}`} open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />

      <Modal
        open={!!detail}
        size="md"
        title={detail?.full_name || "Investor"}
        description={detail ? `${detail.company_name || "Shaxsiy investor"} · #${detail.id}` : undefined}
        onClose={() => {
          setDetailId(null);
          setEnding(false);
          setExitReason("");
        }}
        footer={
          detail ? (
            ending ? (
              <>
                <SecondaryButton onClick={() => setEnding(false)} className="justify-center">
                  Ortga
                </SecondaryButton>
                <button
                  type="button"
                  disabled={busyEnd}
                  onClick={() => void endAgreement()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-error/50 bg-error-container px-5 py-2.5 text-sm font-semibold text-on-error-container transition-all hover:bg-error-container/80 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  {busyEnd ? "Bajarilmoqda..." : "Kelishuvni tugatish"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/hisobotlar"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-primary hover:underline sm:mr-auto"
                >
                  <span className="material-symbols-outlined text-[18px]">monitoring</span>
                  Aylanma hisobotlar
                </Link>
                {detail.status !== "ended" ? (
                  <SecondaryButton icon="cancel" onClick={() => setEnding(true)} className="justify-center text-error">
                    Kelishuvni tugatish
                  </SecondaryButton>
                ) : null}
                <PrimaryButton onClick={() => setDetailId(null)} className="justify-center">
                  Yopish
                </PrimaryButton>
              </>
            )
          ) : null
        }
      >
        {detail ? (
          ending ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-on-surface">
                <strong>{detail.full_name}</strong> bilan kelishuv tugatiladi. Bu amalni ortga qaytarib bo&apos;lmaydi.
              </p>
              <Field label="Chiqish sababi" required>
                <textarea
                  autoFocus
                  rows={4}
                  className={inputClass}
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="Masalan: ulushni sotib oldi, shartnoma muddati tugadi..."
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                  <p className="text-xs text-on-surface-variant">Investitsiya</p>
                  <p className="mt-1 text-lg font-bold text-on-surface">{formatMoney(detail.investment_amount, detail.currency)}</p>
                </div>
                <div className="rounded-2xl border border-[#26352c] bg-[#0d100f] p-4">
                  <p className="text-xs text-on-surface-variant">Ulush</p>
                  <p className="mt-1 text-lg font-bold text-primary">{detail.share_percent}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill variant={STATUS_META[detail.status]?.tone ?? "neutral"} pulse={detail.status === "active"}>
                  {STATUS_META[detail.status]?.label ?? detail.status}
                </StatusPill>
                <span className="text-xs text-on-surface-variant">Qo&apos;shilgan: {formatDateTime(detail.created_at)}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DetailRow icon="call" label="Telefon">
                  {detail.phone ? formatPhone(detail.phone) : "—"}
                </DetailRow>
                <DetailRow icon="mail" label="Email">
                  {detail.email || "—"}
                </DetailRow>
                <div className="sm:col-span-2">
                  <DetailRow icon="location_on" label="Manzil">
                    {detail.address || "—"}
                  </DetailRow>
                </div>
                <div className="sm:col-span-2">
                  <DetailRow icon="notes" label="Izoh">
                    <span className="whitespace-pre-line">{detail.notes || "—"}</span>
                  </DetailRow>
                </div>
                {detail.status === "ended" ? (
                  <div className="sm:col-span-2">
                    <DetailRow icon="event_busy" label={`Tugagan: ${detail.ended_at ? formatDateTime(detail.ended_at) : "—"}`}>
                      <span className="text-error">{detail.exit_reason || "Sabab ko'rsatilmagan"}</span>
                    </DetailRow>
                  </div>
                ) : null}
              </div>
            </div>
          )
        ) : null}
      </Modal>
    </div>
  );
}
