"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ExcelButton,
  LiveBadge,
  LoadingBlock,
  PageHeader,
  PrimaryButton,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import type { DashboardData } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
import { escapeHtml, formatMoney } from "@/lib/format";
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
  const e = escapeHtml;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${e(bundle.title)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{color:#1b6d24} table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}
    th{background:#eef7ee} .muted{color:#666;font-size:12px}
  </style></head><body>
  <h1>${e(bundle.title)}</h1>
  <p class="muted">Yaratilgan: ${e(bundle.generated_at)} · Davr: ${e(s.date_from)} — ${e(s.date_to)}</p>
  <h2>Umumiy ko'rsatkichlar</h2>
  <table>
    <tr><th>Firmalar</th><td>${e(s.firms_total)} (faol ${e(s.firms_active)})</td></tr>
    <tr><th>Investorlar</th><td>${e(s.investors_active)} / ${e(s.investors_total)}</td></tr>
    <tr><th>Faol buyurtmalar</th><td>${e(s.active_orders)}</td></tr>
    <tr><th>Davr buyurtmalari</th><td>${e(s.orders_in_period)}</td></tr>
    <tr><th>Umumiy aylanma</th><td>${e(s.revenue_done)} UZS</td></tr>
    <tr><th>Davr aylanmasi</th><td>${e(s.revenue_period)} UZS</td></tr>
    <tr><th>Kampaniya ulushi</th><td>${e(s.platform_share_total)} UZS</td></tr>
  </table>
  <h2>Firma aylanmalari</h2>
  <table><tr><th>Firma</th><th>Buyurtma</th><th>Aylanma</th><th>Stavka</th><th>Ulush</th></tr>
  ${(s.firm_revenues || []).map((f) => `<tr><td>${e(f.name)}</td><td>${e(f.orders)}</td><td>${e(f.revenue)}</td><td>${e(f.commission_rate)}%</td><td>${e(f.platform_share)}</td></tr>`).join("")}
  </table>
  <h2>Eng ko'p foydalanilgan xizmatlar</h2>
  <table><tr><th>Xizmat</th><th>Soni</th><th>Firmalar</th></tr>
  ${(s.top_services || []).map((x) => `<tr><td>${e(x.name)}</td><td>${e(x.orders)}</td><td>${e((x.firms || []).map((f) => f.name).join(", "))}</td></tr>`).join("")}
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

  const { data, loading, error, updatedAt } = useAsync(
    () => api<DashboardData>("/admin/dashboard/", { query }),
    [period, dateFrom, dateTo],
    { keepPrevious: true },
  );

  async function onPdf() {
    setPdfBusy(true);
    try {
      await downloadPdfReport(query);
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF yuklab bo'lmadi");
    } finally {
      setPdfBusy(false);
    }
  }

  if (loading && !data) return <LoadingBlock />;
  if (error && !data) return <p className="p-8 text-error">{error}</p>;
  if (!data) return null;

  const kpis = [
    {
      label: "Jami aylanma",
      value: formatMoney(data.revenue_done),
      icon: "payments",
      meta: `${data.completed_orders} bajarilgan`,
    },
    {
      label: "Davr aylanmasi",
      value: formatMoney(data.revenue_period),
      icon: "trending_up",
      meta: `${data.date_from} — ${data.date_to}`,
    },
    {
      label: "Kampaniya ulushi",
      value: formatMoney(data.platform_share_total),
      icon: "account_balance",
      meta: "Barcha firmalar",
    },
    {
      label: "O'rtacha chek",
      value: formatMoney(data.avg_check),
      icon: "receipt_long",
      meta: `${data.orders_in_period} buyurtma`,
    },
  ];

  const series = data.orders_series ?? [];
  const maxCount = Math.max(...series.map((p) => p.count || 0), 1);
  const firms = data.firm_revenues ?? [];
  const topServices = data.top_services ?? [];
  const leastServices = data.least_services ?? [];
  const topMax = Math.max(...topServices.map((s) => s.orders || 0), 1);

  function onExcel() {
    if (!data) return;
    downloadExcel(`hisobot_${data.date_from}_${data.date_to}`, [
      {
        name: "Umumiy",
        headers: ["Ko'rsatkich", "Qiymat"],
        rows: [
          ["Davr", `${data.date_from} — ${data.date_to}`],
          ["Firmalar (jami)", data.firms_total],
          ["Faol firmalar", data.firms_active],
          ["Faol buyurtmalar", data.active_orders],
          ["Davr buyurtmalari", data.orders_in_period],
          ["Bajarilgan buyurtmalar", data.completed_orders],
          ["Jami aylanma (UZS)", Number(data.revenue_done) || 0],
          ["Davr aylanmasi (UZS)", Number(data.revenue_period) || 0],
          ["Kampaniya ulushi (UZS)", Number(data.platform_share_total) || 0],
          ["O'rtacha chek (UZS)", Number(data.avg_check) || 0],
        ],
      },
      {
        name: "Firmalar",
        headers: ["Firma", "Buyurtma", "Aylanma (UZS)", "Stavka %", "Tavsiya %", "Ulush (UZS)"],
        rows: firms.map((f) => [
          f.name,
          f.orders,
          Number(f.revenue) || 0,
          Number(f.commission_rate) || 0,
          Number(f.suggested_rate) || 0,
          Number(f.platform_share) || 0,
        ]),
      },
      {
        name: "Dinamika",
        headers: ["Sana", "Buyurtmalar", "Aylanma (UZS)"],
        rows: series.map((p) => [p.label || p.day, p.count, Number(p.revenue) || 0]),
      },
      {
        name: "Xizmatlar",
        headers: ["Xizmat", "Buyurtmalar", "Firmalar"],
        rows: topServices.map((x) => [
          x.name,
          x.orders,
          (x.firms || []).map((f) => f.name).join(", "),
        ]),
      },
    ]);
  }

  return (
    <div className="p-4 text-ink md:p-8">
      <PageHeader
        title="Hisobotlar"
        description="Davr bo‘yicha aylanma, firma ulushi va xizmatlar statistikasi"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge updatedAt={updatedAt} />
            <ExcelButton onClick={onExcel} />
            <PrimaryButton icon="picture_as_pdf" disabled={pdfBusy} onClick={() => void onPdf()}>
              PDF yuklab olish
            </PrimaryButton>
          </div>
        }
      />

      <div className="emakon-panel-card mb-6 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors sm:px-5 ${
                  active
                    ? "border-primary/35 bg-secondary-container font-semibold text-primary"
                    : "border-card-border bg-surface-container-low text-ink-muted hover:border-outline-variant hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {period === "custom" ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-2 sm:w-auto">
              <input
                type="date"
                className={`${inputClass} sm:w-44`}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-ink-muted">—</span>
              <input
                type="date"
                className={`${inputClass} sm:w-44`}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          ) : null}
          {loading ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted">
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
              Yangilanmoqda…
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="emakon-panel-card min-w-0 p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
                {k.label}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary-container text-primary">
                <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
              </span>
            </div>
            <p className="truncate text-2xl font-extrabold tracking-tight text-ink">
              {k.value}
            </p>
            <p className="mt-2 truncate text-xs text-ink-muted">{k.meta}</p>
          </div>
        ))}
      </div>

      <div className="emakon-panel-card mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-card-border bg-surface-container-low px-5 py-4">
          <h3 className="text-base font-semibold text-ink md:text-lg">
            Firma aylanmalari va kampaniya ulushi
          </h3>
          <Link
            href="/firmalar"
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Barcha firmalar
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-border bg-surface-container-low text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                {["Firma", "Buyurtma", "Aylanma", "Stavka", "Tavsiya", "Ulush"].map((h) => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50">
              {firms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    Firma aylanmasi yo&apos;q
                  </td>
                </tr>
              ) : (
                firms.map((f) => (
                  <tr
                    key={f.id}
                    className="transition-colors hover:bg-surface-container-high/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/firmalar/${f.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink">{f.orders}</td>
                    <td className="px-5 py-3 font-semibold text-ink">
                      {formatMoney(f.revenue)}
                    </td>
                    <td className="px-5 py-3 text-ink">{f.commission_rate}%</td>
                    <td className="px-5 py-3 text-ink-muted">{f.suggested_rate}%</td>
                    <td className="px-5 py-3 font-medium text-primary">
                      {formatMoney(f.platform_share)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="emakon-panel-card min-w-0 p-5 md:p-6 lg:col-span-8">
          <h3 className="mb-5 text-base font-semibold text-ink md:text-lg">
            Buyurtmalar dinamikasi
          </h3>
          {series.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-muted">Buyurtmalar yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-surface-container-low px-2 py-3">
              <div
                className="flex h-64 min-w-full items-stretch gap-1.5"
                style={{ minWidth: series.length * 22 }}
              >
                {series.map((p, i) => (
                  <div
                    key={`${p.day}-${i}`}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full flex-1 flex-col items-center justify-end">
                      <span className="mb-1 text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        {p.count}
                      </span>
                      <div
                        className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-primary to-primary-fixed transition-all group-hover:brightness-110"
                        style={{
                          height: `${p.count ? Math.max(6, (p.count / maxCount) * 100) : 2}%`,
                        }}
                        title={`${p.label}: ${p.count} ta · ${formatMoney(p.revenue)}`}
                      />
                    </div>
                    <span className="text-[9px] text-ink-muted">
                      {(p.label || "").slice(5) || p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="emakon-panel-card p-5 md:p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">
              Eng ko&apos;p foydalanilgan
            </h3>
            <div className="space-y-3">
              {topServices.slice(0, 5).map((s) => (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink">{s.name}</span>
                    <span className="shrink-0 font-semibold text-primary">{s.orders}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max(4, (s.orders / topMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!topServices.length ? (
                <p className="text-sm text-ink-muted">Ma&apos;lumot yo&apos;q</p>
              ) : null}
            </div>
          </div>

          <div className="emakon-panel-card p-5 md:p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">
              Eng kam foydalanilgan
            </h3>
            <div className="space-y-3">
              {leastServices.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-card-border/70 bg-surface-container-low px-3 py-2.5 text-sm"
                >
                  <span className="truncate text-ink">{s.name}</span>
                  <span className="shrink-0 font-semibold text-ink-muted">{s.orders}</span>
                </div>
              ))}
              {!leastServices.length ? (
                <p className="text-sm text-ink-muted">Ma&apos;lumot yo&apos;q</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
