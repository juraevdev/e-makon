"use client";

import { useState } from "react";
import {
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PageHeader,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { SupportTicket, TicketStatus } from "@/lib/api/types";
import { TICKET_STATUS_LABEL } from "@/lib/domain";
import { formatDateTime, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

export default function AloqaPage() {
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/support/", { query: { page_size: 50 } });
    return asPage<SupportTicket>(raw).results;
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await api(`/admin/support/${selected.id}/reply/`, { method: "POST", body: { body: reply } });
      const fresh = await api<SupportTicket>(`/admin/support/${selected.id}/`);
      setSelected(fresh);
      setReply("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: TicketStatus) {
    if (!selected) return;
    const fresh = await api<SupportTicket>(`/admin/support/${selected.id}/`, {
      method: "PATCH",
      body: { status },
    });
    setSelected(fresh);
    await reload();
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <PageHeader
        title="Aloqa markazi"
        description="Mobil ilovadagi yordam ticketlari — mijoz savollariga javob bering."
      />
      <div className="mb-6">
        <FilterChip label="Ticketlar" count={data?.length ?? 0} icon="support_agent" active />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !data?.length ? (
        <EmptyState icon="mail" title="Hali ticket yo'q" description="Mijoz ilovadan murojaat yuborsa, shu yerda ochiladi." />
      ) : (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#141a16]">
          {data.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t)}
              className="flex items-center gap-4 border-b border-[#26352c]/50 px-5 py-4 text-left hover:bg-[#19221c]/60"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initials(t.customer_name || t.customer_phone)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium text-on-surface">{t.subject}</h4>
                <p className="text-xs text-on-surface-variant">
                  {t.customer_name} · {formatPhone(t.customer_phone)} · {formatDateTime(t.created_at)}
                </p>
              </div>
              <StatusPill variant={t.status === "open" ? "warning" : t.status === "resolved" ? "success" : "info"}>
                {TICKET_STATUS_LABEL[t.status]}
              </StatusPill>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} title={selected?.subject || ""} onClose={() => setSelected(null)} wide>
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              {selected.customer_name} · {formatPhone(selected.customer_phone)}
            </p>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-[#26352c] p-3">
              {selected.messages.map((m) => (
                <div key={m.id} className={`rounded-xl p-3 text-sm ${m.is_internal ? "bg-amber-500/10" : "bg-[#1a231d]"}`}>
                  <p className="mb-1 text-xs text-on-surface-variant">
                    {m.sender_name || "Foydalanuvchi"} · {formatDateTime(m.created_at)}
                  </p>
                  {m.body}
                </div>
              ))}
            </div>
            <Field label="Javob">
              <textarea className={inputClass} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton disabled={busy || !reply.trim()} onClick={() => void sendReply()}>
                Yuborish
              </PrimaryButton>
              <button type="button" className="rounded-full border border-[#26352c] px-4 py-2 text-sm" onClick={() => void setStatus("resolved")}>
                Yechilgan
              </button>
              <button type="button" className="rounded-full border border-[#26352c] px-4 py-2 text-sm" onClick={() => void setStatus("closed")}>
                Yopish
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
