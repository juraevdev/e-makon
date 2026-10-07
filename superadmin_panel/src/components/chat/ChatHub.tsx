"use client";

import { useMemo, useState } from "react";
import { EmptyState, ExcelButton, FilterChip, LiveBadge, LoadingBlock, inputClass } from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { ChatRoom, PartnerFirm } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
import { formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { ConversationPane } from "./ConversationPane";
import { listTime, minutesSince } from "./chatUtils";

/** Firma shu vaqtdan ko'proq javob bermasa — kechikkan deb belgilanadi. */
const LATE_MINUTES = 60;

export function ChatHub({ search }: { search: string }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pickedRoom, setPickedRoom] = useState<ChatRoom | null>(null);
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [firmId, setFirmId] = useState("");

  const { data: rooms, loading, error, updatedAt, reload } = useAsync(
    async () =>
      asPage<ChatRoom>(
        await api("/admin/chats/", {
          query: {
            page_size: 100,
            search: search.trim() || undefined,
            unread: onlyWaiting ? 1 : undefined,
            organization: firmId || undefined,
          },
        }),
      ),
    [search, onlyWaiting, firmId],
    { keepPrevious: true, live: 3000 },
  );
  const { data: firms } = useAsync(
    async () => asPage<PartnerFirm>(await api("/admin/firms/", { query: { page_size: 100 } })).results,
    [],
    { live: false },
  );

  const list = useMemo(() => rooms?.results ?? [], [rooms]);
  const active = list.find((r) => r.id === activeId) ?? (pickedRoom?.id === activeId ? pickedRoom : null);
  const waiting = list.filter((r) => r.firm_unread > 0).length;

  function exportRooms() {
    downloadExcel(`suhbatlar-${new Date().toISOString().slice(0, 10)}`, {
      name: "Suhbatlar",
      headers: [
        "ID",
        "Mijoz",
        "Mijoz telefoni",
        "Firma",
        "Firma telefoni",
        "Oxirgi xabar",
        "Oxirgi xabar vaqti",
        "Firma o'qimagan",
        "Mijoz o'qimagan",
        "Yaratilgan",
      ],
      rows: list.map((r) => [
        r.id,
        r.customer_name,
        r.customer_phone,
        r.firm_name,
        r.firm_phone,
        r.last_message_preview,
        r.last_message_at ? r.last_message_at.replace("T", " ").slice(0, 16) : "",
        r.firm_unread,
        r.customer_unread,
        r.created_at.slice(0, 10),
      ]),
    });
  }

  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-[520px] overflow-hidden rounded-2xl border border-[#26352c] bg-[#121614] shadow-lg shadow-black/20">
      <aside className={`min-h-0 w-full shrink-0 flex-col border-r border-[#26352c] md:flex md:w-[340px] xl:w-[380px] ${active ? "hidden" : "flex"}`}>
        <div className="space-y-2.5 border-b border-[#26352c] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Suhbatlar <span className="text-on-surface-variant">({rooms?.count ?? 0})</span>
            </p>
            <div className="flex items-center gap-2">
              <LiveBadge updatedAt={updatedAt} className="hidden sm:inline-flex" />
              <ExcelButton onClick={exportRooms} disabled={!list.length} label="" className="px-2.5! py-1.5!" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <FilterChip label="Barchasi" active={!onlyWaiting} onClick={() => setOnlyWaiting(false)} />
            <FilterChip
              label="Javob kutmoqda"
              icon="mark_chat_unread"
              count={onlyWaiting ? rooms?.count : waiting || undefined}
              active={onlyWaiting}
              onClick={() => setOnlyWaiting(true)}
            />
          </div>
          <select className={`${inputClass} py-2`} value={firmId} onChange={(e) => setFirmId(e.target.value)}>
            <option value="">Barcha firmalar</option>
            {(firms ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <LoadingBlock />
          ) : error && !rooms ? (
            <EmptyState
              icon="error"
              title="Yuklanmadi"
              description={error}
              action={
                <button type="button" onClick={() => void reload()} className="text-sm font-semibold text-primary">
                  Qayta urinish
                </button>
              }
            />
          ) : !list.length ? (
            <EmptyState
              icon="forum"
              title={search || onlyWaiting || firmId ? "Mos suhbat topilmadi" : "Suhbatlar yo'q"}
              description="Mijoz firmaga ilovadan yozganda suhbat shu yerda paydo bo'ladi."
            />
          ) : (
            list.map((r) => {
              const late = r.firm_unread > 0 && minutesSince(r.last_message_at) >= LATE_MINUTES;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setActiveId(r.id);
                    setPickedRoom(r);
                  }}
                  className={`flex w-full gap-3 border-b border-[#26352c]/50 px-3 py-3 text-left transition ${
                    r.id === activeId ? "bg-primary/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1d2a21] text-sm font-bold text-primary">
                      {initials(r.customer_name || r.customer_phone)}
                    </div>
                    {r.firm_unread ? (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#121614] bg-amber-400" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${r.firm_unread ? "font-bold" : "font-semibold"}`}>{r.customer_name}</span>
                      <span className={`shrink-0 text-[11px] ${r.firm_unread ? "text-amber-300" : "text-on-surface-variant"}`}>
                        {listTime(r.last_message_at || r.created_at)}
                      </span>
                    </div>
                    <p className="flex items-center gap-1 truncate text-xs text-primary">
                      <span className="material-symbols-outlined text-[14px]">storefront</span>
                      <span className="truncate">{r.firm_name}</span>
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${r.firm_unread ? "text-on-surface" : "text-on-surface-variant"}`}>
                        {r.last_message_preview || "Yangi suhbat"}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {late ? (
                          <span className="rounded-full bg-error/15 px-1.5 py-0.5 text-[10px] font-semibold text-error" title="Firma 1 soatdan ko'p javob bermagan">
                            Kechikkan
                          </span>
                        ) : null}
                        {r.firm_unread ? (
                          <span
                            className="min-w-[20px] rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[10px] font-bold text-black"
                            title="Firma o'qimagan mijoz xabarlari"
                          >
                            {r.firm_unread}
                          </span>
                        ) : null}
                        {r.customer_unread ? (
                          <span
                            className="min-w-[20px] rounded-full bg-sky-500/20 px-1.5 py-0.5 text-center text-[10px] font-semibold text-sky-300"
                            title="Mijoz o'qimagan xabarlar"
                          >
                            {r.customer_unread}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[#26352c] px-3 py-2 text-[10px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Firma o&apos;qimagan
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Mijoz o&apos;qimagan
          </span>
        </div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-1 flex-col ${active ? "flex" : "hidden md:flex"}`}>
        {active ? (
          <ConversationPane key={active.id} room={active} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <EmptyState
                icon="visibility"
                title="Suhbatni tanlang"
                description="Firma va mijoz yozishmasini real vaqtda kuzating, kerak bo'lsa E-Makon nomidan aralashing."
              />
              {waitingHint(list)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function waitingHint(list: ChatRoom[]) {
  const waiting = list.filter((r) => r.firm_unread > 0);
  if (!waiting.length) return null;
  const oldest = [...waiting].sort((a, b) => (a.last_message_at ?? "").localeCompare(b.last_message_at ?? ""))[0];
  return (
    <p className="mx-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-200">
      {waiting.length} ta suhbatda firma javobi kutilmoqda. Eng eskisi: <b>{oldest.firm_name}</b> ↔ {oldest.customer_name} (
      {formatPhone(oldest.customer_phone)}).
    </p>
  );
}
