"use client";

import { useState } from "react";
import { PageHeader, PrimaryButton, StatusPill } from "@/components/ui";

const partners = [
  {
    name: "GreenLine Scapes",
    status: "Faol" as const,
    variant: "success" as const,
    tags: ["Landshaft", "Dizayn"],
    rating: "4.9",
    reviews: 128,
    address: "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi 42",
    phone: "+998 (71) 200-45-67",
    since: "2023-yil yanvardan",
    pending: false,
  },
  {
    name: "AquaDrop Systems",
    status: "Faol" as const,
    variant: "success" as const,
    tags: ["Sug'orish", "Texnik xizmat"],
    rating: "4.7",
    reviews: 84,
    address: "Samarqand sh., Registon ko'chasi 18",
    phone: "+998 (66) 234-89-01",
    since: "2023-yil martdan",
    pending: false,
  },
  {
    name: "TerraBotanica",
    status: "Nofaol" as const,
    variant: "error" as const,
    tags: ["Pitomnik", "O'simliklar"],
    rating: "4.2",
    reviews: 31,
    address: "Toshkent vil., Bo'stonliq tumani, Chimyon yo'li 5",
    phone: "+998 (90) 123-45-67",
    since: "2023-yil avgustdan",
    pending: false,
  },
  {
    name: "PathMaker Hardscapes",
    status: "Kutilmoqda" as const,
    variant: "warning" as const,
    tags: ["Qattiq landshaft", "Yo'laklar"],
    rating: null,
    reviews: 0,
    address: "Farg'ona sh., Al-Farg'oniy ko'chasi 77",
    phone: "+998 (73) 543-21-98",
    since: null,
    pending: true,
  },
];

export default function HamkorlarPage() {
  const [filter, setFilter] = useState("all");

  return (
    <div className="flex-1 px-4 py-6 md:px-8">
      <PageHeader
        title="Hamkorlar boshqaruvi"
        description="Xizmat ko'rsatish hamkorlarini ko'rish, boshqarish va ro'yxatdan o'tkazish."
      />

      <div className="mb-8 flex w-full flex-nowrap items-center gap-3 overflow-x-auto rounded-2xl border border-primary-container/30 bg-[#141916]/90 p-2 backdrop-blur-md">
        {[
          { id: "all", label: "Barchasi", count: 124, icon: "storefront" },
          { id: "active", label: "Faol", count: 118, dot: "bg-primary" },
          { id: "pending", label: "Tasdiqlash kutilmoqda", count: 4, dot: "bg-amber-400" },
          { id: "inactive", label: "Nofaol", count: 2, dot: "bg-error" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition-all ${
              filter === f.id
                ? "border border-primary/40 bg-primary-container/25 font-semibold text-primary shadow-[0_0_15px_rgba(46,125,50,0.3)]"
                : "font-medium text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface"
            }`}
          >
            {"icon" in f && f.icon ? (
              <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
            ) : (
              <span className={`h-2 w-2 rounded-full ${f.dot}`} />
            )}
            {f.label}
            <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs font-medium text-on-surface-variant">
              {f.count}
            </span>
          </button>
        ))}
        <div className="ml-auto shrink-0">
          <PrimaryButton icon="add_business">+ Yangi hamkor qo&apos;shish</PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {partners.map((p) => (
          <div
            key={p.name}
            className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-b from-[#151a18] to-[#101412] p-5 transition-all duration-300 ${
              p.pending
                ? "border-amber-500/35 hover:border-amber-400/70 hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]"
                : p.variant === "error"
                  ? "border-white/10 hover:border-primary/50"
                  : "border-primary-container/35 hover:border-primary/70 hover:shadow-[0_0_25px_rgba(46,125,50,0.25)]"
            }`}
          >
            {!p.variant || p.variant === "success" || p.pending ? (
              <div
                className={`pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full blur-2xl transition-all ${
                  p.pending ? "bg-amber-500/10 group-hover:bg-amber-500/20" : "bg-primary-container/15 group-hover:bg-primary/20"
                }`}
              />
            ) : null}
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex-1 truncate pr-2 text-lg font-bold text-on-surface transition-colors group-hover:text-primary">
                  {p.name}
                </h3>
                <StatusPill variant={p.variant} pulse={p.variant === "success"}>
                  {p.pending ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[13px]">hourglass_top</span>
                      {p.status}
                    </>
                  ) : (
                    p.status
                  )}
                </StatusPill>
              </div>
              <div className="mb-4">
                <div className="mb-3 flex flex-col items-start gap-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/5 bg-surface-container-high/80 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-on-surface-variant uppercase"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {p.pending ? (
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                    <span className="material-symbols-outlined text-[15px]">fiber_new</span>
                    Yangi ariza
                  </div>
                ) : (
                  <div className="mb-3.5 flex items-center gap-1.5 text-sm text-yellow-400">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                    <span className="text-[15px] font-bold text-on-surface">{p.rating}</span>
                    <span className="text-xs font-normal text-on-surface-variant">({p.reviews} ta sharh)</span>
                  </div>
                )}
                <div className="space-y-1.5 text-xs text-on-surface-variant">
                  <p className="flex items-center gap-2">
                    <span className="material-symbols-outlined shrink-0 text-[16px] text-primary">location_on</span>
                    <span className="truncate">{p.address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="material-symbols-outlined shrink-0 text-[16px] text-primary">call</span>
                    <span className="truncate font-medium text-on-surface/90">{p.phone}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-auto flex items-center justify-between border-t border-white/10 pt-3.5">
              {p.pending ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all hover:border-amber-400/70 hover:bg-amber-500/25 hover:text-white"
                >
                  Arizani ko&apos;rish
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px] text-primary/70">calendar_today</span>
                  {p.since}
                </div>
              )}
              <button type="button" className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
