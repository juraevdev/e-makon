"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage, fetchAll } from "@/lib/api/client";
import type { ChatMessage, ChatRoom, SupportTicket, TicketStatus } from "@/lib/api/types";
import { TICKET_STATUS_LABEL } from "@/lib/domain";
import { formatDateTime, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { usePolling } from "@/hooks/usePolling";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

const QUICK_REPLIES = [
  "Assalomu alaykum! Murojaatingiz qabul qilindi.",
  "Brigadamiz yo'lga chiqdi, tez orada yetib boradi.",
  "Buyurtmangiz bo'yicha aniq vaqtni kelishib olaylik.",
  "Rahmat! Yana xizmatimizdan foydalanishingizni kutamiz.",
];

function timeLabel(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function ChatRooms() {
  const params = useSearchParams();
  const { query } = useSearch();
  const { showError } = useToast();
  const [activeId, setActiveId] = useState<number | null>(() => Number(params.get("room")) || null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [thread, setThread] = useState<{ roomId: number | null; items: ChatMessage[]; loaded: boolean }>({
    roomId: null,
    items: [],
    loaded: false,
  });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const { data: rooms, loading, reload } = useAsync(
    async () =>
      asPage<ChatRoom>(
        await api("/admin/chats/", { query: { page_size: 100, search: query || undefined, unread: unreadOnly ? 1 : undefined } }),
      ).results,
    [query, unreadOnly],
    { keepPrevious: true },
  );
  usePolling(() => void reload(), 10000);

  const active = rooms?.find((r) => r.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    api<ChatMessage[]>(`/admin/chats/${activeId}/messages/`)
      .then((items) => {
        if (!cancelled) setThread({ roomId: activeId, items, loaded: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) showError(err instanceof Error ? err.message : "Xabarlar yuklanmadi");
      });
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
          if (!fresh.length) return;
          setThread((t) =>
            t.roomId === activeId
              ? { ...t, items: [...t.items, ...fresh.filter((m) => !t.items.some((x) => x.id === m.id))] }
              : t,
          );
        })
        .catch(() => undefined);
    },
    4000,
    Boolean(activeId),
  );

  const items = thread.roomId === activeId ? thread.items : [];
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [items.length, activeId]);

  async function send(body: string) {
    if (!activeId || !body.trim()) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(`/admin/chats/${activeId}/send/`, { method: "POST", body: { body } });
      setThread((t) => (t.roomId === activeId ? { ...t, items: [...t.items, msg] } : t));
      setText("");
      void reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Yuborilmadi");
    } finally {
      setSending(false);
    }
  }

  const totalUnread = (rooms ?? []).reduce((sum, r) => sum + (r.firm_unread || 0), 0);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#26352c] bg-[#121614]">
      <aside className={`w-full shrink-0 flex-col border-r border-[#26352c] md:flex md:w-80 ${active ? "hidden" : "flex"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-[#26352c] p-3">
          <p className="text-sm font-semibold">
            Suhbatlar {totalUnread ? <span className="ml-1 rounded-full bg-primary px-2 text-xs text-black">{totalUnread}</span> : null}
          </p>
          <FilterChip label="O'qilmagan" active={unreadOnly} onClick={() => setUnreadOnly((v) => !v)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <LoadingBlock />
          ) : !rooms?.length ? (
            <EmptyState
              icon="forum"
              title="Suhbatlar yo'q"
              description="Mijoz ilovadan yozganda yoki siz Mijozlar sahifasidan “Yozish”ni bosganda xona ochiladi."
            />
          ) : (
            rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveId(r.id)}
                className={`flex w-full items-center gap-3 border-b border-[#26352c]/50 px-3 py-3 text-left transition ${
                  r.id === activeId ? "bg-primary/10" : "hover:bg-white/5"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {initials(r.customer_name || r.customer_phone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.customer_name}</span>
                    <span className="shrink-0 text-[10px] text-on-surface-variant">{timeLabel(r.last_message_at)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-on-surface-variant">{r.last_message_preview || "Yangi suhbat"}</span>
                    {r.firm_unread ? (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-black">{r.firm_unread}</span>
                    ) : null}
                  </span>
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
              <EmptyState icon="chat" title="Suhbatni tanlang" description="Har bir mijoz bilan alohida xona — chap tomondan tanlang." />
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[#26352c] px-4 py-3">
              <button type="button" className="md:hidden" onClick={() => setActiveId(null)}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initials(active.customer_name || active.customer_phone)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{active.customer_name}</p>
                <a href={`tel:${active.customer_phone}`} className="text-xs text-primary hover:underline">
                  {formatPhone(active.customer_phone)}
                </a>
              </div>
            </header>

            <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#0e1210] p-4">
              {thread.roomId !== activeId || !thread.loaded ? (
                <LoadingBlock />
              ) : !items.length ? (
                <p className="py-10 text-center text-sm text-on-surface-variant">Hali xabar yo&apos;q. Birinchi bo&apos;lib yozing.</p>
              ) : (
                items.map((m) => {
                  const ours = m.sender_role !== "customer";
                  return (
                    <div key={m.id} className={`flex ${ours ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                          m.sender_role === "platform"
                            ? "border border-amber-500/30 bg-amber-500/10"
                            : ours
                              ? "rounded-br-sm bg-primary-container text-white"
                              : "rounded-bl-sm bg-[#1d2620]"
                        }`}
                      >
                        {m.sender_role === "platform" ? <p className="mb-0.5 text-[10px] font-semibold text-amber-300">E-Makon</p> : null}
                        {m.body}
                        {m.order ? <p className="mt-1 text-[10px] opacity-70">Buyurtma #{m.order}</p> : null}
                        <p className="mt-0.5 text-right text-[10px] opacity-60">{timeLabel(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#26352c] p-3">
              <div className="custom-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setText(q)}
                    className="shrink-0 rounded-full border border-[#26352c] px-3 py-1 text-xs text-on-surface-variant hover:border-primary/40 hover:text-primary"
                  >
                    {q.length > 34 ? `${q.slice(0, 34)}…` : q}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(text);
                }}
              >
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(text);
                    }
                  }}
                  placeholder="Xabar yozing..."
                  className={`${inputClass} max-h-32 min-h-[44px] resize-none`}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-black disabled:opacity-40"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </form>
            </div>
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

  const { showError, showSuccess } = useToast();
  const [confirmClose, setConfirmClose] = useState(false);

  const { data, loading, error, reload } = useAsync(
    async () => fetchAll<SupportTicket>("/admin/support/", {}, 5),
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
    } catch (err) {
      showError(err instanceof Error ? err.message : "Javob yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: TicketStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      setSelected(await api<SupportTicket>(`/admin/support/${selected.id}/`, { method: "PATCH", body: { status } }));
      showSuccess(status === "closed" ? "Murojaat yopildi" : "Holat yangilandi");
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Holat o'zgarmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !data?.length ? (
        <EmptyState icon="mail" title="Hali ticket yo'q" description="Mijoz ilovadan rasmiy murojaat yuborsa, shu yerda ochiladi." />
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
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-[#26352c] px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => void setStatus("resolved")}
              >
                Yechilgan
              </button>
              <button
                type="button"
                disabled={busy || selected.status === "closed"}
                className="rounded-full border border-[#26352c] px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => setConfirmClose(true)}
              >
                Yopish
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="Murojaat yopilsinmi?"
        description="Yopilgan murojaatga mijoz endi javob yoza olmaydi."
        confirmText="Yopish"
        cancelText="Bekor"
        variant="warning"
        busy={busy}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          void setStatus("closed");
        }}
      />
    </>
  );
}

export default function AloqaPage() {
  const [tab, setTab] = useState<"chats" | "tickets">("chats");
  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-1 flex-col p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-on-surface-variant">
          Mijozlar bilan jonli yozishma — har bir mijozga alohida xona. Tizim ma&apos;muriyati (E-Makon) ham vositachi sifatida
          qo&apos;shilishi mumkin.
        </p>
        <div className="flex gap-2">
          <FilterChip label="Suhbatlar" icon="forum" active={tab === "chats"} onClick={() => setTab("chats")} />
          <FilterChip label="Murojaat ticketlari" icon="support_agent" active={tab === "tickets"} onClick={() => setTab("tickets")} />
        </div>
      </div>
      {tab === "chats" ? (
        <Suspense fallback={<LoadingBlock />}>
          <ChatRooms />
        </Suspense>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Tickets />
        </div>
      )}
    </div>
  );
}
