"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ExcelButton, FilterChip, LiveBadge, LoadingBlock, StatusPill, inputClass } from "@/components/ui";
import { fetchAllPages } from "@/components/care/fetchAllPages";
import { api } from "@/lib/api/client";
import type { SupportMessage, SupportTicket, TicketPriority, TicketStatus } from "@/lib/api/types";
import { TICKET_STATUS_LABEL } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDateTime, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/providers/ToastProvider";
import { clockTime, dayKey, dayLabel, listTime } from "./chatUtils";

type Filter = "all" | "waiting" | TicketStatus;

const STATUS_TONE: Record<TicketStatus, "warning" | "info" | "success" | "neutral"> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_LABEL: Record<TicketPriority, string> = { low: "Past", normal: "Oddiy", high: "Yuqori" };
const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low: "bg-surface-container-high text-on-surface-variant",
  normal: "bg-sky-500/15 text-sky-300",
  high: "bg-error/15 text-error",
};

const TEMPLATES = [
  "Assalomu alaykum! Murojaatingiz qabul qilindi, tez orada javob beramiz.",
  "Firma bilan bog'landik, masala ko'rib chiqilmoqda.",
  "Muammo hal qilindi. Yana savollar bo'lsa, yozing!",
];

function lastActivity(t: SupportTicket) {
  const last = t.messages[t.messages.length - 1]?.created_at ?? "";
  return last > t.updated_at ? last : t.updated_at;
}

/** Oxirgi ochiq xabar mijozdan bo'lsa — javob kutilmoqda. */
function awaitingReply(t: SupportTicket) {
  if (t.status === "resolved" || t.status === "closed") return false;
  const visible = t.messages.filter((m) => !m.is_internal);
  return visible[visible.length - 1]?.sender === t.customer_id;
}

export function TicketsHub({ search }: { search: string }) {
  const { showError, showSuccess } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [priority, setPriority] = useState<"" | TicketPriority>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, loading, error, updatedAt, reload } = useAsync(
    () => fetchAllPages<SupportTicket>("/admin/support/", { search: search.trim() || undefined }, 5),
    [search],
    { keepPrevious: true },
  );

  const all = useMemo(() => [...(data?.results ?? [])].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))), [data]);
  const scoped = useMemo(() => all.filter((t) => !priority || t.priority === priority), [all, priority]);
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: scoped.length, waiting: 0 };
    for (const t of scoped) {
      map[t.status] = (map[t.status] ?? 0) + 1;
      if (awaitingReply(t)) map.waiting += 1;
    }
    return map;
  }, [scoped]);
  const rows = useMemo(
    () => scoped.filter((t) => (filter === "all" ? true : filter === "waiting" ? awaitingReply(t) : t.status === filter)),
    [scoped, filter],
  );

  const {
    data: detail,
    setData: setDetail,
    reload: reloadDetail,
  } = useAsync(async () => (selectedId ? api<SupportTicket>(`/admin/support/${selectedId}/`) : null), [selectedId], {
    live: 3000,
  });
  const fromList = all.find((t) => t.id === selectedId) ?? null;
  const selected = detail?.id === selectedId ? detail : fromList;

  async function patch(body: Partial<Pick<SupportTicket, "status" | "priority">>) {
    if (!selected) return;
    try {
      const fresh = await api<SupportTicket>(`/admin/support/${selected.id}/`, { method: "PATCH", body });
      setDetail(fresh);
      showSuccess(body.status ? `Holat: ${TICKET_STATUS_LABEL[body.status]}` : "Ustuvorlik yangilandi");
      void reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    }
  }

  async function reply(body: string, internal: boolean) {
    if (!selected) return false;
    try {
      const msg = await api<SupportMessage>(`/admin/support/${selected.id}/reply/`, {
        method: "POST",
        body: { body, is_internal: internal },
      });
      setDetail((prev) => (prev && prev.id === selected.id ? { ...prev, messages: [...prev.messages, msg] } : prev));
      void reloadDetail();
      void reload();
      return true;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Javob yuborilmadi");
      return false;
    }
  }

  function exportTickets() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`murojaatlar-${stamp}`, [
      {
        name: "Murojaatlar",
        headers: ["ID", "Mavzu", "Mijoz", "Telefon", "Holat", "Ustuvorlik", "Buyurtma", "Mas'ul", "Xabarlar", "Javob kutmoqda", "Yaratilgan", "Oxirgi faollik"],
        rows: rows.map((t) => [
          t.id,
          t.subject,
          t.customer_name,
          t.customer_phone,
          TICKET_STATUS_LABEL[t.status],
          PRIORITY_LABEL[t.priority],
          t.order ? `#${t.order}` : "",
          t.assigned_to_name,
          t.messages.length,
          awaitingReply(t) ? "Ha" : "Yo'q",
          t.created_at.replace("T", " ").slice(0, 16),
          lastActivity(t).replace("T", " ").slice(0, 16),
        ]),
      },
      {
        name: "Xabarlar",
        headers: ["Murojaat", "Vaqt", "Yuboruvchi", "Ichki", "Xabar"],
        rows: rows.flatMap((t) =>
          t.messages.map((m) => [t.id, m.created_at.replace("T", " ").slice(0, 16), m.sender_name, m.is_internal ? "Ha" : "", m.body]),
        ),
      },
    ]);
  }

  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-[520px] overflow-hidden rounded-2xl border border-[#26352c] bg-[#121614] shadow-lg shadow-black/20">
      <aside className={`min-h-0 w-full shrink-0 flex-col border-r border-[#26352c] md:flex md:w-[340px] xl:w-[380px] ${selected ? "hidden" : "flex"}`}>
        <div className="space-y-2.5 border-b border-[#26352c] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Murojaatlar <span className="text-on-surface-variant">({data?.count ?? 0})</span>
            </p>
            <div className="flex items-center gap-2">
              <LiveBadge updatedAt={updatedAt} className="hidden sm:inline-flex" />
              <ExcelButton onClick={exportTickets} disabled={!rows.length} label="" className="px-2.5! py-1.5!" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {(
              [
                ["all", "Barchasi"],
                ["waiting", "Javob kutmoqda"],
                ["open", TICKET_STATUS_LABEL.open],
                ["in_progress", TICKET_STATUS_LABEL.in_progress],
                ["resolved", TICKET_STATUS_LABEL.resolved],
                ["closed", TICKET_STATUS_LABEL.closed],
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <FilterChip key={id} label={label} count={counts[id] ?? 0} active={filter === id} onClick={() => setFilter(id)} />
            ))}
          </div>
          <select className={`${inputClass} py-2`} value={priority} onChange={(e) => setPriority(e.target.value as "" | TicketPriority)}>
            <option value="">Barcha ustuvorliklar</option>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <LoadingBlock />
          ) : error && !data ? (
            <EmptyState icon="error" title="Yuklanmadi" description={error} />
          ) : !rows.length ? (
            <EmptyState icon="support_agent" title="Murojaat yo'q" description="Mijoz ilovadan murojaat yuborsa, shu yerda ko'rinadi." />
          ) : (
            rows.map((t) => {
              const waiting = awaitingReply(t);
              const last = t.messages[t.messages.length - 1];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`flex w-full gap-3 border-b border-[#26352c]/50 px-3 py-3 text-left transition ${
                    t.id === selectedId ? "bg-primary/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1d2a21] text-sm font-bold text-primary">
                      {initials(t.customer_name || t.customer_phone)}
                    </div>
                    {waiting ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#121614] bg-amber-400" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${waiting ? "font-bold" : "font-semibold"}`}>{t.subject}</span>
                      <span className="shrink-0 text-[11px] text-on-surface-variant">{listTime(lastActivity(t))}</span>
                    </div>
                    <p className="truncate text-xs text-on-surface-variant">
                      #{t.id} · {t.customer_name || formatPhone(t.customer_phone)}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-on-surface-variant">{last ? `${last.is_internal ? "[ichki] " : ""}${last.body}` : ""}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {t.priority === "high" ? (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE.high}`}>Yuqori</span>
                        ) : null}
                        <StatusPill variant={STATUS_TONE[t.status]} className="px-2! py-0.5! text-[10px]!">
                          {TICKET_STATUS_LABEL[t.status]}
                        </StatusPill>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
        {selected ? (
          <TicketPane
            key={selected.id}
            ticket={selected}
            onBack={() => setSelectedId(null)}
            onPatch={(body) => void patch(body)}
            onReply={reply}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <EmptyState icon="support_agent" title="Murojaatni tanlang" description="Mijoz murojaatiga javob bering, holat va ustuvorlikni boshqaring." />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TicketPane({
  ticket: t,
  onBack,
  onPatch,
  onReply,
}: {
  ticket: SupportTicket;
  onBack: () => void;
  onPatch: (body: Partial<Pick<SupportTicket, "status" | "priority">>) => void;
  onReply: (body: string, internal: boolean) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [t.messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onReply(body, internal);
    setSending(false);
    if (ok) {
      setText("");
      setInternal(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="space-y-2 border-b border-[#26352c] px-3 py-3 sm:px-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-white/5 hover:text-on-surface md:hidden"
            aria-label="Ortga"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              <span className="mr-1.5 text-xs text-on-surface-variant">#{t.id}</span>
              {t.subject}
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              {t.customer_name || "Mijoz"} ·{" "}
              <a href={`tel:${t.customer_phone}`} className="hover:text-on-surface">
                {formatPhone(t.customer_phone)}
              </a>
              {t.order ? ` · Buyurtma #${t.order}` : ""} · {formatDateTime(t.created_at)}
              {t.assigned_to_name ? ` · Mas'ul: ${t.assigned_to_name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputClass} w-auto py-1.5 text-xs`}
            value={t.status}
            onChange={(e) => onPatch({ status: e.target.value as TicketStatus })}
            aria-label="Holat"
          >
            {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} w-auto py-1.5 text-xs`}
            value={t.priority}
            onChange={(e) => onPatch({ priority: e.target.value as TicketPriority })}
            aria-label="Ustuvorlik"
          >
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                Ustuvorlik: {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          {t.status !== "resolved" && t.status !== "closed" ? (
            <button
              type="button"
              onClick={() => onPatch({ status: "resolved" })}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              Yechildi
            </button>
          ) : null}
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#0e1210] px-3 py-4 sm:px-5">
        {t.messages.map((m, i) => {
          const fromCustomer = m.sender === t.customer_id;
          const newDay = i === 0 || dayKey(t.messages[i - 1].created_at) !== dayKey(m.created_at);
          return (
            <div key={m.id}>
              {newDay ? (
                <div className="flex justify-center py-2">
                  <span className="rounded-full border border-[#26352c] bg-[#151917] px-3 py-0.5 text-[11px] text-on-surface-variant">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              ) : null}
              <div className={`flex ${fromCustomer ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm sm:max-w-[70%] ${
                    m.is_internal
                      ? "border border-dashed border-amber-500/50 bg-amber-500/10"
                      : fromCustomer
                        ? "rounded-bl-md border border-[#26352c] bg-[#1b231e]"
                        : "rounded-br-md bg-primary-container/90 text-white"
                  }`}
                >
                  <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-75">
                    {m.is_internal ? <span className="material-symbols-outlined text-[14px] text-amber-300">lock</span> : null}
                    {m.sender_name || (fromCustomer ? t.customer_name || "Mijoz" : "Admin")}
                    {m.is_internal ? <span className="font-normal text-amber-300">· ichki eslatma</span> : null}
                  </p>
                  {m.body}
                  <p className="mt-0.5 text-right text-[10px] opacity-60">{clockTime(m.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {!t.messages.length ? <p className="py-10 text-center text-sm text-on-surface-variant">Xabarlar yo&apos;q</p> : null}
      </div>

      <div className="space-y-2 border-t border-[#26352c] p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl}
              type="button"
              onClick={() => setText(tpl)}
              className="shrink-0 truncate rounded-full border border-[#26352c] px-3 py-1 text-[11px] text-on-surface-variant hover:border-primary/40 hover:text-on-surface sm:max-w-[240px]"
              title={tpl}
            >
              {tpl}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={internal ? "Ichki eslatma — mijozga ko'rinmaydi..." : "Mijozga javob yozing..."}
            className={`${inputClass} max-h-40 resize-none ${internal ? "border-amber-500/50!" : ""}`}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            aria-label="Yuborish"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
              internal ? "bg-amber-400 text-black" : "bg-primary-container text-white hover:brightness-110"
            }`}
          >
            <span className={`material-symbols-outlined ${sending ? "animate-spin" : ""}`}>{sending ? "progress_activity" : "send"}</span>
          </button>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
          <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-amber-400" />
          Ichki eslatma (faqat adminlar ko&apos;radi)
        </label>
      </div>
    </div>
  );
}
