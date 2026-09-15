import Link from "next/link";
import {
  Card,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/ui";

const kpis = [
  { label: "Jami Foydalanuvchilar", value: "24,592", icon: "group", change: "+14.5%" },
  { label: "Faol Buyurtmalar", value: "1,284", icon: "shopping_cart", change: "+5.2%" },
  { label: "Faol Hamkorlar", value: "342", icon: "handshake", change: "+8.4%" },
  { label: "Umumiy Daromad", value: "$142.5k", icon: "account_balance_wallet", change: "+8.1%" },
];

const topServices = [
  { name: "Premium Lawn Care", orders: "4,230 buyurtma", revenue: "$124.5k", growth: "+18%", img: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=96&h=96&fit=crop" },
  { name: "Landscape Design", orders: "2,150 buyurtma", revenue: "$89.2k", growth: "+12%", img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=96&h=96&fit=crop" },
  { name: "Smart Irrigation", orders: "1,890 buyurtma", revenue: "$56.8k", growth: "+9%", img: "https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?w=96&h=96&fit=crop" },
  { name: "Tree Pruning", orders: "1,420 buyurtma", revenue: "$42.1k", growth: "+6%", img: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=96&h=96&fit=crop" },
];

const recentOrders = [
  { id: "#ORD-9823", name: "John Doe", initials: "JD", service: "Lawn Care", status: "Yakunlangan" as const, tone: "success" as const },
  { id: "#ORD-9824", name: "Alice Smith", initials: "AS", service: "Landscape Design", status: "Jarayonda" as const, tone: "info" as const },
  { id: "#ORD-9825", name: "Robert Jones", initials: "RJ", service: "Irrigation Fix", status: "Kutilmoqda" as const, tone: "error" as const },
];

const partners = [
  { name: "GreenThumb Co.", when: "2 kun oldin qo'shildi" },
  { name: "EcoScapes Inc.", when: "4 kun oldin qo'shildi" },
  { name: "Urban Bloom", when: "1 hafta oldin qo'shildi" },
];

const chartPoints = [150, 230, 224, 310, 280, 420, 390];
const chartLabels = ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan", "Yak"];

function OrdersChart() {
  const max = Math.max(...chartPoints);
  const w = 700;
  const h = 280;
  const pad = 32;
  const coords = chartPoints.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (chartPoints.length - 1);
    const y = h - pad - (v / max) * (h - pad * 2);
    return { x, y, v };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full min-h-[280px]" role="img" aria-label="Buyurtmalar dinamikasi">
      <defs>
        <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(46,125,50,0.5)" />
          <stop offset="100%" stopColor="rgba(46,125,50,0)" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad + t * (h - pad * 2);
        return (
          <line
            key={t}
            x1={pad}
            x2={w - pad}
            y1={y}
            y2={y}
            stroke="#ffffff08"
            strokeWidth="1"
          />
        );
      })}
      <path d={area} fill="url(#ordersFill)" />
      <path d={line} fill="none" stroke="#88d982" strokeWidth="2" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="#1A1D1D" stroke="#88d982" strokeWidth="2" />
          <text x={c.x} y={h - 8} textAnchor="middle" fill="#bfcaba" fontSize="12" fontFamily="Plus Jakarta Sans, sans-serif">
            {chartLabels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <div className="mb-6 flex items-center justify-between border-b border-surface-variant/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
              <h2 className="text-xl font-semibold text-on-surface">Buyurtmalar dinamikasi</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-surface-variant/50 bg-surface-container-high/80 p-1">
              <button type="button" className="rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-on-primary shadow-sm">
                Haftalik
              </button>
              <button type="button" className="rounded-full px-3.5 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface">
                Oylik
              </button>
            </div>
          </div>
          <div className="relative min-h-[280px] w-full flex-1">
            <OrdersChart />
          </div>
        </Card>

        <Card className="flex flex-col">
          <SectionTitle
            icon="award_star"
            title="Eng yaxshi xizmatlar"
            action={
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
                <span className="material-symbols-outlined text-lg">more_horiz</span>
              </button>
            }
          />
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
            {topServices.map((s) => (
              <div
                key={s.name}
                className="group flex items-center gap-3.5 rounded-xl border border-transparent p-2.5 transition-all hover:border-card-border hover:bg-surface-container-high/60"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-surface-variant/60 bg-surface-container-high">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.img} alt={s.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-on-surface group-hover:text-primary">{s.name}</h4>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {s.orders}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-on-surface">{s.revenue}</p>
                  <span className="text-[11px] text-primary">{s.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card padding={false} className="flex flex-col overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-surface-variant/40 p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-primary">receipt_long</span>
              <h2 className="text-xl font-semibold text-on-surface">So&apos;nggi buyurtmalar</h2>
            </div>
            <Link href="/buyurtmalar" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Barchasini ko&apos;rish
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-surface-variant/40 bg-surface-container-low/70">
                  {["Buyurtma ID", "Mijoz", "Xizmat", "Holat"].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/20">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-surface-container-high/40">
                    <td className="px-6 py-4 text-sm font-medium text-primary">{o.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                          {o.initials}
                        </div>
                        <span className="font-medium text-on-surface">{o.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{o.service}</td>
                    <td className="px-6 py-4">
                      <StatusPill variant={o.tone}>{o.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex flex-col">
          <SectionTitle
            icon="corporate_fare"
            title="Yangi hamkorlar"
            action={
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary hover:text-on-primary">
                <span className="material-symbols-outlined text-sm font-bold">add</span>
              </button>
            }
          />
          <div className="flex-1 space-y-3">
            {partners.map((p) => (
              <div
                key={p.name}
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-surface-variant/30 bg-surface-container-low/40 p-3 transition-all hover:border-primary/40 hover:bg-surface-container-high/70"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-surface-variant/60 bg-surface-variant text-sm font-bold text-primary">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-on-surface group-hover:text-primary">{p.name}</h4>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {p.when}
                  </p>
                </div>
                <span className="material-symbols-outlined text-sm text-on-surface-variant transition-all group-hover:translate-x-0.5 group-hover:text-primary">
                  chevron_right
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
