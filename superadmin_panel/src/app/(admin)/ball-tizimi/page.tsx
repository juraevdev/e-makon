import { PrimaryButton, StatusPill } from "@/components/ui";

const exchangeRules = [
  { name: "Standart maysazorni o'rish", points: "150 ball", icon: "grass", active: true },
  { name: "Tomchilatib sug'orish diagnostikasi", points: "200 ball", icon: "water_drop", active: true },
  { name: "Daraxt sanitariya kesimi", points: "350 ball", icon: "park", active: true },
  { name: "Premium landshaft konsultatsiya", points: "500 ball", icon: "architecture", active: false },
];

const transactions = [
  { user: "Azizbek Rustamov", type: "Hisobga olindi", points: "+45", date: "08 Sen 2026", order: "#ORD-9021" },
  { user: "Malika Alieva", type: "Almashtirildi", points: "-150", date: "07 Sen 2026", order: "#ORD-9015" },
  { user: "Sardor Jalolov", type: "Hisobga olindi", points: "+120", date: "07 Sen 2026", order: "#ORD-9010" },
  { user: "Dilnoza Rashidova", type: "Muddati o'tdi", points: "-30", date: "06 Sen 2026", order: "—" },
];

export default function BallTizimiPage() {
  return (
    <div className="flex-1 pb-16 p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface md:text-[40px] md:leading-[48px]">
            Ball tizimi
          </h1>
          <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
            Ball to&apos;plash qoidalarini sozlang, mukofot almashinuvini boshqaring va platforma bo&apos;ylab
            foydalanuvchilarning sodiqlik faolligini kuzatib boring.
          </p>
        </div>
        <PrimaryButton icon="save">O&apos;zgarishlarni e&apos;lon qilish</PrimaryButton>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="group relative col-span-12 flex flex-col gap-5 overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-all hover:border-primary-container/60">
          <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl transition-all group-hover:bg-primary/15" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <div>
                <h2 className="text-[18px] font-bold tracking-tight text-on-surface">Ball to&apos;plash qoidalari</h2>
                <p className="text-[12px] text-on-surface-variant">Hisoblash formulalari</p>
              </div>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Standart
            </span>
          </div>

          <div className="mt-1 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { label: "1 ball sarflangan valyuta", badge: "UZS / so'm", icon: "payments", value: "100000", unit: "so'm" },
              { label: "Almashtirish uchun minimal", badge: "min chegara", icon: "stars", value: "50", unit: "ball" },
              { label: "Amal qilish muddati", badge: "davriylik", icon: "calendar_today", value: "12", unit: "oy" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex flex-col gap-2 rounded-xl border border-[#26352c] bg-[#0d100f] p-3.5 transition-all hover:border-[#384d3f]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap text-[13px] font-medium text-on-surface">{f.label}</span>
                  <span className="whitespace-nowrap rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {f.badge}
                  </span>
                </div>
                <div className="relative mt-1 flex items-center">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-primary">
                    {f.icon}
                  </span>
                  <input
                    type="number"
                    defaultValue={f.value}
                    className="w-full rounded-lg border border-[#26352c] bg-[#151917] py-2.5 pr-16 pl-11 text-[15px] font-semibold text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <span className="pointer-events-none absolute right-3.5 whitespace-nowrap text-[13px] font-medium text-on-surface-variant">
                    {f.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="-mx-6 -mb-6 mt-3 flex items-center gap-3 rounded-b-2xl border-t border-[#26352c] bg-surface-container-lowest/40 p-4 text-on-surface-variant">
            <span className="material-symbols-outlined shrink-0 text-[20px] text-primary">info</span>
            <p className="text-[13px] leading-relaxed">
              Joriy qoida: Mijozlar bajarilgan obodonlashtirish xizmatlariga sarflangan har{" "}
              <strong className="font-semibold text-primary">100 000 so&apos;m</strong> uchun{" "}
              <strong className="font-semibold text-primary">1 ball</strong> oladilar.
            </p>
          </div>
        </div>

        <div className="col-span-12 flex flex-col gap-5 rounded-2xl border border-[#26352c] bg-[#151917] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-all hover:border-primary-container/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <span className="material-symbols-outlined text-[20px]">redeem</span>
              </div>
              <div>
                <h2 className="text-[18px] font-bold tracking-tight text-on-surface">Xizmat ko&apos;rsatish kurslari</h2>
                <p className="text-[12px] text-on-surface-variant">Ballar evaziga beriladigan xizmatlar</p>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary shadow-sm transition-all hover:bg-primary hover:text-on-primary"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Qoida qo&apos;shish
            </button>
          </div>

          <div className="grid grid-cols-12 items-center border-b border-[#26352c] px-2 pb-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">
            <div className="col-span-5">Bonus xizmati</div>
            <div className="col-span-3">Kerakli ballar</div>
            <div className="col-span-2 text-center">Holati</div>
            <div className="col-span-2 pr-2 text-right">Harakatlar</div>
          </div>

          <div className="custom-scrollbar flex max-h-[300px] flex-col divide-y divide-[#26352c]/50 overflow-y-auto pr-1.5">
            {exchangeRules.map((r) => (
              <div
                key={r.name}
                className="grid grid-cols-12 items-center rounded-xl px-2 py-3.5 whitespace-nowrap transition-colors hover:bg-[#1a221d]/60"
              >
                <div className="col-span-5 flex min-w-0 items-center gap-3.5 pr-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]">{r.icon}</span>
                  </div>
                  <span className="truncate text-[15px] font-medium text-on-surface">{r.name}</span>
                </div>
                <div className="col-span-3">
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[13px] font-semibold text-primary">
                    {r.points}
                  </span>
                </div>
                <div className="col-span-2 flex justify-center">
                  <StatusPill variant={r.active ? "success" : "neutral"}>
                    {r.active ? "Faol" : "Nofaol"}
                  </StatusPill>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-3 pr-2 text-on-surface-variant">
                  <button type="button" className="hover:text-primary">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button type="button" className="hover:text-error">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917] shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-[#26352c] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              </div>
              <h2 className="text-[18px] font-bold text-on-surface">Tranzaksiyalar tarixi</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#26352c] bg-[#0e1211] text-xs tracking-wider text-on-surface-variant uppercase">
                  {["Foydalanuvchi", "Turi", "Ball", "Buyurtma", "Sana"].map((h) => (
                    <th key={h} className="px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26352c]/40">
                {transactions.map((t) => (
                  <tr key={t.user + t.date} className="hover:bg-[#1a221d]/50">
                    <td className="px-6 py-4 font-medium text-on-surface">{t.user}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{t.type}</td>
                    <td className={`px-6 py-4 font-semibold ${t.points.startsWith("+") ? "text-primary" : "text-error"}`}>
                      {t.points}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-primary">{t.order}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
