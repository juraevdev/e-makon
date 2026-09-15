"use client";

import { useState } from "react";
import { FilterChip, PageHeader, PrimaryButton, SecondaryButton } from "@/components/ui";

const notifications = [
  {
    type: "Tizim",
    icon: "settings_system_daydream",
    tone: "bg-blue-500/10 border-blue-500/25 text-blue-400",
    title: "Rejalashtirilgan texnik xizmat ko'rsatish",
    body: "Platforma yakshanba kuni tungi soat 2 da 30 daqiqaga o'chiriladi.",
    date: "Okt 24, 2023",
    reach: "12,450 ta",
  },
  {
    type: "Taklif",
    icon: "local_offer",
    tone: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    title: "Bahorgi bog' tayyorgarligi uchun chegirma",
    body: "15-martdan oldin band qilingan barcha bahorgi xizmatlarga 15% chegirma.",
    date: "Okt 20, 2023",
    reach: "8,920 ta",
  },
  {
    type: "Bonus",
    icon: "stars",
    tone: "bg-purple-500/10 border-purple-500/25 text-purple-400",
    title: "Hamkorlik bosqichi yakunlandi",
    body: "Barcha Gold darajali hamkorlarni tabriklaymiz! Sizning 3-chorak bonusingiz tayyor.",
    date: "Okt 15, 2023",
    reach: "450 ta",
  },
  {
    type: "Aksiya",
    icon: "redeem",
    tone: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    title: "Kuzgi daraxt oqartirish aksiyasi",
    body: "Mavsumiy himoya vositalari va bio-ohaklash xizmatlariga 20% gacha keshbek.",
    date: "Okt 12, 2023",
    reach: "11,200 ta",
  },
];

const reviews = [
  {
    initials: "AK",
    name: "Anvar Karimov",
    target: "'Green Garden' xizmatiga",
    stars: 5,
    text: "Ko'kalamzorlashtirish xizmati juda tez va sifatli bajarildi. Mutaxassislar o'z ishining ustasi ekan, tavsiya qilaman!",
    meta: "24 Okt, 2023 • Toshkent shahri",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    initials: "DR",
    name: "Dilnoza Rashidova",
    target: "'EcoPlast' qayta ishlashga",
    stars: 4,
    text: "Xomashyoni olib ketish biroz kechikdi, lekin qabul punktidagi xodimlar juda muloyim va hisob-kitob aniq bo'ldi.",
    meta: "22 Okt, 2023 • Samarqand",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    initials: "JB",
    name: "Jasur Bekmurodov",
    target: "'LawnCare Pro' maysa parvarishiga",
    stars: 5,
    text: "Maysazorimiz butunlay yangilandi, begona o'tlar tozalandi va avtomatik sug'orish mukammal sozlandi. Rahmat!",
    meta: "21 Okt, 2023 • Farg'ona",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
];

export default function AloqaPage() {
  const [tab, setTab] = useState<"notifications" | "reviews">("notifications");

  return (
    <div className="flex-1 p-4 md:p-8">
      <PageHeader
        title="Aloqa markazi (Xabarlar va Sharhlar)"
        description="Platformadagi barcha xabarnomalar, mijozlar fikr-mulohazalari va reytinglarni boshqarish."
        actions={
          <>
            <SecondaryButton icon="filter_list">Filtrlar</SecondaryButton>
            <PrimaryButton icon="send">Xabarnoma yuborish</PrimaryButton>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 pb-2">
        <FilterChip
          label="Xabarnomalar (Bildirishnomalar)"
          count={4}
          icon="notifications"
          active={tab === "notifications"}
          onClick={() => setTab("notifications")}
        />
        <FilterChip
          label="Sharhlar va Reytinglar"
          count={12}
          icon="rate_review"
          active={tab === "reviews"}
          onClick={() => setTab("reviews")}
        />
      </div>

      <div className="space-y-6">
        {tab === "notifications" ? (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#141a16] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#26352c] bg-[#111613] p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </div>
                <h3 className="text-[16px] font-semibold text-on-surface">So&apos;nggi yuborilgan xabarnomalar</h3>
              </div>
              <span className="rounded-full border border-[#26352c] bg-[#1a231d] px-2.5 py-1 text-[12px] text-on-surface-variant">
                Barchasi: 248 ta
              </span>
            </div>
            <div className="hidden gap-4 border-b border-[#26352c]/80 bg-[#111613]/90 px-5 py-3 text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase sm:grid sm:grid-cols-12">
              <div className="col-span-2">Turi</div>
              <div className="col-span-6">Mazmuni</div>
              <div className="col-span-2">Sana</div>
              <div className="col-span-2 text-right">Qamrov</div>
            </div>
            <div className="custom-scrollbar flex max-h-[420px] flex-col divide-y divide-[#26352c]/50 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.title}
                  className="group relative grid grid-cols-1 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#19221c]/60 sm:grid-cols-12"
                >
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-transparent transition-colors group-hover:bg-primary" />
                  <div className="flex items-center sm:col-span-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] ${n.tone}`}>
                      <span className="material-symbols-outlined text-[14px]">{n.icon}</span>
                      {n.type}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center sm:col-span-6">
                    <h4 className="mb-0.5 text-[14px] font-medium text-on-surface">{n.title}</h4>
                    <p className="line-clamp-1 text-[13px] text-on-surface-variant">{n.body}</p>
                  </div>
                  <div className="flex items-center text-[13px] text-on-surface-variant sm:col-span-2">{n.date}</div>
                  <div className="flex items-center text-[13px] font-semibold text-on-surface sm:col-span-2 sm:justify-end">
                    <span className="flex items-center gap-1.5 rounded-lg border border-[#26352c] bg-[#19221c] px-2.5 py-1">
                      <span className="material-symbols-outlined text-[15px] text-primary">group</span>
                      {n.reach}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#141a16] shadow-xl">
          <div className="flex flex-col justify-between gap-3 border-b border-[#26352c] bg-[#111613] p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-400">
                <span className="material-symbols-outlined text-[20px]">reviews</span>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-on-surface">Hamkorlar sharhlari va moderatsiya</h3>
                <p className="text-[12px] text-on-surface-variant">
                  Mijozlar tomonidan xizmatlar va hamkorlarga qoldirilgan baholar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-[#192b1d] px-3 py-1 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-[15px] text-amber-400">star</span>
                4.8 / 5.0 O&apos;rtacha reyting
              </span>
            </div>
          </div>
          <div className="custom-scrollbar flex max-h-[420px] flex-col space-y-3 overflow-y-auto p-3">
            {reviews.map((r) => (
              <div
                key={r.name}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-[#26352c] bg-[#151c18]/80 p-4 transition-colors hover:bg-[#19221c]/80 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${r.color}`}>
                      {r.initials}
                    </div>
                    <span className="text-[14px] font-semibold text-white">{r.name}</span>
                    <span className="text-[12px] text-on-surface-variant">• {r.target}</span>
                    <div className="ml-1 flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`material-symbols-outlined text-[16px] ${i < r.stars ? "" : "text-[#334238]"}`}
                          style={i < r.stars ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mb-2 pl-9 text-[13px] leading-relaxed text-on-surface">{r.text}</p>
                  <span className="flex items-center gap-1 pl-9 text-[11px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    {r.meta}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:self-center">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full border border-primary-container/50 bg-[#203326] px-3.5 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary-container/30"
                  >
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    Tasdiqlash
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-3.5 py-1.5 text-[12px] text-rose-400 transition-colors hover:bg-rose-500/20"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    O&apos;chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
