"use client";

import { useState } from "react";
import {
  Avatar,
  DataTable,
  Pagination,
  PrimaryButton,
  RowActions,
  StatusPill,
} from "@/components/ui";

const users = [
  {
    initials: "AR",
    name: "Azizbek Rustamov",
    phone: "+998 90 123 45 67",
    address: "Yunusabad, Tashkent",
    points: "1,250 ball",
    rating: "4.8",
    date: "12 Okt 2023",
    status: "FAOL" as const,
    blocked: false,
  },
  {
    initials: "MA",
    name: "Malika Alieva",
    phone: "+998 97 765 43 21",
    address: "Mirzo Ulugbek, Tashkent",
    points: "840 ball",
    rating: "4.5",
    date: "05 Noy 2023",
    status: "FAOL" as const,
    blocked: false,
  },
  {
    initials: "TK",
    name: "Timur Kasimov",
    phone: "+998 99 555 12 34",
    address: "Chilanzar, Tashkent",
    points: "120 ball",
    rating: "2.1",
    date: "20 Avg 2023",
    status: "BLOKLANGAN" as const,
    blocked: true,
  },
  {
    initials: "SJ",
    name: "Sardor Jalolov",
    phone: "+998 94 888 77 66",
    address: "Sergeli, Tashkent",
    points: "3,100 ball",
    rating: "5.0",
    date: "01 Yan 2024",
    status: "FAOL" as const,
    blocked: false,
  },
];

export default function FoydalanuvchilarPage() {
  const [tab, setTab] = useState<"all" | "active" | "blocked">("all");

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="relative inline-flex items-center gap-1.5 rounded-xl border border-[#26352c] bg-[#0e1211] p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-[13px] font-bold transition-all ${
              tab === "all"
                ? "border-l-4 border-primary-container/50 border-l-primary bg-gradient-to-r from-[#173822] to-[#1a231d] text-primary shadow-[0_0_15px_rgba(136,217,130,0.25)]"
                : "border-transparent font-medium text-on-surface-variant hover:bg-[#1a231d] hover:text-primary"
            }`}
          >
            {tab === "all" ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> : null}
            Barchasi
            <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
              248
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("active")}
            className="flex items-center gap-2 rounded-lg border border-transparent px-4 py-2.5 text-[13px] font-medium text-on-surface-variant transition-all hover:bg-[#1a231d] hover:text-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            Faol
            <span className="text-[11px] text-on-surface-variant/70">(241)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("blocked")}
            className="flex items-center gap-2 rounded-lg border border-transparent px-4 py-2.5 text-[13px] font-medium text-on-surface-variant transition-all hover:border-error/20 hover:bg-error-container/10 hover:text-error"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-error/60" />
            Bloklangan
            <span className="text-[11px] text-error/70">(7)</span>
          </button>
        </div>
        <PrimaryButton icon="person_add">Foydalanuvchi qo&apos;shish</PrimaryButton>
      </div>

      <DataTable
        headers={[
          <span key="a" className="block text-center">Avatar</span>,
          "Ism",
          "Telefon",
          <span key="m" className="hidden md:inline">Manzil</span>,
          <span key="b" className="hidden lg:inline">Ball</span>,
          <span key="r" className="hidden lg:inline">Reyting</span>,
          <span key="d" className="hidden xl:inline">Ro&apos;yxatdan o&apos;tgan sana</span>,
          <span key="s" className="block text-center">Holat</span>,
          <span key="x" className="block text-right">Amallar</span>,
        ]}
        footer={
          <Pagination
            info={
              <>
                Jami <strong className="font-semibold text-primary">248</strong> ta yozuvdan{" "}
                <span className="rounded-md border border-primary-container/40 bg-[#1a231d] px-2 py-0.5 font-medium text-white">
                  1 — 4
                </span>{" "}
                ko&apos;rsatilmoqda
              </>
            }
            pages={[1, 2, 3, 62]}
          />
        }
      >
        {users
          .filter((u) => {
            if (tab === "active") return !u.blocked;
            if (tab === "blocked") return u.blocked;
            return true;
          })
          .map((u) => (
            <tr
              key={u.name}
              className={`group border-b border-[#26352c]/30 transition-all duration-200 hover:bg-[#1c2420]/70 ${
                u.blocked ? "bg-[#1c1415]/40" : ""
              }`}
            >
              <td className="w-16 px-4 py-4 text-center">
                <Avatar initials={u.initials} tone={u.blocked ? "error" : "primary"} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className={`text-[14px] font-semibold text-white transition-colors ${u.blocked ? "group-hover:text-error" : "group-hover:text-primary"}`}>
                  {u.name}
                </div>
              </td>
              <td className="px-4 py-4 font-mono text-[13px] whitespace-nowrap text-on-surface-variant">
                {u.phone}
              </td>
              <td className="hidden px-4 py-4 text-[13px] whitespace-nowrap text-on-surface-variant md:table-cell">
                {u.address}
              </td>
              <td className="hidden px-4 py-4 whitespace-nowrap lg:table-cell">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-[#173822]/80 px-3 py-1 text-[12px] font-semibold text-primary">
                  <span className="material-symbols-outlined text-[15px]">token</span>
                  {u.points}
                </span>
              </td>
              <td className="hidden px-4 py-4 whitespace-nowrap lg:table-cell">
                <div className="inline-flex items-center gap-1 rounded-lg border border-primary-container/30 bg-[#1a231d] px-2.5 py-1 text-[13px] font-semibold text-tertiary">
                  <span className="material-symbols-outlined text-[15px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  {u.rating}
                </div>
              </td>
              <td className="hidden px-4 py-4 text-[13px] whitespace-nowrap text-on-surface-variant xl:table-cell">
                {u.date}
              </td>
              <td className="px-4 py-4 text-center whitespace-nowrap">
                <StatusPill
                  variant={u.blocked ? "error" : "success"}
                  pulse={!u.blocked}
                  className="text-[11px] font-bold tracking-wider uppercase"
                >
                  {u.status}
                </StatusPill>
              </td>
              <td className="px-4 py-4 text-right whitespace-nowrap">
                <RowActions
                  actions={
                    u.blocked
                      ? ["visibility", "edit", "lock_open", "more_vert"]
                      : ["visibility", "edit", "block", "more_vert"]
                  }
                />
              </td>
            </tr>
          ))}
      </DataTable>
    </div>
  );
}
