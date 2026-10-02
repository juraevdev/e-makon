"use client";

import { useMemo, useState } from "react";
import {
  Breadcrumbs,
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { CareContract, CareStatus, CareSummary } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import {
  CARE_CLIENT_TYPE_LABEL,
  CARE_FREQUENCY_LABEL,
  CARE_STATUS_LABEL,
  CARE_STATUS_TONE,
  CARE_VISIT_STATUS_LABEL,
  WEEKDAY_SHORT,
} from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

const FILTERS: { id: "all" | CareStatus; label: string }[] = [
  { id: "pending", label: "Tasdiq kutmoqda" },
  { id: "active", label: "Faol" },
  { id: "paused", label: "To'xtatilgan" },
  { id: "rejected", label: "Rad etilgan" },
  { id: "completed", label: "Tugagan" },
  { id: "cancelled", label: "Bekor" },
  { id: "all", label: "Barchasi" },
];

const EVENT_LABEL: Record<string, string> = {
  create: "Yaratildi",
  update: "Tahrirlandi",
  submit: "Tasdiqqa yuborildi",
  approve: "Tasdiqlandi",
  reject: "Rad etildi",
  pause: "To'xtatildi",
  resume: "Davom ettirildi",
  complete: "Yakunlandi",
  cancel: "Bekor qilindi",
  comment: "Izoh",
};

const PAYMENT_LABEL: Record<string, string> = { monthly: "Har oy", quarterly: "Har chorak", upfront: "Oldindan to'liq" };

export default function ParvarishPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<"all" | CareStatus>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<{ action: string; title: string; required: boolean; note: string } | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    async () =>
      asPage<CareContract>(
        await api("/admin/care-contracts/", {
          query: { page_size: 100, status: filter === "all" ? undefined : filter, search: query || undefined },
        }),
      ).results,
    [filter, query],
    { keepPrevious: true },
  );
  const { data: summary, reload: reloadSummary } = useAsync(() => api<CareSummary>("/admin/care-contracts/summary/"), []);
  const { data: selected, setData: setSelected } = useAsync(
    async () => (selectedId ? api<CareContract>(`/admin/care-contracts/${selectedId}/`) : null),
    [selectedId],
  );

  const rows = useMemo(() => data ?? [], [data]);

  async function run(action: string, note = "") {
    if (!selected) return;
    setBusy(true);
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${selected.id}/${action}/`, { method: "POST", body: { note } });
      setSelected(fresh);
      setPrompt(null);
      setComment("");
      showSuccess(action === "comment" ? "Izoh firmaga yuborildi" : "Bajarildi");
      await Promise.all([reload(), reloadSummary()]);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  function exportTable() {
    downloadCsv(
      `parvarish-${new Date().toISOString().slice(0, 10)}`,
      ["ID", "Firma", "Nomi", "Turi", "Mijoz", "Telefon", "Boshlanish", "Tugash", "Tashrif narxi", "Jami", "Tashriflar", "Holat"],
      rows.map((c) => [
        c.id,
        c.firm_name,
        c.title,
        CARE_CLIENT_TYPE_LABEL[c.client_type],
        c.customer_name,
        c.customer_phone,
        c.start_date,
        c.end_date,
        Number(c.price_per_visit),
        Number(c.total_amount),
        `${c.visits_done}/${c.planned_visits}`,
        CARE_STATUS_LABEL[c.status],
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[#26352c]/40 pb-2 sm:flex-row sm:items-center">
        <div>
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Parvarish shartnomalari" }]} />
          <h2 className="text-xl font-bold tracking-tight text-white">Parvarish shartnomalari — vositachilik</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Firmalar uy xo&apos;jaliklari va tashkilotlar bilan tuzgan uzoq muddatli shartnomalar. Tasdiqlang, rad eting yoki izoh qoldiring.
          </p>
        </div>
        <SecondaryButton icon="download" onClick={exportTable} disabled={!rows.length}>
          CSV
        </SecondaryButton>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Tasdiq kutmoqda", summary?.pending, "hourglass_top"],
          ["Faol", summary?.active, "verified"],
          ["Uy xo'jaliklari", summary?.households, "home"],
          ["Tashkilotlar", summary?.organizations, "apartment"],
          ["7 kunlik tashriflar", summary?.visits_week, "event"],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="rounded-2xl border border-[#26352c] bg-[#141816] p-4">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] uppercase tracking-wider">{label}</span>
              <span className="material-symbols-outlined text-primary">{icon}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            count={f.id === "pending" ? summary?.pending : undefined}
            active={filter === f.id}
            onClick={() => setFilter(f.id)}
          />
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-[#26352c] bg-[#141816]">
          <EmptyState icon="handshake" title="Shartnomalar yo'q" description="Bu holatda shartnoma topilmadi." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#26352c] bg-[#141816]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#26352c] text-xs uppercase text-on-surface-variant">
                {["#", "Firma", "Hamkor", "Jadval", "Muddat", "Summa", "Holat"].map((h) => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26352c]/50">
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-white/5" onClick={() => setSelectedId(c.id)}>
                  <td className="px-4 py-3 text-on-surface-variant">#{c.id}</td>
                  <td className="px-4 py-3 font-semibold">{c.firm_name || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.customer_name}</p>
                    <p className="text-xs text-on-surface-variant">{CARE_CLIENT_TYPE_LABEL[c.client_type]}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {CARE_FREQUENCY_LABEL[c.frequency]} · {c.planned_visits} tashrif
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {formatDate(c.start_date)} – {formatDate(c.end_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatMoney(c.total_amount)}</td>
                  <td className="px-4 py-3">
                    <StatusPill variant={CARE_STATUS_TONE[c.status]} pulse={c.status === "pending"}>
                      {CARE_STATUS_LABEL[c.status]}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={selectedId !== null} title={selected ? `Shartnoma #${selected.id} · ${selected.firm_name}` : "Shartnoma"} onClose={() => setSelectedId(null)} wide>
        {!selected ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{selected.title || selected.customer_name}</p>
                <p className="text-sm text-on-surface-variant">
                  {selected.customer_name} · {CARE_CLIENT_TYPE_LABEL[selected.client_type]}
                  {selected.customer_phone ? ` · ${formatPhone(selected.customer_phone)}` : ""}
                </p>
              </div>
              <StatusPill variant={CARE_STATUS_TONE[selected.status]}>{CARE_STATUS_LABEL[selected.status]}</StatusPill>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              {[
                ["Xizmat", selected.service_name || "Umumiy parvarish"],
                ["Manzil", selected.address || "—"],
                ["Maydon", selected.area_size || "—"],
                [
                  "Jadval",
                  `${CARE_FREQUENCY_LABEL[selected.frequency]}${selected.preferred_weekdays?.length ? ` · ${selected.preferred_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : ""}`,
                ],
                ["Muddat", `${formatDate(selected.start_date)} – ${formatDate(selected.end_date)}`],
                ["Tashriflar", `${selected.visits_done} / ${selected.planned_visits}`],
                ["Bir tashrif", formatMoney(selected.price_per_visit)],
                ["Jami", formatMoney(selected.total_amount)],
                ["To'lov", PAYMENT_LABEL[selected.payment_terms] ?? selected.payment_terms],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2">
                  <p className="text-[11px] text-on-surface-variant">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>
            {selected.terms ? (
              <p className="whitespace-pre-line rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 text-xs">{selected.terms}</p>
            ) : null}
            {selected.rejection_reason ? (
              <p className="rounded-xl bg-error/10 px-4 py-2 text-xs text-error">Rad sababi: {selected.rejection_reason}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selected.status === "pending" ? (
                <>
                  <PrimaryButton icon="check" onClick={() => setPrompt({ action: "approve", title: "Tasdiqlash", required: false, note: "" })}>
                    Tasdiqlash
                  </PrimaryButton>
                  <SecondaryButton icon="close" onClick={() => setPrompt({ action: "reject", title: "Rad etish", required: true, note: "" })}>
                    Rad etish
                  </SecondaryButton>
                </>
              ) : null}
              {selected.status === "active" ? (
                <SecondaryButton icon="pause" onClick={() => setPrompt({ action: "pause", title: "To'xtatish", required: false, note: "" })}>
                  To&apos;xtatish
                </SecondaryButton>
              ) : null}
              {selected.status === "paused" ? (
                <SecondaryButton icon="play_arrow" onClick={() => void run("resume")}>
                  Davom ettirish
                </SecondaryButton>
              ) : null}
              {!["completed", "cancelled", "draft", "rejected"].includes(selected.status) ? (
                <SecondaryButton icon="block" onClick={() => setPrompt({ action: "cancel", title: "Bekor qilish", required: true, note: "" })}>
                  Bekor qilish
                </SecondaryButton>
              ) : null}
            </div>

            {prompt ? (
              <div className="space-y-3 rounded-2xl border border-[#26352c] bg-[#0e1210] p-4">
                <p className="text-sm font-semibold">{prompt.title}</p>
                <Field label={prompt.required ? "Sabab (firmaga yuboriladi)" : "Izoh (ixtiyoriy, firmaga ko'rinadi)"} required={prompt.required}>
                  <textarea rows={2} className={inputClass} value={prompt.note} onChange={(e) => setPrompt({ ...prompt, note: e.target.value })} />
                </Field>
                <div className="flex gap-2">
                  <PrimaryButton disabled={busy || (prompt.required && !prompt.note.trim())} onClick={() => void run(prompt.action, prompt.note)}>
                    Tasdiqlash
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setPrompt(null)}>Bekor</SecondaryButton>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">Tarix va izohlar</p>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {[...selected.events].reverse().map((e) => (
                    <div key={e.id} className="rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2 text-xs">
                      <p className="text-on-surface-variant">
                        <b className="text-on-surface">{EVENT_LABEL[e.action] || e.action}</b> · {e.actor_name} · {formatDateTime(e.created_at)}
                      </p>
                      {e.note ? <p className="mt-1 text-sm">{e.note}</p> : null}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Firmaga izoh..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && comment.trim() && void run("comment", comment)}
                  />
                  <PrimaryButton icon="send" disabled={!comment.trim() || busy} onClick={() => void run("comment", comment)}>
                    Yuborish
                  </PrimaryButton>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Tashriflar ({selected.visits.length})</p>
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {selected.visits.slice(0, 80).map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border border-[#26352c] bg-[#0e1210] px-3 py-1.5 text-xs">
                      <span>{formatDate(v.visit_date)}</span>
                      <span className="text-on-surface-variant">{v.assigned_worker_name || "—"}</span>
                      <span>{CARE_VISIT_STATUS_LABEL[v.status]}</span>
                    </div>
                  ))}
                  {!selected.visits.length ? <p className="text-xs text-on-surface-variant">Tasdiqlangach jadval tuziladi.</p> : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
