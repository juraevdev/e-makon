"use client";

import { useMemo, useState } from "react";
import { EmptyState, ExcelButton, FilterChip, LoadingBlock, SecondaryButton, inputClass } from "@/components/ui";
import type { PointKind, PointTransaction } from "@/lib/api/types";
import { POINT_KIND_LABEL } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDateTime, formatPhone } from "@/lib/format";

const STEP = 50;

const KIND_STYLE: Record<PointKind, { icon: string; cls: string }> = {
  earn: { icon: "add_circle", cls: "bg-primary/15 text-primary" },
  redeem: { icon: "redeem", cls: "bg-sky-500/15 text-sky-300" },
  expire: { icon: "hourglass_disabled", cls: "bg-surface-container-high text-on-surface-variant" },
  adjust: { icon: "tune", cls: "bg-amber-500/15 text-amber-300" },
};

function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TransactionsTable({
  items,
  loading,
  error,
  truncated,
  total,
}: {
  items: PointTransaction[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  total: number;
}) {
  const [kind, setKind] = useState<"all" | PointKind>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(STEP);

  const scoped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return items.filter((t) => {
      const day = localDay(t.created_at);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!term) return true;
      return (
        t.user_name.toLowerCase().includes(term) ||
        t.note.toLowerCase().includes(term) ||
        (digits.length >= 2 && t.user_phone.replace(/\D/g, "").includes(digits)) ||
        (t.order_id !== null && `#${t.order_id}` === term)
      );
    });
  }, [items, search, from, to]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: scoped.length };
    for (const t of scoped) map[t.kind] = (map[t.kind] ?? 0) + 1;
    return map;
  }, [scoped]);

  const rows = useMemo(() => (kind === "all" ? scoped : scoped.filter((t) => t.kind === kind)), [scoped, kind]);
  const net = rows.reduce((sum, t) => sum + t.points, 0);
  const filtersOn = Boolean(search || from || to || kind !== "all");

  function exportExcel() {
    downloadExcel(`ball-tranzaksiyalari-${new Date().toISOString().slice(0, 10)}`, {
      name: "Tranzaksiyalar",
      headers: ["ID", "Sana", "Mijoz", "Telefon", "Turi", "Ball", "Buyurtma", "Izoh"],
      rows: rows.map((t) => [
        t.id,
        t.created_at.replace("T", " ").slice(0, 16),
        t.user_name,
        t.user_phone,
        POINT_KIND_LABEL[t.kind] ?? t.kind,
        t.points,
        t.order_id ? `#${t.order_id}` : "",
        t.note,
      ]),
    });
  }

  function reset() {
    setKind("all");
    setSearch("");
    setFrom("");
    setTo("");
    setLimit(STEP);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card/90 shadow-lg shadow-black/20">
      <div className="space-y-3 border-b border-[#26352c] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            Tranzaksiyalar
          </h2>
          <div className="flex items-center gap-2">
            {filtersOn ? (
              <SecondaryButton icon="filter_alt_off" onClick={reset}>
                Tozalash
              </SecondaryButton>
            ) : null}
            <ExcelButton onClick={exportExcel} disabled={!rows.length} />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip label="Barchasi" count={counts.all} active={kind === "all"} onClick={() => setKind("all")} />
          {(Object.keys(POINT_KIND_LABEL) as PointKind[]).map((k) => (
            <FilterChip
              key={k}
              label={POINT_KIND_LABEL[k]}
              icon={KIND_STYLE[k].icon}
              count={counts[k] ?? 0}
              active={kind === k}
              onClick={() => {
                setKind(k);
                setLimit(STEP);
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              className={`${inputClass} pl-10`}
              placeholder="Mijoz ismi, telefon, izoh yoki #buyurtma..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(STEP);
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="shrink-0">Dan</span>
            <input type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="shrink-0">Gacha</span>
            <input type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-on-surface-variant">
          {rows.length} ta yozuv · sof natija:{" "}
          <b className={net >= 0 ? "text-primary" : "text-error"}>
            {net > 0 ? "+" : ""}
            {net.toLocaleString("uz-UZ")} ball
          </b>
          {truncated ? (
            <span className="text-amber-300">
              {" "}
              · oxirgi {items.length} / {total} ta tranzaksiya yuklangan
            </span>
          ) : null}
        </p>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error && !items.length ? (
        <p className="p-6 text-sm text-error">{error}</p>
      ) : !rows.length ? (
        <EmptyState icon="receipt_long" title="Tranzaksiya topilmadi" description={filtersOn ? "Filtrlarni o'zgartirib ko'ring." : "Hali ball harakati yo'q."} />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#26352c] text-xs uppercase tracking-wide text-on-surface-variant">
                  {["Mijoz", "Turi", "Ball", "Buyurtma", "Izoh", "Sana"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26352c]/40">
                {rows.slice(0, limit).map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <p className="font-medium">{t.user_name || "—"}</p>
                      <p className="text-xs text-on-surface-variant">{t.user_phone ? formatPhone(t.user_phone) : ""}</p>
                    </td>
                    <td className="px-5 py-3">
                      <KindBadge kind={t.kind} />
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3 font-bold ${t.points >= 0 ? "text-primary" : "text-error"}`}>
                      {t.points > 0 ? `+${t.points.toLocaleString("uz-UZ")}` : t.points.toLocaleString("uz-UZ")}
                    </td>
                    <td className="px-5 py-3 font-mono text-primary">{t.order_id ? `#${t.order_id}` : "—"}</td>
                    <td className="max-w-[280px] truncate px-5 py-3 text-on-surface-variant" title={t.note}>
                      {t.note || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-on-surface-variant">{formatDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[#26352c]/40 md:hidden">
            {rows.slice(0, limit).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.user_name || "—"}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {t.note || POINT_KIND_LABEL[t.kind]} · {formatDateTime(t.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${t.points >= 0 ? "text-primary" : "text-error"}`}>
                    {t.points > 0 ? `+${t.points}` : t.points}
                  </p>
                  <KindBadge kind={t.kind} />
                </div>
              </div>
            ))}
          </div>
          {rows.length > limit ? (
            <div className="flex justify-center border-t border-[#26352c] p-4">
              <SecondaryButton icon="expand_more" onClick={() => setLimit((n) => n + STEP)}>
                Yana ko&apos;rsatish ({rows.length - limit})
              </SecondaryButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: PointKind }) {
  const s = KIND_STYLE[kind] ?? KIND_STYLE.adjust;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
      {POINT_KIND_LABEL[kind] ?? kind}
    </span>
  );
}
