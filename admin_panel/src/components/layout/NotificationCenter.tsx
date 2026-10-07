"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, asPage } from "@/lib/api/client";
import type { FirmStats, Order } from "@/lib/api/types";
import { formatPhone, relativeTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useFirm } from "@/providers/FirmProvider";
import { useToast } from "@/providers/ToastProvider";

type SystemNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: number | null;
  read: boolean;
  created_at: string;
};

const ENTITY_ROUTE: Record<string, string> = {
  order: "/buyurtmalar",
  service: "/xizmatlar",
  care_contract: "/parvarish",
  chat: "/aloqa",
  firm: "/firma",
};

const POLL_MS = 5000;

/** Sarlavhadagi qo'ng'iroqcha: yangi buyurtmalar, suhbatlar, ma'muriyat xabarlari va tizim bildirishnomalari. */
export function NotificationCenter() {
  const pathname = usePathname();
  const router = useRouter();
  const { firm } = useFirm();
  const { showInfo } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const seenOrderId = useRef<number | null>(null);

  const { data: newOrders } = useAsync(
    async () => {
      const page = asPage<Order>(
        await api("/admin/orders/", { query: { status: "new", page_size: 6, ordering: "-created_at" } }),
      );
      const maxId = page.results.reduce((m, o) => Math.max(m, o.id), 0);
      const prev = seenOrderId.current;
      seenOrderId.current = Math.max(prev ?? 0, maxId);
      if (prev !== null && pathname !== "/buyurtmalar") {
        const fresh = page.results.filter((o) => o.id > prev);
        if (fresh.length === 1) {
          showInfo(`Yangi buyurtma #${fresh[0].id}: ${fresh[0].service_name}`);
        } else if (fresh.length > 1) {
          showInfo(`${fresh.length} ta yangi buyurtma keldi`);
        }
      }
      return page;
    },
    [],
    { live: POLL_MS },
  );

  const { data: chat } = useAsync(
    () => api<{ unread: number }>("/admin/chats/unread/").catch(() => ({ unread: 0 })),
    [],
    { live: POLL_MS },
  );

  const { data: system } = useAsync(
    async () =>
      asPage<SystemNotification>(await api("/notifications/", { query: { page_size: 15 } }).catch(() => [])).results,
    [],
    { live: POLL_MS },
  );

  const { data: stats } = useAsync(
    async () => (firm ? api<FirmStats>(`/admin/firms/${firm.id}/stats/`).catch(() => null) : null),
    [firm?.id],
    { live: 15000 },
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const newCount = newOrders?.count ?? 0;
  const chatUnread = chat?.unread ?? 0;
  const unreadMessages = (stats?.messages ?? []).filter((m) => !m.is_read);
  const notifications = system ?? [];
  const unreadSystem = notifications.filter((n) => !n.read).length;
  const total = newCount + chatUnread + unreadMessages.length + unreadSystem;

  async function openNotification(n: SystemNotification) {
    setOpen(false);
    if (!n.read) await api(`/notifications/${n.id}/read/`, { method: "POST" }).catch(() => undefined);
    const route = ENTITY_ROUTE[n.entity_type];
    if (route) router.push(route);
  }

  async function readAll() {
    await api("/notifications/read-all/", { method: "POST" }).catch(() => undefined);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Bildirishnomalar"
        aria-expanded={open}
        className={`relative rounded-full border p-2 transition-colors ${
          open
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-surface-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {total ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Bildirishnomalar"
          className="fixed right-2 top-16 z-[70] flex max-h-[min(75dvh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#121614] shadow-2xl shadow-black/50 sm:absolute sm:right-0 sm:top-full sm:mt-2"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#26352c] px-4 py-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-on-surface">Bildirishnomalar</p>
              <p className="text-xs text-on-surface-variant">Har {POLL_MS / 1000} soniyada yangilanadi</p>
            </div>
            {unreadSystem ? (
              <button
                type="button"
                onClick={() => void readAll()}
                className="shrink-0 rounded-full border border-[#26352c] px-3 py-1 text-xs text-on-surface-variant hover:text-primary"
              >
                Hammasi o&apos;qildi
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {newCount ? (
              <Section title={`Yangi buyurtmalar · ${newCount}`}>
                {(newOrders?.results ?? []).map((o) => (
                  <Item
                    key={o.id}
                    href="/buyurtmalar"
                    icon="fiber_new"
                    tone="warning"
                    title={`#${o.id} · ${o.service_name}`}
                    body={`${o.customer_name || formatPhone(o.customer_phone)} · ${o.time_slot || "vaqt belgilanmagan"}`}
                    time={relativeTime(o.created_at)}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </Section>
            ) : null}

            {chatUnread || unreadMessages.length ? (
              <Section title="Xabarlar">
                {chatUnread ? (
                  <Item
                    href="/aloqa"
                    icon="chat"
                    tone="primary"
                    title={`${chatUnread} ta o'qilmagan mijoz xabari`}
                    body="Murojaatlar bo'limida javob bering"
                    onNavigate={() => setOpen(false)}
                  />
                ) : null}
                {unreadMessages.slice(0, 5).map((m) => (
                  <Item
                    key={m.id}
                    href="/firma"
                    icon={m.kind === "warning" ? "warning" : "campaign"}
                    tone={m.kind === "warning" ? "error" : "primary"}
                    title={m.subject || "E-MAKON ma'muriyati xabari"}
                    body={m.body}
                    time={relativeTime(m.created_at)}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </Section>
            ) : null}

            <Section title="Tizim">
              {notifications.length ? (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void openNotification(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                      n.read ? "" : "bg-primary/5"
                    }`}
                  >
                    <span className="relative mt-0.5 shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">notifications</span>
                      {!n.read ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-on-surface">{n.title}</span>
                      {n.body ? (
                        <span className="mt-0.5 line-clamp-2 block break-words text-xs text-on-surface-variant">{n.body}</span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-on-surface-variant">{relativeTime(n.created_at)}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-on-surface-variant">Hozircha bildirishnoma yo&apos;q</p>
              )}
            </Section>
          </div>

          {pathname !== "/buyurtmalar" ? (
            <Link
              href="/buyurtmalar"
              onClick={() => setOpen(false)}
              className="shrink-0 border-t border-[#26352c] px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary/5"
            >
              Buyurtmalarga o&apos;tish
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-[#26352c]/60 last:border-b-0">
      <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{title}</p>
      {children}
    </div>
  );
}

function Item({
  href,
  icon,
  tone,
  title,
  body,
  time,
  onNavigate,
}: {
  href: string;
  icon: string;
  tone: "primary" | "warning" | "error";
  title: string;
  body?: string;
  time?: string;
  onNavigate: () => void;
}) {
  const iconTone = { primary: "text-primary", warning: "text-amber-300", error: "text-error" }[tone];
  return (
    <Link href={href} onClick={onNavigate} className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/5">
      <span className={`material-symbols-outlined mt-0.5 shrink-0 text-[20px] ${iconTone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium text-on-surface">{title}</span>
        {body ? <span className="mt-0.5 line-clamp-2 block break-words text-xs text-on-surface-variant">{body}</span> : null}
        {time ? <span className="mt-1 block text-[11px] text-on-surface-variant">{time}</span> : null}
      </span>
    </Link>
  );
}
