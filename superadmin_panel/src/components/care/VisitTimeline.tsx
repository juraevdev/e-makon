"use client";

import { useMemo, useState } from "react";
import { EmptyState, Field, FilterChip, inputClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { CareVisit, CareVisitStatus } from "@/lib/api/types";
import { CARE_VISIT_STATUS_LABEL } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { isOpenVisit, todayIso, VISIT_TONE } from "./careMeta";

export type VisitPatch = { status?: CareVisitStatus; visit_date?: string; report_notes?: string };

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

type Scope = "upcoming" | "past" | "all";

function parseDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function VisitTimeline({
  visits,
  editable,
  onUpdate,
}: {
  visits: CareVisit[];
  editable: boolean;
  onUpdate: (visit: CareVisit, patch: VisitPatch) => Promise<boolean>;
}) {
  const today = todayIso();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Required<VisitPatch>>({ status: "scheduled", visit_date: "", report_notes: "" });
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const upcoming = visits.filter((v) => v.visit_date >= today).length;
    return { upcoming, past: visits.length - upcoming, all: visits.length };
  }, [visits, today]);

  const groups = useMemo(() => {
    const list =
      scope === "upcoming"
        ? visits.filter((v) => v.visit_date >= today)
        : scope === "past"
          ? visits.filter((v) => v.visit_date < today).reverse()
          : visits;
    const map = new Map<string, CareVisit[]>();
    for (const v of list) {
      const key = v.visit_date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()];
  }, [visits, scope, today]);

  function startEdit(v: CareVisit) {
    setEditing(v.id);
    setDraft({ status: v.status, visit_date: v.visit_date, report_notes: v.report_notes || "" });
  }

  async function save(v: CareVisit) {
    const patch: VisitPatch = {};
    if (draft.status !== v.status) patch.status = draft.status;
    if (draft.visit_date && draft.visit_date !== v.visit_date) patch.visit_date = draft.visit_date;
    if (draft.report_notes.trim() !== (v.report_notes || "")) patch.report_notes = draft.report_notes.trim();
    if (!Object.keys(patch).length) {
      setEditing(null);
      return;
    }
    setSaving(true);
    const ok = await onUpdate(v, patch);
    setSaving(false);
    if (ok) setEditing(null);
  }

  async function quick(v: CareVisit, status: CareVisitStatus) {
    setSaving(true);
    await onUpdate(v, { status });
    setSaving(false);
  }

  if (!visits.length) {
    return (
      <EmptyState
        icon="event_busy"
        title="Tashriflar jadvali hali yo'q"
        description="Shartnoma tasdiqlangach tashriflar chastota va hafta kunlari bo'yicha avtomatik rejalashtiriladi."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip label="Kelgusi" icon="upcoming" count={counts.upcoming} active={scope === "upcoming"} onClick={() => setScope("upcoming")} />
        <FilterChip label="O'tgan" icon="history" count={counts.past} active={scope === "past"} onClick={() => setScope("past")} />
        <FilterChip label="Barchasi" icon="calendar_month" count={counts.all} active={scope === "all"} onClick={() => setScope("all")} />
      </div>

      {!groups.length ? (
        <p className="rounded-xl border border-dashed border-[#26352c] px-4 py-8 text-center text-sm text-on-surface-variant">
          Bu bo&apos;limda tashrif yo&apos;q.
        </p>
      ) : null}

      {groups.map(([month, items]) => {
        const first = parseDay(`${month}-01`);
        return (
          <section key={month}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {MONTHS[first.getMonth()]} {first.getFullYear()} · {items.length} ta
            </p>
            <ol className="relative space-y-2 border-l border-[#26352c] pl-5">
              {items.map((v) => {
                const tone = VISIT_TONE[v.status] ?? VISIT_TONE.scheduled;
                const day = parseDay(v.visit_date);
                const isToday = v.visit_date === today;
                const overdue = v.visit_date < today && isOpenVisit(v);
                const open = editing === v.id;
                return (
                  <li key={v.id} className="relative">
                    <span
                      className={`absolute -left-[26px] top-3.5 h-3 w-3 rounded-full ring-4 ring-[#151917] ${tone.dot} ${isToday ? "animate-pulse" : ""}`}
                    />
                    <div
                      className={`rounded-xl border px-3.5 py-2.5 ${isToday ? "border-primary/50 bg-primary/5" : "border-[#26352c] bg-[#0e1210]"}`}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <div className="min-w-[132px]">
                          <p className="text-sm font-semibold">
                            {String(day.getDate()).padStart(2, "0")}.{String(day.getMonth() + 1).padStart(2, "0")}.{day.getFullYear()}
                            {isToday ? <span className="ml-2 text-xs font-bold text-primary">Bugun</span> : null}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">{WEEKDAYS[day.getDay()]}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone.bg} ${tone.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {CARE_VISIT_STATUS_LABEL[v.status] ?? v.status_label ?? v.status}
                        </span>
                        {overdue ? (
                          <span className="rounded-full bg-error/15 px-2 py-0.5 text-[11px] font-semibold text-error">Muddati o&apos;tgan</span>
                        ) : null}
                        <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">engineering</span>
                          <span className="truncate">{v.assigned_worker_name || "Xodim belgilanmagan"}</span>
                        </span>
                        {editable && !open ? (
                          <div className="flex items-center gap-1">
                            {isOpenVisit(v) ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void quick(v, "done")}
                                title="Bajarildi deb belgilash"
                                className="rounded-lg p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40"
                              >
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => startEdit(v)}
                              title="Tahrirlash"
                              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {v.report_notes && !open ? (
                        <p className="mt-2 whitespace-pre-line rounded-lg bg-[#151c18] px-3 py-2 text-xs">
                          <span className="font-semibold text-on-surface-variant">Hisobot: </span>
                          {v.report_notes}
                          {v.report_sent_at ? <span className="ml-1 text-on-surface-variant">· {formatDateTime(v.report_sent_at)}</span> : null}
                        </p>
                      ) : null}
                      {open ? (
                        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#26352c] pt-3 sm:grid-cols-2">
                          <Field label="Holat">
                            <select
                              className={inputClass}
                              value={draft.status}
                              onChange={(e) => setDraft({ ...draft, status: e.target.value as CareVisitStatus })}
                            >
                              {(Object.keys(CARE_VISIT_STATUS_LABEL) as CareVisitStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {CARE_VISIT_STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Sana">
                            <input
                              type="date"
                              className={inputClass}
                              value={draft.visit_date}
                              onChange={(e) => setDraft({ ...draft, visit_date: e.target.value })}
                            />
                          </Field>
                          <Field label="Hisobot / izoh" className="sm:col-span-2" hint="Bajarilgan tashrif uchun mijozga bildirishnoma yuboriladi.">
                            <textarea
                              rows={2}
                              className={inputClass}
                              value={draft.report_notes}
                              onChange={(e) => setDraft({ ...draft, report_notes: e.target.value })}
                            />
                          </Field>
                          <div className="flex gap-2 sm:col-span-2">
                            <PrimaryButton icon="save" disabled={saving} onClick={() => void save(v)}>
                              {saving ? "Saqlanmoqda..." : "Saqlash"}
                            </PrimaryButton>
                            <SecondaryButton disabled={saving} onClick={() => setEditing(null)}>
                              Bekor
                            </SecondaryButton>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
