"use client";

import { useEffect, useState } from "react";
import { TabBar, inputClass } from "@/components/ui";
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
    <div className="mx-auto w-full max-w-[1440px] flex-1 space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-on-surface-variant md:text-base">
            Mijoz ↔ firma yozishmalarini real vaqtda kuzating, E-Makon nomidan aralashing va yordam murojaatlariga javob bering.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            className={`${inputClass} pl-10`}
            placeholder={tab === "chats" ? "Mijoz, firma yoki xabar..." : "Mavzu, mijoz yoki telefon..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "chats", label: "Mijoz ↔ Firma chatlari", icon: "forum", count: badges?.chats || undefined },
          { id: "tickets", label: "Murojaatlar", icon: "support_agent", count: badges?.tickets || undefined },
        ]}
      />

      {tab === "chats" ? <ChatHub search={term} /> : <TicketsHub search={term} />}
    </div>
  );
}
