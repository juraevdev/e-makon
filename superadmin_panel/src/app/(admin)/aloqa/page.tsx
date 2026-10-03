"use client";

import { useEffect, useRef, useState } from "react";
import {
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { ChatMessage, ChatRoom, SupportTicket, TicketStatus } from "@/lib/api/types";
import { TICKET_STATUS_LABEL } from "@/lib/domain";
import { formatDateTime, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { usePolling } from "@/hooks/usePolling";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

function timeLabel(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function ChatMonitor() {
  const { query } = useSearch();
  const { showError } = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [thread, setThread] = useState<{ roomId: number | null; items: ChatMessage[] }>({ roomId: null, items: [] });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const { data: rooms, loading, reload } = useAsync(
    async () => asPage<ChatRoom>(await api("/admin/chats/", { query: { page_size: 100, search: query || undefined } })).results,
    [query],
    { keepPrevious: true },
  );
  usePolling(() => void reload(), 15000);

  const active = rooms?.find((r) => r.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    api<ChatMessage[]>(`/admin/chats/${activeId}/messages/`)
      .then((items) => !cancelled && setThread({ roomId: activeId, items }))
      .catch((err: unknown) => !cancelled && showError(err instanceof Error ? err.message : "Yuklanmadi"));
    return () => {
      cancelled = true;
    };
  }, [activeId, showError]);

  usePolling(
    () => {
      if (!activeId || thread.roomId !== activeId) return;
      const last = thread.items[thread.items.length - 1]?.id ?? 0;
      api<ChatMessage[]>(`/admin/chats/${activeId}/messages/`, { query: { after: last } })
        .then((fresh) => {
          if (fresh.length) {
            setThread((t) => (t.roomId === activeId ? { ...t, items: [...t.items, ...fresh.filter((m) => !t.items.some((x) => x.id === m.id))] } : t));
          }
        })
        .catch(() => undefined);
    },
    5000,
    Boolean(activeId),
  );

  const items = thread.roomId === activeId ? thread.items : [];
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [items.length, activeId]);

  async function send() {
    if (!activeId || !text.trim()) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(`/admin/chats/${activeId}/send/`, { method: "POST", body: { body: text } });
      setThread((t) => (t.roomId === activeId ? { ...t, items: [...t.items, msg] } : t));
      setText("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Yuborilmadi");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[480px] overflow-hidden rounded-2xl border border-[#26352c] bg-[#121614]">
      <aside className={`w-full shrink-0 flex-col border-r border-[#26352c] md:flex md:w-80 ${active ? "hidden" : "flex"}`}>
        <p className="border-b border-[#26352c] p-3 text-sm font-semibold">Firma ↔ mijoz suhbatlari ({rooms?.length ?? 0})</p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <LoadingBlock />
          ) : !rooms?.length ? (
            <EmptyState icon="forum" title="Suhbatlar yo'q" />
          ) : (
            rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveId(r.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-[#26352c]/50 px-3 py-3 text-left ${r.id === activeId ? "bg-primary/10" : "hover:bg-white/5"}`}
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{r.customer_name}</span>
                  <span className="shrink-0 text-[10px] text-on-surface-variant">{timeLabel(r.last_message_at)}</span>
                </span>
                <span className="truncate text-xs text-primary">{r.firm_name}</span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-on-surface-variant">{r.last_message_preview || "Yangi suhbat"}</span>
                  {r.firm_unread ? (
                    <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300" title="Firma javob bermagan">
                      {r.firm_unread}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
      <section className={`min-w-0 flex-1 flex-col ${active ? "flex" : "hidden md:flex"}`}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <EmptyState icon="visibility" title="Suhbatni tanlang" description="Firma va mijoz yozishmasini kuzating, kerak bo'lsa E-Makon nomidan aralashing." />
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[#26352c] px-4 py-3">
              <button type="button" className="md:hidden" onClick={() => setActiveId(null)}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {active.customer_name} <span className="text-on-surface-variant">↔</span> {active.firm_name}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Mijoz: {formatPhone(active.customer_phone)} · Firma: {active.firm_phone ? formatPhone(active.firm_phone) : "—"}
                </p>
              </div>
            </header>
            <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#0e1210] p-4">
              {thread.roomId !== activeId ? (
                <LoadingBlock />
              ) : !items.length ? (
                <p className="py-10 text-center text-sm text-on-surface-variant">Xabarlar yo&apos;q</p>
              ) : (
                items.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_role === "customer" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                        m.sender_role === "platform"
                          ? "border border-amber-500/40 bg-amber-500/15"
                          : m.sender_role === "firm"
                            ? "bg-primary-container text-white"
                            : "bg-[#1d2620]"
                      }`}
                    >
                      <p className="mb-0.5 text-[10px] font-semibold opacity-70">{m.sender_name}</p>
                      {m.body}
                      <p className="mt-0.5 text-right text-[10px] opacity-60">{timeLabel(m.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form
              className="flex items-end gap-2 border-t border-[#26352c] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="E-Makon nomidan yozish (mijoz va firma ko'radi)..."
                className={`${inputClass} max-h-32 min-h-[44px] resize-none`}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-black disabled:opacity-40"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Tickets() {
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    async () => asPage<SupportTicket>(await api("/admin/support/", { query: { page_size: 50 } })).results,
    [],
  );

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await api(`/admin/support/${selected.id}/reply/`, { method: "POST", body: { body: reply } });
      setSelected(await api<SupportTicket>(`/admin/support/${selected.id}/`));
      setReply("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: TicketStatus) {
    if (!selected) return;
    setSelected(await api<SupportTicket>(`/admin/support/${selected.id}/`, { method: "PATCH", body: { status } }));
    await reload();
  }

  return (
    <>
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
    </>
  );
}

export default function AloqaPage() {
  const [tab, setTab] = useState<"chats" | "tickets">("chats");
  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Aloqa markazi</h2>
          <p className="text-sm text-on-surface-variant">Firma–mijoz suhbatlari monitoringi va yordam ticketlari.</p>
        </div>
        <div className="flex gap-2">
          <FilterChip label="Suhbatlar" icon="forum" active={tab === "chats"} onClick={() => setTab("chats")} />
          <FilterChip label="Ticketlar" icon="support_agent" active={tab === "tickets"} onClick={() => setTab("tickets")} />
        </div>
      </div>
      {tab === "chats" ? <ChatMonitor /> : <Tickets />}
    </div>
  );
}
