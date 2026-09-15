"use client";

import { useState } from "react";
import {
  FilterChip,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/ui";

const orders = [
  {
    id: "#ORD-9021",
    customer: "Sardor Jalolov",
    initials: "SJ",
    service: "Gazon o'rish",
    partner: "EcoMow Services",
    date: "08 Sen 2026",
    distance: "2.4 km",
    price: "$48.00",
    status: "Jarayonda" as const,
    tone: "info" as const,
  },
  {
    id: "#ORD-9020",
    customer: "Malika Alieva",
    initials: "MA",
    service: "Landshaft dizayni",
    partner: "GreenLine Scapes",
    date: "08 Sen 2026",
    distance: "5.1 km",
    price: "$320.00",
    status: "Yakunlangan" as const,
    tone: "success" as const,
  },
  {
    id: "#ORD-9019",
    customer: "Azizbek Rustamov",
    initials: "AR",
    service: "Sug'orish ta'miri",
    partner: "AquaDrop Systems",
    date: "07 Sen 2026",
    distance: "1.8 km",
    price: "$95.00",
    status: "Faol" as const,
    tone: "success" as const,
  },
  {
    id: "#ORD-9018",
    customer: "Dilnoza Rashidova",
    initials: "DR",
    service: "Daraxt butash",
    partner: "Urban Oasis Design",
    date: "07 Sen 2026",
    distance: "3.6 km",
    price: "$150.00",
    status: "Bekor qilingan" as const,
    tone: "error" as const,
  },
  {
    id: "#ORD-9017",
    customer: "Timur Kasimov",
    initials: "TK",
    service: "Zararkunanda nazorati",
    partner: "GreenThumb Co.",
    date: "06 Sen 2026",
    distance: "4.2 km",
    price: "$75.00",
    status: "Yakunlangan" as const,
    tone: "success" as const,
  },
];

export default function BuyurtmalarPage() {
  const [filter, setFilter] = useState("Barchasi");

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-2 shadow-lg backdrop-blur-md sm:flex-row">
        <div className="flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:pb-0">
          {["Barchasi", "Faol", "Tugallangan", "Bekor qilingan"].map((f) => (
            <FilterChip
              key={f}
              label={f}
              active={filter === f}
              onClick={() => setFilter(f)}
            />
          ))}
        </div>
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          <SecondaryButton icon="filter_list">Ko&apos;proq filtrlar</SecondaryButton>
          <PrimaryButton icon="add">Yangi buyurtma</PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[
          {
            label: "Bugungi jami buyurtmalar",
            value: "142",
            suffix: "ta buyurtma",
            icon: "shopping_bag",
            footer: (
              <>
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <span className="material-symbols-outlined text-base">trending_up</span>
                  +12.4%
                  <span className="font-normal text-[#8aa08e]">kechagiga nisbatan</span>
                </span>
                <span className="rounded-full border border-primary-container/40 bg-[#1b2f21] px-2 py-0.5 text-[11px] font-medium text-primary">
                  Faol
                </span>
              </>
            ),
          },
          {
            label: "Jarayondagi xizmatlar",
            value: "38",
            suffix: "xizmat ko'rsatilyapti",
            icon: "autorenew",
            footer: (
              <>
                <span className="flex items-center gap-2 text-[#8aa08e]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  9 mutaxassis yo&apos;lda
                </span>
                <span className="rounded-full bg-[#243527] px-2 py-0.5 text-[11px] font-medium text-[#9bd99b]">
                  29 ta joyida
                </span>
              </>
            ),
          },
          {
            label: "Bugungi daromad",
            value: "$4,250",
            suffix: ".00",
            icon: "payments",
            footer: (
              <>
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  +18.4%
                  <span className="font-normal text-[#8aa08e]">rejaga nisbatan</span>
                </span>
                <span className="text-[#8aa08e]">
                  O&apos;rtacha chek: <strong className="font-semibold text-white">$29.92</strong>
                </span>
              </>
            ),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-5 shadow-lg backdrop-blur-md transition-all hover:border-primary-container"
          >
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-[#8aa08e] uppercase">
                  {card.label}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-container/40 bg-[#1c2e20] text-primary shadow-[0_0_10px_rgba(46,125,50,0.2)] transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-xl">{card.icon}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight text-white md:text-4xl">{card.value}</p>
                <span className="text-xs text-[#8aa08e]">{card.suffix}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#1f2d22] pt-3 text-xs">
              {card.footer}
            </div>
          </div>
        ))}
      </div>

      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 shadow-xl backdrop-blur-md">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#1f2d22] bg-[#0e1510] text-xs font-semibold tracking-wider text-[#7e9982] uppercase">
                {["Buyurtma ID", "Mijoz", "Xizmat", "Hamkor", "Sana", "Masofa", "Narx", "Holat", "Harakat"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-4 whitespace-nowrap ${i >= 6 ? (i === 7 ? "text-center" : "text-right") : ""}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b271d] text-sm text-on-surface">
              {orders.map((o) => (
                <tr key={o.id} className="group transition-colors hover:bg-[#172219]/70">
                  <td className="px-5 py-4 font-semibold">
                    <span className="rounded-full border border-primary-container/40 bg-[#16261a] px-2.5 py-1 font-mono text-xs font-semibold text-primary shadow-[0_0_10px_rgba(46,125,50,0.15)]">
                      {o.id}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary-container/50 bg-[#1b2a1e] text-xs font-bold text-primary shadow-sm">
                        {o.initials}
                      </div>
                      <span className="font-medium">{o.customer}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">{o.service}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{o.partner}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-on-surface-variant">{o.date}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{o.distance}</td>
                  <td className="px-5 py-4 text-right font-semibold">{o.price}</td>
                  <td className="px-5 py-4 text-center">
                    <StatusPill variant={o.tone}>{o.status}</StatusPill>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
