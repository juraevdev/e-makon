"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LoadingBlock, inputClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { ChatMessage, ChatRoom } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
import { formatPhone, initials } from "@/lib/format";
import { usePolling } from "@/hooks/usePolling";
import { useToast } from "@/providers/ToastProvider";
import { clockTime, dayKey, dayLabel } from "./chatUtils";

const POLL_MS = 2500;
const MAX_BODY = 4000;

type Outgoing = { tempId: string; body: string; created_at: string; failed: boolean };

function merge(current: ChatMessage[], fresh: ChatMessage[]) {
  if (!fresh.length) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of fresh) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

const ROLE_LABEL: Record<ChatMessage["sender_role"], string> = {
  customer: "Mijoz",
  firm: "Firma",
  platform: "E-Makon",
};

export function ConversationPane({ room, onBack }: { room: ChatRoom; onBack: () => void }) {
  const { showError } = useToast();
  const [items, setItems] = useState<ChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(true);
  const [seenTotal, setSeenTotal] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const polling = useRef(false);
  const lastCount = useRef(0);

  const load = useCallback(() => {
    api<ChatMessage[]>(`/admin/chats/${room.id}/messages/`)
      .then((list) => setItems((prev) => merge(prev ?? [], list)))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Xabarlar yuklanmadi"));
  }, [room.id]);

  useEffect(() => {
    load();
  }, [load]);

  function retryLoad() {
    setLoadError("");
    load();
  }

  usePolling(
    () => {
      if (!items || polling.current) return;
      polling.current = true;
      const after = items.length ? items[items.length - 1].id : 0;
      api<ChatMessage[]>(`/admin/chats/${room.id}/messages/`, { query: { after } })
        .then((fresh) => {
          if (fresh.length) setItems((prev) => merge(prev ?? [], fresh));
        })
        .catch(() => undefined)
        .finally(() => {
          polling.current = false;
        });
    },
    POLL_MS,
    items !== null,
  );

  const total = (items?.length ?? 0) + outgoing.length;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || items === null) return;
    const grew = total > lastCount.current;
    lastCount.current = total;
    if (grew && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [total, items]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottom.current = bottom;
    setPinned(bottom);
    if (bottom) setSeenTotal(total);
  }

  function jumpDown() {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    atBottom.current = true;
    setPinned(true);
    setSeenTotal(total);
  }

  const unseen = pinned ? 0 : Math.max(0, total - seenTotal);

  async function deliver(out: Outgoing) {
    try {
      const msg = await api<ChatMessage>(`/admin/chats/${room.id}/send/`, { method: "POST", body: { body: out.body } });
      setItems((prev) => merge(prev ?? [], [msg]));
      setOutgoing((list) => list.filter((o) => o.tempId !== out.tempId));
    } catch (err) {
      setOutgoing((list) => list.map((o) => (o.tempId === out.tempId ? { ...o, failed: true } : o)));
      showError(err instanceof Error ? err.message : "Xabar yuborilmadi");
    }
  }

  function send() {
    const body = text.trim();
    if (!body || body.length > MAX_BODY) return;
    const out: Outgoing = { tempId: `${Date.now()}-${Math.random()}`, body, created_at: new Date().toISOString(), failed: false };
    atBottom.current = true;
    setPinned(true);
    setOutgoing((list) => [...list, out]);
    setText("");
    void deliver(out);
  }

  function retry(out: Outgoing) {
    setOutgoing((list) => list.map((o) => (o.tempId === out.tempId ? { ...o, failed: false } : o)));
    void deliver({ ...out, failed: false });
  }

  /** Oxirgi N ta qarshi tomon xabari hali o'qilmagan (backend `*_unread` hisoblagichlari). */
  const readState = useMemo(() => {
    const unreadIds = new Set<number>();
    if (!items) return unreadIds;
    let customerLeft = room.customer_unread;
    let firmLeft = room.firm_unread;
    for (let i = items.length - 1; i >= 0 && (customerLeft > 0 || firmLeft > 0); i--) {
      const m = items[i];
      if (m.sender_role === "customer") {
        if (firmLeft > 0) {
          unreadIds.add(m.id);
          firmLeft--;
        }
      } else if (customerLeft > 0) {
        unreadIds.add(m.id);
        customerLeft--;
      }
    }
    return unreadIds;
  }, [items, room.customer_unread, room.firm_unread]);

  function exportThread() {
    downloadExcel(`suhbat-${room.id}-${new Date().toISOString().slice(0, 10)}`, {
      name: `Suhbat ${room.id}`,
      headers: ["ID", "Vaqt", "Kim", "Yuboruvchi", "Xabar", "Buyurtma"],
      rows: (items ?? []).map((m) => [m.id, m.created_at.replace("T", " ").slice(0, 19), ROLE_LABEL[m.sender_role], m.sender_name, m.body, m.order ? `#${m.order}` : ""]),
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-[#26352c] px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1.5 text-on-surface-variant hover:bg-white/5 hover:text-on-surface md:hidden"
          aria-label="Ortga"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {initials(room.customer_name || room.customer_phone)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span className="truncate">{room.customer_name}</span>
            <span className="material-symbols-outlined shrink-0 text-[16px] text-on-surface-variant">sync_alt</span>
            <Link href={`/firmalar/${room.firm_id}`} className="truncate text-primary hover:underline">
              {room.firm_name}
            </Link>
          </p>
          <p className="truncate text-xs text-on-surface-variant">
            Mijoz:{" "}
            <a href={`tel:${room.customer_phone}`} className="hover:text-on-surface">
              {formatPhone(room.customer_phone)}
            </a>
            {room.firm_phone ? (
              <>
                {" · "}Firma:{" "}
                <a href={`tel:${room.firm_phone}`} className="hover:text-on-surface">
                  {formatPhone(room.firm_phone)}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={exportThread}
          disabled={!items?.length}
          title="Suhbatni Excelga yuklab olish"
          className="rounded-full p-2 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[20px]">table_view</span>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full space-y-1.5 overflow-y-auto bg-[#0e1210] px-3 py-4 sm:px-5">
          {items === null ? (
            loadError ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-error">
                {loadError}
                <button type="button" onClick={retryLoad} className="rounded-full border border-[#26352c] px-4 py-2 text-on-surface">
                  Qayta urinish
                </button>
              </div>
            ) : (
              <LoadingBlock label="Xabarlar yuklanmoqda..." />
            )
          ) : !items.length && !outgoing.length ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[36px] text-primary/60">forum</span>
              Hali xabar yo&apos;q
            </div>
          ) : null}

          {items?.map((m, i) => {
            const newDay = i === 0 || dayKey(items[i - 1].created_at) !== dayKey(m.created_at);
            const grouped = !newDay && i > 0 && items[i - 1].sender_role === m.sender_role;
            return (
              <Fragment key={m.id}>
                {newDay ? (
                  <div className="sticky top-0 z-10 flex justify-center py-2">
                    <span className="rounded-full border border-[#26352c] bg-[#151917]/95 px-3 py-0.5 text-[11px] text-on-surface-variant backdrop-blur">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                ) : null}
                <Bubble message={m} grouped={grouped} read={!readState.has(m.id)} />
              </Fragment>
            );
          })}

          {outgoing.map((o) => (
            <div key={o.tempId} className="flex justify-end">
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border px-3.5 py-2 text-sm sm:max-w-[70%] ${
                  o.failed ? "border-error/50 bg-error/10" : "border-amber-500/40 bg-amber-500/15 opacity-80"
                }`}
              >
                {o.body}
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                  {o.failed ? (
                    <button type="button" onClick={() => retry(o)} className="inline-flex items-center gap-1 font-semibold text-error">
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      Yuborilmadi — qayta urinish
                    </button>
                  ) : (
                    <>
                      {clockTime(o.created_at)}
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        {unseen > 0 ? (
          <button
            type="button"
            onClick={jumpDown}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-primary/40 bg-[#1b2a1e] px-3.5 py-1.5 text-xs font-semibold text-primary shadow-lg"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            {unseen} ta yangi xabar
          </button>
        ) : null}
      </div>

      <form
        className="border-t border-[#26352c] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={text}
            maxLength={MAX_BODY}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="E-Makon nomidan yozish — mijoz ham, firma ham ko'radi..."
            className={`${inputClass} max-h-32 min-h-[44px] resize-none`}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Yuborish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-black transition hover:bg-amber-300 disabled:opacity-40"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        <p className="mt-1.5 flex justify-between gap-2 text-[11px] text-on-surface-variant">
          <span>Enter — yuborish, Shift+Enter — yangi qator. Siz o&apos;qiganingiz firma uchun &quot;o&apos;qildi&quot; deb belgilanmaydi.</span>
          {text.length > MAX_BODY * 0.8 ? <span>{text.length}/{MAX_BODY}</span> : null}
        </p>
      </form>
    </div>
  );
}

function Bubble({ message: m, grouped, read }: { message: ChatMessage; grouped: boolean; read: boolean }) {
  const left = m.sender_role === "customer";
  const style =
    m.sender_role === "platform"
      ? "border border-amber-500/40 bg-amber-500/15"
      : m.sender_role === "firm"
        ? "bg-primary-container/90 text-white"
        : "border border-[#26352c] bg-[#1b231e]";
  const corner = left ? "rounded-bl-md" : "rounded-br-md";
  return (
    <div className={`flex ${left ? "justify-start" : "justify-end"} ${grouped ? "" : "pt-1.5"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm sm:max-w-[70%] ${style} ${grouped ? "" : corner}`}>
        {!grouped ? (
          <p className={`mb-0.5 text-[11px] font-semibold ${m.sender_role === "platform" ? "text-amber-300" : "opacity-75"}`}>
            {m.sender_name}
            <span className="ml-1 font-normal opacity-70">· {ROLE_LABEL[m.sender_role]}</span>
          </p>
        ) : null}
        {m.body}
        {m.order ? (
          <Link href="/buyurtmalar" className="mt-1 block text-[11px] font-semibold underline opacity-80">
            Buyurtma #{m.order}
          </Link>
        ) : null}
        <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] opacity-60">
          {clockTime(m.created_at)}
          <span
            className={`material-symbols-outlined text-[14px] ${read ? "text-sky-300 opacity-100" : ""}`}
            title={read ? "Qabul qiluvchi o'qidi" : "Yetkazildi, hali o'qilmagan"}
          >
            {read ? "done_all" : "done"}
          </span>
        </p>
      </div>
    </div>
  );
}
