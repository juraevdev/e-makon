"use client";

import { useState } from "react";
import { FilterChip, PrimaryButton, SecondaryButton } from "@/components/ui";

const periods = ["Shu oy", "Oxirgi kvartal", "Yil boshidan", "Ixtiyoriy davr"];

const kpis = [
  {
    label: "Jami daromad",
    sub: "Yalpi sof tushum",
    value: "$124,500",
    suffix: ".00",
    change: "+14.5%",
    meta: <>Reja: <strong className="font-semibold text-[#f1f5f2]">94%</strong></>,
    progress: 94,
    icon: "payments",
  },
  {
    label: "Buyurtmalar hajmi",
    sub: "Muvaffaqiyatli xizmatlar",
    value: "3,492",
    suffix: "dona",
    change: "+8.2%",
    meta: <>Kuniga: <strong className="font-semibold text-[#f1f5f2]">116 ta</strong></>,
    progress: 82,
    icon: "local_mall",
  },
  {
    label: "Faol hamkorlar",
    sub: "Onlayn pudratchilar",
    value: "184",
    suffix: "tashkilot",
    change: "0.0%",
    meta: <>Yangi: <strong className="font-semibold text-primary">+12 ta</strong></>,
    progress: 70,
    icon: "handshake",
    mutedBar: true,
  },
  {
    label: "O'rtacha chek",
    sub: "Bitta buyurtma qiymati",
    value: "$35.65",
    suffix: "USD",
    change: "+2.1%",
    meta: <>Maqsad: <strong className="font-semibold text-[#f1f5f2]">$40.00</strong></>,
    progress: 65,
    icon: "receipt_long",
  },
];

const regions = [
  { name: "Toshkent", value: 42, amount: "$52.4k" },
  { name: "Samarqand", value: 28, amount: "$31.2k" },
  { name: "Farg'ona", value: 18, amount: "$21.8k" },
  { name: "Boshqa", value: 12, amount: "$19.1k" },
];

const categories = [
  { name: "Landshaft", pct: 38, color: "bg-primary" },
  { name: "Sug'orish", pct: 24, color: "bg-tertiary" },
  { name: "Gazon", pct: 20, color: "bg-primary-container" },
  { name: "Daraxt", pct: 18, color: "bg-outline" },
];

export default function HisobotlarPage() {
  const [period, setPeriod] = useState("Shu oy");

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-5 py-2 text-sm transition-all ${
                period === p
                  ? "border-primary/40 bg-[#16271c] font-semibold text-primary shadow-[0_0_15px_rgba(46,125,50,0.2)]"
                  : "border-[#233527]/60 bg-[#111613] font-medium text-[#9ea7a0] hover:border-primary-container/50 hover:bg-[#162119] hover:text-[#d0e5d6]"
              }`}
            >
              {period === p ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> : null}
              {p === "Ixtiyoriy davr" ? (
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              ) : null}
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <SecondaryButton icon="picture_as_pdf">PDF hisobot</SecondaryButton>
          <PrimaryButton icon="download">Excel eksport</PrimaryButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-12">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="group relative overflow-hidden rounded-2xl border border-[#233527]/70 bg-[#111613] p-5 transition-all duration-300 hover:border-primary-container/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] md:col-span-3"
          >
            <div className="relative z-10 mb-3 flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider text-[#8c978f] uppercase">{k.label}</span>
                <p className="mt-0.5 text-xs text-[#707c74]">{k.sub}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-container/40 bg-[#1a291e] text-primary shadow-sm transition-all group-hover:scale-105">
                <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
              </div>
            </div>
            <div className="relative z-10">
              <div className="flex items-baseline gap-1 text-3xl font-extrabold tracking-tight text-[#f1f5f2]">
                {k.value}
                <span className="text-sm font-normal text-[#707c74]">{k.suffix}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 whitespace-nowrap border-t border-[#233527]/60 pt-3">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary-container/40 bg-[#16271c] px-2.5 py-1 text-xs font-semibold text-primary">
                  <span className="material-symbols-outlined text-[13px]">trending_up</span>
                  {k.change}
                </span>
                <span className="truncate text-xs text-[#707c74]">{k.meta}</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full border border-[#233527]/60 bg-[#162119]">
                <div
                  className={`h-full rounded-full ${k.mutedBar ? "bg-outline" : "bg-primary"}`}
                  style={{ width: `${k.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-6 lg:col-span-8">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">show_chart</span>
              <h3 className="text-lg font-semibold text-on-surface">Daromad tendensiyasi</h3>
            </div>
            <FilterChip label="12 oy" active />
          </div>
          <div className="flex h-64 items-end gap-2 px-2">
            {[42, 55, 48, 68, 72, 65, 80, 78, 90, 85, 94, 100].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary-container to-primary/80 opacity-80 transition-opacity hover:opacity-100"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] text-on-surface-variant">
                  {["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-6">
            <h3 className="mb-4 text-lg font-semibold text-on-surface">Hududlar bo&apos;yicha</h3>
            <div className="space-y-4">
              {regions.map((r) => (
                <div key={r.name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-on-surface">{r.name}</span>
                    <span className="font-semibold text-primary">{r.amount}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#162119]">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${r.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-6">
            <h3 className="mb-4 text-lg font-semibold text-on-surface">Xizmat toifalari</h3>
            <div className="space-y-3">
              {categories.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${c.color}`} />
                  <span className="flex-1 text-sm text-on-surface-variant">{c.name}</span>
                  <span className="text-sm font-semibold text-on-surface">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
