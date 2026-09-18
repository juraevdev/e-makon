"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Card,
  LoadingBlock,
  PrimaryButton,
  SectionTitle,
  StatusPill,
  StatCard,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import type { DashboardData, OrderStatus } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, SPECIALTY_LABEL } from "@/lib/domain";
import { formatMoney, formatPhone, initials, relativeTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

const PERIODS = [
  { id: "day", label: "Kunlik" },
  { id: "week", label: "Haftalik" },
  { id: "month", label: "Oylik" },
  { id: "season", label: "Mavsumiy" },
  { id: "year", label: "Yillik" },
  { id: "custom", label: "Oraliq" },
] as const;

function OrdersChart({ points }: { points: { label: string; value: number }[] }) {
  if (!points.length) {
    return <p className="py-16 text-center text-sm text-on-surface-variant">Hali buyurtma yo&apos;q</p>;
  }
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 700;
  const h = 280;
  const pad = 32;
  const coords = points.map((p, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(points.length - 1, 1);
    const y = h - pad - (p.value / max) * (h - pad * 2);
    return { x, y, ...p };
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
        return <line key={t} x1={pad} x2={w - pad} y1={y} y2={y} stroke="#ffffff08" strokeWidth="1" />;
      })}
      <path d={area} fill="url(#ordersFill)" />
      <path d={line} fill="none" stroke="#88d982" strokeWidth="2" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="#1A1D1D" stroke="#88d982" strokeWidth="2" />
          <text x={c.x} y={h - 8} textAnchor="middle" fill="#bfcaba" fontSize="10" fontFamily="Plus Jakarta Sans, sans-serif">
            {c.label.slice(5) || c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ServiceUsageList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: DashboardData["top_services"];
}) {
  return (
    <Card className="flex flex-col">
      <SectionTitle icon={icon} title={title} />
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Ma&apos;lumot yo&apos;q</p>
        ) : (
          items.slice(0, 4).map((s) => (
            <div
              key={`${title}-${s.id}`}
              className="rounded-xl border border-transparent p-2.5 transition-all hover:border-card-border hover:bg-surface-container-high/60"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-variant/60 bg-surface-container-high text-primary">
                  <span className="material-symbols-outlined">{s.icon || "eco"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-on-surface">{s.name}</h4>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {s.orders} marta · {s.category || "Toifa yo'q"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-primary">{s.orders}</p>
              </div>
              {s.firms?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
                  {s.firms.map((f) => (
                    <Link
                      key={f.id}
                      href={`/firmalar/${f.id}`}
                      className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20"
                    >
                      {f.name} ({f.orders})
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-1 pl-14 text-[11px] text-on-surface-variant">Firma biriktirilmagan</p>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

async function downloadPdfReport(query: Record<string, string>) {
  const bundle = await api<{
    generated_at: string;
    title: string;
    summary: DashboardData;
  }>("/admin/reports/bundle/", { query });
  const s = bundle.summary;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${bundle.title}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{color:#1b6d24} table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}
    th{background:#eef7ee} .muted{color:#666;font-size:12px}
  </style></head><body>
  <h1>${bundle.title}</h1>
  <p class="muted">Yaratilgan: ${bundle.generated_at} · Davr: ${s.date_from} — ${s.date_to}</p>
  <h2>Umumiy ko'rsatkichlar</h2>
  <table>
    <tr><th>Firmalar</th><td>${s.firms_total} (faol ${s.firms_active})</td></tr>
    <tr><th>Investorlar</th><td>${s.investors_active} / ${s.investors_total}</td></tr>
    <tr><th>Faol buyurtmalar</th><td>${s.active_orders}</td></tr>
    <tr><th>Davr buyurtmalari</th><td>${s.orders_in_period}</td></tr>
    <tr><th>Umumiy aylanma</th><td>${s.revenue_done} UZS</td></tr>
    <tr><th>Davr aylanmasi</th><td>${s.revenue_period} UZS</td></tr>
    <tr><th>Kampaniya ulushi</th><td>${s.platform_share_total} UZS</td></tr>
  </table>
  <h2>Firma aylanmalari</h2>
  <table><tr><th>Firma</th><th>Buyurtma</th><th>Aylanma</th><th>Stavka</th><th>Ulush</th></tr>
  ${(s.firm_revenues || []).map((f) => `<tr><td>${f.name}</td><td>${f.orders}</td><td>${f.revenue}</td><td>${f.commission_rate}%</td><td>${f.platform_share}</td></tr>`).join("")}
  </table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const win = window.open("", "_blank");
  if (!win) throw new Error("Popup bloklandi — PDF uchun ruxsat bering");
  win.document.write(html);
  win.document.close();
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  // Overview (KPIs, services, recent) — bir marta, oy bo'yicha
  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
  } = useAsync(() => api<DashboardData>("/admin/dashboard/", { query: { period: "month" } }), []);

  const chartQuery = useMemo(() => {
    if (period === "custom") {
      return {
        period: "custom",
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
    }
    return { period };
  }, [period, dateFrom, dateTo]);

  // Faqat dinamika kartasi yangilanadi
  const {
    data: chartData,
    loading: chartLoading,
    refreshing: chartRefreshing,
    error: chartError,
  } = useAsync(
    () => api<DashboardData>("/admin/dashboard/", { query: chartQuery }),
    [period, dateFrom, dateTo],
    { keepPrevious: true },
  );

  if (overviewLoading) return <LoadingBlock />;
  if (overviewError || !overview) {
    return <p className="p-8 text-error">{overviewError || "Dashboard yuklanmadi"}</p>;
  }

  const dynamics = chartData ?? overview;
  const series = dynamics.orders_series || dynamics.orders_by_day || [];
  const chartPoints = series.map((row) => ({
    label: row.label || (row.day ? row.day.slice(5) : ""),
    value: row.count,
  }));
  const chartBusy = chartLoading || chartRefreshing;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Xizmat firmalari"
          value={String(overview.firms_total)}
          icon="storefront"
          change={`${overview.firms_active} faol`}
          href="/firmalar"
        />
        <StatCard
          label="Faol buyurtmalar"
          value={String(overview.active_orders)}
          icon="shopping_cart"
          change={`${overview.today_orders} bugun`}
          href="/buyurtmalar"
        />
        <StatCard
          label="Faol investorlar"
          value={String(overview.investors_active)}
          icon="handshake"
          change={`${overview.investors_total} jami`}
          href="/investorlar"
        />
        <Link
          href="/hisobotlar"
          className="flex flex-col justify-between rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-lg shadow-black/20 transition-all hover:border-primary/50"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
            <span className="text-[11px] font-semibold tracking-wide text-primary uppercase">Hisobot</span>
          </div>
          <p className="text-sm font-medium text-on-surface-variant">Umumiy aylanma</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
            {formatMoney(overview.revenue_done)}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-primary/15 pt-3 text-xs">
            <div>
              <p className="text-on-surface-variant">Kampaniya ulushi</p>
              <p className="font-semibold text-primary">{formatMoney(overview.platform_share_total)}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">O&apos;rtacha chek</p>
              <p className="font-semibold">{formatMoney(overview.avg_check)}</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="relative flex flex-col xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 border-b border-surface-variant/40 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                <h2 className="text-xl font-semibold text-on-surface">Buyurtmalar dinamikasi</h2>
              </div>
              <PrimaryButton
                icon="picture_as_pdf"
                disabled={pdfBusy}
                onClick={async () => {
                  setPdfBusy(true);
                  try {
                    await downloadPdfReport(
                      Object.fromEntries(
                        Object.entries(chartQuery).filter(([, v]) => v != null) as [string, string][],
                      ),
                    );
                  } finally {
                    setPdfBusy(false);
                  }
                }}
              >
                PDF hisobot
              </PrimaryButton>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                    period === p.id
                      ? "border-primary bg-primary text-on-primary"
                      : "border-surface-variant text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {period === "custom" ? (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <span className="text-on-surface-variant">—</span>
                  <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              ) : null}
            </div>
            <p className="text-xs text-on-surface-variant">
              {dynamics.date_from} — {dynamics.date_to} · {dynamics.orders_in_period} buyurtma · davr aylanmasi{" "}
              {formatMoney(dynamics.revenue_period)}
            </p>
          </div>
          <div className="relative min-h-[280px] w-full flex-1">
            {chartError ? (
              <p className="py-16 text-center text-sm text-error">{chartError}</p>
            ) : (
              <OrdersChart points={chartPoints} />
            )}
            {chartBusy ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/40 backdrop-blur-[1px]">
                <span className="rounded-full border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-primary">
                  Yangilanmoqda…
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-6">
          <ServiceUsageList title="Eng ko'p foydalanilgan (1 oy)" icon="trending_up" items={overview.top_services} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ServiceUsageList title="Eng kam foydalanilayotgan" icon="trending_down" items={overview.least_services} />
        <Card className="flex flex-col">
          <SectionTitle
            icon="payments"
            title="Firma aylanmalari va ulush"
            action={
              <Link href="/firmalar" className="text-xs font-semibold text-primary hover:underline">
                Barchasi
              </Link>
            }
          />
          <div className="custom-scrollbar max-h-[360px] space-y-2 overflow-y-auto">
            {(overview.firm_revenues || []).map((f) => (
              <Link
                key={f.id}
                href={`/firmalar/${f.id}`}
                className="flex items-center justify-between rounded-xl border border-surface-variant/30 p-3 hover:border-primary/40"
              >
                <div>
                  <p className="font-semibold text-on-surface">{f.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {f.orders} buyurtma · stavka {f.commission_rate}%
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold">{formatMoney(f.revenue)}</p>
                  <p className="text-xs text-primary">Ulush {formatMoney(f.platform_share)}</p>
                </div>
              </Link>
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
                  {["ID", "Mijoz", "Firma", "Xizmat", "Narx", "Holat"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/20">
                {(overview.recent_orders || []).slice(0, 4).map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-surface-container-high/40">
                    <td className="px-5 py-4 text-sm font-medium text-primary">#{o.id}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {initials(o.customer)}
                        </div>
                        <div>
                          <div className="font-medium text-on-surface">{o.customer}</div>
                          <div className="text-xs text-on-surface-variant">{formatPhone(o.customer_phone || "")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {o.firm_id ? (
                        <Link href={`/firmalar/${o.firm_id}`} className="text-primary hover:underline">
                          {o.firm}
                        </Link>
                      ) : (
                        <span className="text-on-surface-variant">{o.firm}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{o.service}</td>
                    <td className="px-5 py-4 text-sm font-semibold">{formatMoney(o.quoted_price)}</td>
                    <td className="px-5 py-4">
                      <StatusPill variant={ORDER_STATUS_TONE[o.status as OrderStatus]}>
                        {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="flex flex-col">
            <SectionTitle
              icon="storefront"
              title="Yangi firmalar"
              action={
                <Link href="/firmalar" className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                </Link>
              }
            />
            <div className="space-y-3">
              {(overview.new_firms || []).map((f) => (
                <Link
                  key={f.id}
                  href={`/firmalar/${f.id}`}
                  className="block rounded-xl border border-surface-variant/30 bg-surface-container-low/40 p-3 hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-on-surface">{f.name}</h4>
                    <StatusPill variant={f.status === "active" ? "success" : "warning"}>{f.status}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {SPECIALTY_LABEL[f.specialty] || f.specialty} · {f.region || "Hudud yo'q"}
                  </p>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">{f.address || f.phone}</p>
                  <p className="mt-1 text-[11px] text-primary">Ulush {f.commission_rate}% · {relativeTime(f.created_at)}</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col">
            <SectionTitle icon="heart_broken" title="Tugatilgan kelishuvlar" />
            <div className="space-y-3">
              {(overview.ended_firms || []).length === 0 ? (
                <p className="text-sm text-on-surface-variant">Tugatilgan firmalar yo&apos;q</p>
              ) : (
                (overview.ended_firms || []).map((f) => (
                  <Link
                    key={f.id}
                    href={`/firmalar/${f.id}`}
                    className="block rounded-xl border border-error/20 bg-error/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{f.name}</h4>
                      <StatusPill variant="error">Tugatilgan</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{f.exit_reason || "Sabab kiritilmagan"}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      {f.ended_at ? relativeTime(f.ended_at) : relativeTime(f.created_at)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
