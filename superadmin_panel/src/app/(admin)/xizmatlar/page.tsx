import { Pagination, StatusPill } from "@/components/ui";

const kpis = [
  {
    label: "Jami faol xizmatlar",
    value: "24",
    suffix: "ta xizmat",
    hint: "bu oy +3 ta qo'shildi",
    icon: "eco",
    hintIcon: "trending_up",
    hintTone: "text-primary",
  },
  {
    label: "O'rtacha narx",
    value: "450,000",
    badge: "UZS",
    hint: "Barcha toifalar bo'yicha",
    icon: "payments",
    hintIcon: "category",
    hintTone: "text-on-surface-variant",
  },
  {
    label: "Eng yaxshi natija",
    value: "Landshaft dizayni",
    valueClass: "text-xl",
    hint: "42 Hamkor tayinlangan",
    icon: "workspace_premium",
    hintIcon: null,
    hintTone: "text-on-surface-variant",
  },
];

const services = [
  {
    name: "Landshaft dizayni",
    desc: "Mulkning estetik rejalashtirilishi, ko'kalamzorlashtirish va ekilish tizimi.",
    price: "800,000 - 2,500,000",
    duration: "2-5 Kun",
    status: "Faol" as const,
    icon: "local_florist",
    partners: "+40",
  },
  {
    name: "Sug'orish tizimlari",
    desc: "Suv sepuvchilar va tomchilatib sug'orish liniyalarini o'rnatish.",
    price: "300,000 - 1,200,000",
    duration: "1-2 Kun",
    status: "Faol" as const,
    icon: "water_drop",
    partners: "+12",
  },
  {
    name: "Zararkunandalarga qarshi kurash",
    desc: "Bog'dagi zararkunandalarni ekologik toza yo'q qilish xizmati.",
    price: "150,000 - 500,000",
    duration: "2-4 Soat",
    status: "To'xtatilgan" as const,
    icon: "pest_control",
    partners: "8",
  },
  {
    name: "Gazon o'rish",
    desc: "Professional maysazor parvarishi va muntazam o'rish xizmati.",
    price: "120,000 - 450,000",
    duration: "1 Kun",
    status: "Faol" as const,
    icon: "grass",
    partners: "+22",
  },
  {
    name: "Daraxt kesish",
    desc: "Xavfsiz daraxt butash, shakllantirish va sanitariya kesimi.",
    price: "200,000 - 900,000",
    duration: "1-3 Kun",
    status: "Faol" as const,
    icon: "park",
    partners: "+15",
  },
  {
    name: "3D landshaft loyiha",
    desc: "Vizualizatsiya va texnik chizmalar bilan to'liq dizayn paketi.",
    price: "1,500,000 - 5,000,000",
    duration: "5-10 Kun",
    status: "Faol" as const,
    icon: "architecture",
    partners: "+8",
  },
];

function ServiceCard({
  s,
}: {
  s: (typeof services)[number];
}) {
  const active = s.status === "Faol";
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#26352c] bg-[#111414] p-5 shadow-lg transition-all duration-300 hover:border-primary/60">
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/15" />
      <div>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-container/30 bg-primary-container/20 text-primary shadow-sm transition-colors group-hover:bg-primary-container/30">
            <span className="material-symbols-outlined text-[24px]">{s.icon}</span>
          </div>
          <StatusPill variant={active ? "success" : "neutral"} pulse={active}>
            {s.status}
          </StatusPill>
        </div>
        <h4 className="mb-1 text-base font-bold text-on-surface transition-colors group-hover:text-primary">
          {s.name}
        </h4>
        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{s.desc}</p>
        <div className="mb-4 rounded-xl border border-white/5 bg-[#191c1c] p-3">
          <span className="mb-0.5 block text-[11px] tracking-wider text-on-surface-variant uppercase">
            Narx oralig&apos;i
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-on-surface">{s.price}</span>
            <span className="text-xs font-bold text-primary">UZS</span>
          </div>
        </div>
        <div className="mb-4 flex items-center justify-between text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
            {s.duration}
          </span>
          <div className="flex items-center -space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#151917] bg-[#222a25] text-[10px] font-bold text-primary ring-1 ring-primary-container/40">
              {s.partners}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[#26352c]/50 pt-3">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary-container/40 bg-primary-container/20 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-container/30"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
          Tahrirlash
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/5 bg-surface-container-low p-2 text-on-surface-variant transition-colors hover:bg-error-container/20 hover:text-error"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  );
}

export default function XizmatlarPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-10">
        <p className="max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
          Platformadagi barcha xizmat takliflarini, narxlash tuzilmalarini va hamkor tayinlashlarni boshqaring va tashkil qiling.
        </p>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-primary-container/30 bg-[#111414] p-6 shadow-lg transition-all duration-300 hover:border-primary/60"
          >
            <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/15" />
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
                  {k.label}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-container/40 bg-primary-container/20 text-primary shadow-sm transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
                </div>
              </div>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className={`font-bold tracking-tight text-on-surface ${k.valueClass ?? "text-3xl"}`}>
                  {k.value}
                </h3>
                {k.suffix ? (
                  <span className="text-xs font-medium text-on-surface-variant">{k.suffix}</span>
                ) : null}
                {k.badge ? (
                  <span className="rounded-md border border-primary-container/30 bg-primary-container/20 px-2 py-0.5 text-xs font-bold text-primary">
                    {k.badge}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={`flex items-center gap-1.5 pt-2 text-xs font-medium ${k.hintTone}`}>
              {k.hintIcon ? (
                <span className="material-symbols-outlined text-[16px]">{k.hintIcon}</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#26352c] bg-[#1e2722] px-2.5 py-0.5 text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  42 Hamkor
                </span>
              )}
              <span>{k.hintIcon ? k.hint : "tayinlangan"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917] shadow-xl backdrop-blur-md">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.name} s={s} />
          ))}
        </div>
        <Pagination
          info={
            <>
              Jami <span className="font-bold text-on-surface">24</span> ta xizmatdan 1 - 6
              ko&apos;rsatilmoqda
            </>
          }
        />
      </div>
    </div>
  );
}
