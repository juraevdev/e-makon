"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadingBlock, PrimaryButton, inputClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { DashboardData } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

const PERIODS = [
  { id: "day", label: "Kunlik" },
  { id: "week", label: "Haftalik" },
  { id: "month", label: "Oylik" },
  { id: "season", label: "Mavsumiy" },
  { id: "year", label: "Yillik" },
  { id: "custom", label: "Oraliq" },
] as const;

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
  <h2>Eng ko'p foydalanilgan xizmatlar</h2>
  <table><tr><th>Xizmat</th><th>Soni</th><th>Firmalar</th></tr>
  ${(s.top_services || []).map((x) => `<tr><td>${x.name}</td><td>${x.orders}</td><td>${(x.firms || []).map((f) => f.name).join(", ")}</td></tr>`).join("")}
  </table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const win = window.open("", "_blank");
  if (!win) throw new Error("Popup bloklandi — PDF uchun ruxsat bering");
  win.document.write(html);
  win.document.close();
}

export default function HisobotlarPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const query = useMemo(() => {
    if (period === "custom") {
      return {
        period: "custom",
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      };
    }
    return { period };
  }, [period, dateFrom, dateTo]);

  const { data, loading, error } = useAsync(
    () => api<DashboardData>("/admin/dashboard/", { query }),
    [period, dateFrom, dateTo],
  );

  async function onPdf() {
    setPdfBusy(true);
    try {
      await downloadPdfReport(query);
    } finally {
      setPdfBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error || !data) return <p className="p-8 text-error">{error}</p>;

  const kpis = [
    { label: "Jami aylanma", value: formatMoney(data.revenue_done), icon: "payments", meta: `${data.completed_orders} bajarilgan` },
    { label: "Davr aylanmasi", value: formatMoney(data.revenue_period), icon: "trending_up", meta: `${data.date_from} — ${data.date_to}` },
    { label: "Kampaniya ulushi", value: formatMoney(data.platform_share_total), icon: "account_balance", meta: "Barcha firmalar" },
    { label: "O'rtacha chek", value: formatMoney(data.avg_check), icon: "receipt_long", meta: `${data.orders_in_period} buyurtma` },
  ];

  const series = data.orders_series ?? [];
  const maxCount = Math.max(...series.map((p) => p.count || 0), 1);
  const firms = data.firm_revenues ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`rounded-full border px-5 py-2 text-sm ${
              period === p.id
                ? "border-primary/40 bg-[#16271c] font-semibold text-primary"
                : "border-[#233527]/60 bg-[#111613] text-[#9ea7a0]"
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="text-on-surface-variant">—</span>
            <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        ) : null}
        <div className="ml-auto">
          <PrimaryButton icon="picture_as_pdf" disabled={pdfBusy} onClick={() => void onPdf()}>
            PDF yuklab olish
          </PrimaryButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-5">
            <div className="mb-3 flex items-start justify-between">
              <span className="text-xs font-semibold tracking-wider text-[#8c978f] uppercase">{k.label}</span>
              <span className="material-symbols-outlined text-primary">{k.icon}</span>
            </div>
            <p className="text-2xl font-extrabold text-[#f1f5f2]">{k.value}</p>
            <p className="mt-2 text-xs text-[#707c74]">{k.meta}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-[#233527]/70 bg-[#111613]">
        <div className="flex items-center justify-between border-b border-[#233527]/60 p-5">
          <h3 className="text-lg font-semibold">Firma aylanmalari va kampaniya ulushi</h3>
          <Link href="/firmalar" className="text-xs font-semibold text-primary hover:underline">
            Barcha firmalar
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#233527]/60 text-xs uppercase text-on-surface-variant">
                {["Firma", "Buyurtma", "Aylanma", "Stavka", "Tavsiya", "Ulush"].map((h) => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#233527]/40">
              {firms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-on-surface-variant">
                    Firma aylanmasi yo&apos;q
                  </td>
                </tr>
              ) : (
                firms.map((f) => (
                  <tr key={f.id} className="hover:bg-[#162119]/50">
                    <td className="px-5 py-3">
                      <Link href={`/firmalar/${f.id}`} className="font-medium text-primary hover:underline">
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{f.orders}</td>
                    <td className="px-5 py-3 font-semibold">{formatMoney(f.revenue)}</td>
                    <td className="px-5 py-3">{f.commission_rate}%</td>
                    <td className="px-5 py-3 text-on-surface-variant">{f.suggested_rate}%</td>
                    <td className="px-5 py-3 text-primary">{formatMoney(f.platform_share)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-6 lg:col-span-8">
          <h3 className="mb-5 text-lg font-semibold text-on-surface">Buyurtmalar dinamikasi</h3>
          {series.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">Buyurtmalar yo&apos;q</p>
          ) : (
            <div className="flex h-64 items-end gap-1.5 px-2">
              {series.map((p, i) => (
                <div key={`${p.day}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-primary-container to-primary/80"
                    style={{ height: `${Math.max(8, (p.count / maxCount) * 100)}%` }}
                    title={`${p.count} · ${formatMoney(p.revenue)}`}
                  />
                  <span className="text-[9px] text-on-surface-variant">{(p.label || "").slice(5) || p.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-6">
            <h3 className="mb-4 text-lg font-semibold">Eng ko&apos;p foydalanilgan</h3>
            <div className="space-y-3">
              {(data.top_services ?? []).slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-on-surface-variant">{s.name}</span>
                  <span className="shrink-0 font-semibold text-primary">{s.orders}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#233527]/70 bg-[#111613] p-6">
            <h3 className="mb-4 text-lg font-semibold">Eng kam foydalanilgan</h3>
            <div className="space-y-3">
              {(data.least_services ?? []).slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-on-surface-variant">{s.name}</span>
                  <span className="shrink-0 font-semibold">{s.orders}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
