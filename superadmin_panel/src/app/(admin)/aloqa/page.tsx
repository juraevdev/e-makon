"use client";

import { useEffect, useState } from "react";
import { PageHeader, TabBar, inputClass } from "@/components/ui";
import { ChatHub } from "@/components/chat/ChatHub";
import { TicketsHub } from "@/components/chat/TicketsHub";
import { api, asPage } from "@/lib/api/client";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

type Tab = "chats" | "tickets";

export default function AloqaPage() {
  const { query } = useSearch();
  const [tab, setTab] = useState<Tab>("chats");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setTerm((search || query).trim()), 350);
    return () => window.clearTimeout(id);
  }, [search, query]);

  const { data: badges } = useAsync(
    async () => {
      const [unread, open] = await Promise.all([
        api<{ unread: number }>("/admin/chats/unread/"),
        api("/admin/support/", { query: { status: "open", page_size: 1 } }),
      ]);
      return { chats: unread.unread, tickets: asPage(open).count };
    },
    [],
    { live: 4000 },
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-hidden px-4 py-4 md:px-8 md:py-5">
      <PageHeader
        className="mb-3 shrink-0 md:mb-4"
        title="Aloqa markazi"
        description="Mijoz ↔ firma yozishmalarini kuzating, E-Makon nomidan aralashing va murojaatlarga javob bering."
        actions={
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-ink-muted">
              search
            </span>
            <input
              className={`${inputClass} h-10 pl-10`}
              placeholder={tab === "chats" ? "Mijoz, firma yoki xabar..." : "Mavzu, mijoz yoki telefon..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Qidiruv"
            />
          </div>
        }
      />

      <TabBar<Tab>
        className="mb-3 shrink-0 md:mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "chats", label: "Mijoz ↔ Firma", icon: "forum", count: badges?.chats || undefined },
          { id: "tickets", label: "Murojaatlar", icon: "support_agent", count: badges?.tickets || undefined },
        ]}
      />

      <div className="min-h-0 flex-1">
        {tab === "chats" ? <ChatHub search={term} /> : <TicketsHub search={term} />}
      </div>
    </div>
  );
}
