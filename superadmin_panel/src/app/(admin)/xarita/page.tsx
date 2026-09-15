"use client";

import { useState } from "react";
import { FilterChip } from "@/components/ui";

const partners = [
  {
    name: "GreenThumb Landscaping",
    service: "Daraxtlarni kesish va parvarish",
    status: "mavjud" as const,
    distance: "0.8 km",
    rating: "4.9 (124)",
    tags: ["Mavjud", "Premium"],
    icon: "park",
  },
  {
    name: "EcoMow Services",
    service: "Maysazorni parvarish qilish",
    status: "mavjud" as const,
    distance: "1.2 km",
    rating: "4.8 (89)",
    tags: ["Mavjud"],
    icon: "grass",
  },
  {
    name: "AquaIrrigation Pros",
    service: "Avtomatik sug'orish tizimi",
    status: "band" as const,
    distance: "2.4 km",
    rating: "4.7 (65)",
    tags: ["Band"],
    icon: "water_drop",
  },
  {
    name: "Urban Oasis Design",
    service: "Peyzaj arxitekturasi va dizayn",
    status: "yangi" as const,
    distance: "3.1 km",
    rating: "5.0 (18)",
    tags: ["Mavjud", "Yangi"],
    icon: "yard",
  },
];

export default function XaritaPage() {
  const [filter, setFilter] = useState<"all" | "mavjud" | "band" | "yangi">("all");

  const visible = partners.filter((p) => filter === "all" || p.status === filter);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="relative z-0 h-[512px] flex-1 border-b border-surface-variant bg-surface-container-lowest lg:h-auto lg:border-r lg:border-b-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1600&h=1200&fit=crop')",
          }}
        />
        <div className="absolute inset-0 bg-[#0c0f0f]/45" />

        {/* Mock pins */}
        {[
          { top: "28%", left: "42%" },
          { top: "45%", left: "55%" },
          { top: "60%", left: "35%" },
          { top: "38%", left: "68%" },
        ].map((pin, i) => (
          <div
            key={i}
            className="absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{ top: pin.top, left: pin.left }}
          >
            <span className="material-symbols-outlined text-3xl text-primary drop-shadow-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              location_on
            </span>
          </div>
        ))}

        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <div className="flex flex-col gap-2 rounded-2xl border border-[#26352c] bg-[#0c0f0f]/80 p-1 shadow-xl backdrop-blur-md">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface transition-colors hover:bg-[#1a2e22] hover:text-primary">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <div className="mx-1 h-px bg-[#26352c]" />
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface transition-colors hover:bg-[#1a2e22] hover:text-primary">
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
          </div>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#26352c] bg-[#0c0f0f]/80 text-on-surface shadow-xl backdrop-blur-md transition-all hover:border-primary/60 hover:bg-[#1a2e22] hover:text-primary">
            <span className="material-symbols-outlined text-[20px]">my_location</span>
          </button>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#26352c] bg-[#0c0f0f]/80 text-on-surface shadow-xl backdrop-blur-md transition-all hover:border-primary/60 hover:bg-[#1a2e22] hover:text-primary">
            <span className="material-symbols-outlined text-[20px]">layers</span>
          </button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 min-w-[220px] rounded-2xl border border-[#26352c] bg-[#0c0f0f]/90 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-primary uppercase">
              <span className="material-symbols-outlined text-[14px]">info</span> Holat belgisi
            </h3>
            <span className="text-[11px] text-outline">Jonli</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <span className="font-medium text-on-surface">Faol hamkorlar</span>
              </div>
              <span className="rounded-full border border-primary/30 bg-[#1a3824] px-2 py-0.5 text-[11px] font-semibold text-primary">
                38 ta
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[#e0cf7a]" />
                <span className="text-on-surface-variant">Buyurtma jarayonida</span>
              </div>
              <span className="rounded-full border border-[#e0cf7a]/30 bg-[#2a2b16] px-2 py-0.5 text-[11px] font-semibold text-[#e0cf7a]">
                12 ta
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full border border-outline bg-secondary-container" />
                <span className="text-outline">Offline / Band</span>
              </div>
              <span className="rounded-full border border-[#26352c] bg-surface-container px-2 py-0.5 text-[11px] font-medium text-outline">
                4 ta
              </span>
            </div>
          </div>
        </div>
      </div>

      <aside className="z-10 flex h-full w-full flex-col overflow-hidden border-l border-surface-variant bg-surface lg:w-[400px]">
        <div className="sticky top-0 z-20 border-b border-[#26352c] bg-[#111414]/95 p-4 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-on-surface">Jonli xarita</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-[#1a3824] px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Onlayn
                </span>
              </div>
              <p className="mt-1 text-xs text-outline">42 ta tasdiqlangan hamkor hozirda xizmatda</p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#26352c] bg-[#151c18] text-primary shadow-sm transition-colors hover:border-primary/50"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <FilterChip label="Barchasi" count={42} dot="bg-primary" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Mavjud" count={38} dot="bg-primary/60" active={filter === "mavjud"} onClick={() => setFilter("mavjud")} />
            <FilterChip label="Band" count={4} dot="bg-[#e0cf7a]/60" active={filter === "band"} onClick={() => setFilter("band")} />
            <FilterChip label="Yangi" count={6} dot="bg-[#69d9c2]/60" active={filter === "yangi"} onClick={() => setFilter("yangi")} />
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          {visible.map((p) => (
            <div
              key={p.name}
              className={`group cursor-pointer rounded-2xl border border-[#26352c] bg-[#131916]/90 p-4 transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary-container/10 ${
                p.status === "band" ? "opacity-85" : ""
              }`}
            >
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105 ${
                      p.status === "band"
                        ? "border-[#26352c] bg-surface-container text-outline"
                        : "border-primary-container/40 bg-[#1a2e22] text-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {p.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-on-surface transition-colors group-hover:text-primary">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-outline">{p.service}</p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary-container/40 bg-[#1a2920] px-2.5 py-1 text-xs font-semibold text-primary">
                  <span className="material-symbols-outlined text-[12px]">near_me</span>
                  {p.distance}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#26352c]/60 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                        tag === "Band"
                          ? "border-[#26352c] bg-surface-container text-outline"
                          : tag === "Yangi"
                            ? "border-[#69d9c2]/30 bg-[#152a26] text-[#69d9c2]"
                            : tag === "Premium"
                              ? "border-[#e0cf7a]/30 bg-[#2a2b16] text-[#e0cf7a]"
                              : "border-primary/30 bg-[#1a3824] text-primary"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ml-1 flex items-center gap-0.5 text-[11px] text-outline">
                    <span className="material-symbols-outlined text-[13px] text-[#e0cf7a]">star</span>
                    {p.rating}
                  </span>
                </div>
                <button type="button" className="flex items-center gap-0.5 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
                  Ko&apos;rish <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
