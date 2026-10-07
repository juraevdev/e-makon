"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { StatusPill, TabBar, inputClass } from "@/components/ui";
import type { CareContract, CareVisit } from "@/lib/api/types";
import { CARE_CLIENT_TYPE_LABEL, CARE_FREQUENCY_LABEL, CARE_STATUS_LABEL, CARE_STATUS_TONE, ROLE_LABEL, WEEKDAY_SHORT } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone, relativeTime } from "@/lib/format";
import { EVENT_META, nextVisit, overdueVisits, PAYMENT_LABEL } from "./careMeta";
import { VisitTimeline, type VisitPatch } from "./VisitTimeline";

type Section = "info" | "visits" | "history";

function InfoTile({ label, value, icon }: { label: string; value: ReactNode; icon: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#26352c] bg-[#0e1210] px-3.5 py-3">
      <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
        <div className="break-words text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

export function CareContractDetail({
  contract: c,
  onComment,
  onVisitUpdate,
}: {
  contract: CareContract;
  onComment: (text: string) => Promise<boolean>;
  onVisitUpdate: (visit: CareVisit, patch: VisitPatch) => Promise<boolean>;
}) {
  const [section, setSection] = useState<Section>(c.status === "pending" ? "info" : "visits");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const thread = useRef<HTMLDivElement>(null);

  const next = nextVisit(c);
  const overdue = overdueVisits(c);
  const done = c.visits_done;
  const planned = c.planned_visits || c.visits.length;
  const pct = planned ? Math.round((done / planned) * 100) : 0;
  const comments = c.events.filter((e) => e.action === "comment").length;
  const visitsEditable = ["active", "paused", "completed"].includes(c.status);

  useEffect(() => {
    if (section === "history") thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [section, c.events.length]);

  async function sendComment() {
    const text = comment.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onComment(text);
    setSending(false);
    if (ok) setComment("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#26352c] bg-gradient-to-br from-[#16211a] to-[#0f1411] p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill variant={CARE_STATUS_TONE[c.status]} pulse={c.status === "pending"}>
              {CARE_STATUS_LABEL[c.status]}
            </StatusPill>
            <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
              {CARE_CLIENT_TYPE_LABEL[c.client_type]}
            </span>
            {overdue.length ? (
              <span className="rounded-full bg-error/15 px-2.5 py-1 text-xs font-semibold text-error">
                {overdue.length} ta tashrif hisobotsiz
              </span>
            ) : null}
          </div>
          <p className="mt-2 truncate text-lg font-bold">{c.title || c.customer_name || `Shartnoma #${c.id}`}</p>
          <p className="text-sm text-on-surface-variant">
            <span className="text-primary">{c.firm_name || "Firma ko'rsatilmagan"}</span> → {c.customer_name || "—"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center sm:w-[360px]">
          <div>
            <p className="text-[11px] text-on-surface-variant">Jami summa</p>
            <p className="text-sm font-bold">{formatMoney(c.total_amount, c.currency)}</p>
          </div>
          <div>
            <p className="text-[11px] text-on-surface-variant">Keyingi tashrif</p>
            <p className="text-sm font-bold">{next ? formatDate(next.visit_date) : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-on-surface-variant">Bajarildi</p>
            <p className="text-sm font-bold">
              {done}/{planned}
            </p>
          </div>
          <div className="col-span-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-[#26352c]">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-right text-[11px] text-on-surface-variant">{pct}% bajarilgan</p>
          </div>
        </div>
      </div>

      {c.rejection_reason && c.status === "rejected" ? (
        <p className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-[18px]">block</span>
          <span>
            <b>Rad sababi:</b> {c.rejection_reason}
          </span>
        </p>
      ) : null}
      {c.platform_note ? (
        <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <span className="material-symbols-outlined text-[18px] text-primary">sticky_note_2</span>
          <span>
            <b>Tizim izohi:</b> {c.platform_note}
          </span>
        </p>
      ) : null}

      <TabBar<Section>
        value={section}
        onChange={setSection}
        tabs={[
          { id: "info", label: "Ma'lumot", icon: "info" },
          { id: "visits", label: "Tashriflar", icon: "event", count: c.visits.length },
          { id: "history", label: "Tarix va izohlar", icon: "forum", count: comments || undefined },
        ]}
      />

      {section === "info" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoTile icon="apartment" label="Firma" value={c.firm_name || "—"} />
            <InfoTile
              icon="person"
              label="Mijoz"
              value={
                <>
                  {c.customer_name || "—"}
                  {c.contact_person ? <span className="block text-xs text-on-surface-variant">Mas&apos;ul: {c.contact_person}</span> : null}
                </>
              }
            />
            <InfoTile
              icon="call"
              label="Telefon"
              value={
                c.customer_phone ? (
                  <a href={`tel:${c.customer_phone}`} className="text-primary hover:underline">
                    {formatPhone(c.customer_phone)}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <InfoTile icon="yard" label="Xizmat" value={c.service_name || "Umumiy parvarish"} />
            <InfoTile icon="location_on" label="Manzil" value={c.address || "—"} />
            <InfoTile icon="square_foot" label="Maydon" value={c.area_size || "—"} />
            <InfoTile
              icon="event_repeat"
              label="Chastota"
              value={`${CARE_FREQUENCY_LABEL[c.frequency]}${
                c.preferred_weekdays?.length ? ` · ${c.preferred_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : ""
              }`}
            />
            <InfoTile icon="date_range" label="Muddat" value={`${formatDate(c.start_date)} – ${formatDate(c.end_date)}`} />
            <InfoTile icon="payments" label="Bir tashrif narxi" value={formatMoney(c.price_per_visit, c.currency)} />
            <InfoTile icon="account_balance_wallet" label="Jami summa" value={formatMoney(c.total_amount, c.currency)} />
            <InfoTile icon="receipt_long" label="To'lov tartibi" value={PAYMENT_LABEL[c.payment_terms] ?? c.payment_terms} />
            <InfoTile
              icon="schedule"
              label="Yaratilgan / tasdiqlangan"
              value={
                <>
                  {formatDateTime(c.created_at)}
                  {c.approved_at ? <span className="block text-xs text-primary">Tasdiq: {formatDateTime(c.approved_at)}</span> : null}
                </>
              }
            />
          </div>
          {c.terms ? (
            <div>
              <p className="mb-2 text-sm font-semibold">Shartnoma shartlari</p>
              <p className="whitespace-pre-line rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 text-sm leading-relaxed">{c.terms}</p>
            </div>
          ) : null}
          {c.order ? <p className="text-xs text-on-surface-variant">Bog&apos;langan buyurtma: #{c.order}</p> : null}
        </div>
      ) : null}

      {section === "visits" ? <VisitTimeline visits={c.visits} editable={visitsEditable} onUpdate={onVisitUpdate} /> : null}

      {section === "history" ? (
        <div className="space-y-3">
          <div ref={thread} className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {c.events.map((e) => {
              const meta = EVENT_META[e.action] ?? { label: e.action, icon: "history", tone: "text-on-surface" };
              const platform = e.actor_role === "superadmin";
              const isComment = e.action === "comment";
              return (
                <div key={e.id} className={`flex ${isComment && platform ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl border px-3.5 py-2.5 text-sm sm:max-w-[80%] ${
                      isComment
                        ? platform
                          ? "border-amber-500/30 bg-amber-500/10"
                          : "border-primary/30 bg-primary/10"
                        : "border-[#26352c] bg-[#0e1210]"
                    }`}
                  >
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className={`material-symbols-outlined text-[16px] ${meta.tone}`}>{meta.icon}</span>
                      <b className="text-on-surface">{meta.label}</b>
                      <span>· {e.actor_name}</span>
                      {e.actor_role ? <span>({ROLE_LABEL[e.actor_role] ?? e.actor_role})</span> : null}
                      <span title={formatDateTime(e.created_at)}>· {relativeTime(e.created_at)}</span>
                    </p>
                    {e.note ? <p className="mt-1 whitespace-pre-line">{e.note}</p> : null}
                  </div>
                </div>
              );
            })}
            {!c.events.length ? <p className="py-6 text-center text-sm text-on-surface-variant">Tarix bo&apos;sh.</p> : null}
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-[#26352c] bg-[#0e1210] p-2">
            <textarea
              rows={2}
              value={comment}
              maxLength={2000}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendComment();
                }
              }}
              placeholder="Firmaga izoh yozing (firma xabarlariga ham tushadi)..."
              className={`${inputClass} resize-none border-transparent bg-transparent focus:ring-0`}
            />
            <button
              type="button"
              onClick={() => void sendComment()}
              disabled={sending || !comment.trim()}
              aria-label="Yuborish"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <span className={`material-symbols-outlined ${sending ? "animate-spin" : ""}`}>{sending ? "progress_activity" : "send"}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
