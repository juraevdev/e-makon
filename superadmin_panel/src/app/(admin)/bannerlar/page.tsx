"use client";

import { useState } from "react";
import { FilterChip, PrimaryButton, SecondaryButton, StatusPill } from "@/components/ui";

const banners = [
  {
    title: "Bahorgi ekish mavsumi",
    desc: "Bizning yangi mavsumiy ekish xizmatlarimizni targ'ib qiling. Chegirmalar va ommaviy ko'chat ekish kampaniyasi.",
    status: "Faol" as const,
    tone: "success" as const,
    footer: "Bosh sahifada faol",
    img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=640&h=360&fit=crop",
  },
  {
    title: "Premium gazon yotqizish aksiyasi",
    desc: "Gollandiya urug'idan tabiiy yashil gazonlar 15% chegirma bilan. Yetkazish va mutaxassis ekish xizmati.",
    status: "Faol" as const,
    tone: "success" as const,
    footer: "Bosh sahifada faol",
    img: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=640&h=360&fit=crop",
  },
  {
    title: "Aqlli avtomat sug'orish tizimi",
    desc: "IoT datchiklar bilan suv tejovchi sug'orish. Birinchi o'rnatishda bepul diagnostika.",
    status: "Faol" as const,
    tone: "success" as const,
    footer: "Ilova bannerida",
    img: "https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?w=640&h=360&fit=crop",
  },
  {
    title: "Yashil landshaft dizayni 3D loyiha",
    desc: "Professional 3D vizualizatsiya paketi. Premium mijozlar uchun maxsus taklif.",
    status: "Faol" as const,
    tone: "success" as const,
    footer: "Promo bo'limida",
    img: "https://images.unsplash.com/photo-1585320806297-779435439e82?w=640&h=360&fit=crop",
  },
  {
    title: "Kuzgi daraxt parvarishi va o'g'itlash",
    desc: "Mavsumiy daraxt himoyasi kampaniyasi. 20-oktabrdan boshlanadi.",
    status: "Rejalashtirilgan" as const,
    tone: "warning" as const,
    footer: "20 Okt — boshlanish",
    img: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=640&h=360&fit=crop",
  },
  {
    title: "Tijoriy obyektlar uchun yashil hudud",
    desc: "Korporativ mijozlar uchun kompleks ko'kalamzorlashtirish paketlari.",
    status: "Rejalashtirilgan" as const,
    tone: "warning" as const,
    footer: "Qoralama",
    img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=640&h=360&fit=crop",
  },
];

export default function BannerlarPage() {
  const [filter, setFilter] = useState("Barchasi");

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold text-on-surface md:hidden">Bannerlar va aksiyalar</h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <FilterChip label="Barchasi" count={6} active={filter === "Barchasi"} onClick={() => setFilter("Barchasi")} />
          <FilterChip label="Faol" count={4} dot="bg-primary" active={filter === "Faol"} onClick={() => setFilter("Faol")} />
          <FilterChip
            label="Rejalashtirilgan"
            count={2}
            icon="schedule"
            active={filter === "Rejalashtirilgan"}
            onClick={() => setFilter("Rejalashtirilgan")}
          />
          <div className="ml-auto flex items-center gap-2">
            <SecondaryButton icon="filter_list">Filtr</SecondaryButton>
            <PrimaryButton icon="add">Banner qo&apos;shish</PrimaryButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {banners
          .filter((b) => {
            if (filter === "Faol") return b.status === "Faol";
            if (filter === "Rejalashtirilgan") return b.status === "Rejalashtirilgan";
            return true;
          })
          .map((b) => (
            <article
              key={b.title}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917] transition-all duration-300 hover:border-primary-container/70 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="relative h-48 w-full overflow-hidden bg-surface-container-high">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.img}
                  alt={b.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#151917]/90 via-transparent to-black/30" />
                <div className="absolute top-3 right-3">
                  <StatusPill variant={b.tone} pulse={b.tone === "success"}>
                    {b.status}
                  </StatusPill>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 text-xl font-semibold text-on-surface transition-colors group-hover:text-primary">
                  {b.title}
                </h3>
                <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{b.desc}</p>
                <div className="mt-auto flex items-center justify-between border-t border-[#26352c]/60 pt-3 text-on-surface-variant">
                  <div className="flex items-center gap-1.5 text-xs text-tertiary">
                    <span className="material-symbols-outlined text-[14px]">
                      {b.status === "Faol" ? "visibility" : "schedule"}
                    </span>
                    {b.footer}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" title="Tahrirlash" className="rounded-lg p-1.5 transition-colors hover:bg-[#1d2020] hover:text-primary">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button type="button" title="O'chirish" className="rounded-lg p-1.5 transition-colors hover:bg-[#1d2020] hover:text-error">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}

        <button
          type="button"
          className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-primary transition-all hover:border-primary hover:bg-primary/10"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <span className="material-symbols-outlined text-[28px]">add</span>
          </span>
          <h3 className="text-lg font-semibold">Yangi banner qo&apos;shish</h3>
          <p className="max-w-xs text-center text-sm text-on-surface-variant">
            Aksiya yoki kampaniya uchun yangi banner yarating
          </p>
        </button>
      </div>
    </div>
  );
}
