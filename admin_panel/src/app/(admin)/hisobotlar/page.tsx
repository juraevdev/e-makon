"use client";

import { useMemo, useState } from "react";
import { ExcelButton, LoadingBlock, PrimaryButton, inputClass } from "@/components/ui";
import { PageBar } from "@/components/firm/PageBar";
import { api } from "@/lib/api/client";
import type { DashboardData, OrderStatus } from "@/lib/api/types";
import { ORDER_STATUS_LABEL } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { escapeHtml, formatMoney } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/providers/ToastProvider";

const PERIODS = [
  { id: "day", label: "Kunlik" },
  { id: "week", label: "Haftalik" },
  { id: "month", label: "Oylik" },
  { id: "season", label: "Mavsumiy" },
  { id: "year", label: "Yillik" },
  { id: "custom", label: "Oraliq" },
] as const;

const statusLabel = (status: string) => ORDER_STATUS_LABEL[status as OrderStatus] ?? status;

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
    <tr><th>Faol buyurtmalar</th><td>${e(s.active_orders)}</td></tr>
    <tr><th>Davr buyurtmalari</th><td>${e(s.orders_in_period)}</td></tr>
    <tr><th>Bajarilgan buyurtmalar</th><td>${e(s.completed_orders)}</td></tr>
    <tr><th>Umumiy aylanma</th><td>${e(s.revenue_done)} UZS</td></tr>
    <tr><th>Davr aylanmasi</th><td>${e(s.revenue_period)} UZS</td></tr>
    <tr><th>O'rtacha chek</th><td>${e(s.avg_check)} UZS</td></tr>
    <tr><th>Platforma ulushi</th><td>${e(s.platform_share_total)} UZS</td></tr>
  </table>
  <h2>Buyurtmalar holati</h2>
  <table><tr><th>Holat</th><th>Soni</th></tr>
  ${(s.orders_by_status || []).map((r) => `<tr><td>${e(statusLabel(r.status))}</td><td>${e(r.count)}</td></tr>`).join("")}
  </table>
  <h2>Eng ko'p foydalanilgan xizmatlar</h2>
  <table><tr><th>Xizmat</th><th>Soni</th><th>Aylanma</th></tr>
  ${(s.top_services || []).map((x) => `<tr><td>${e(x.name)}</td><td>${e(x.orders)}</td><td>${e(x.revenue)}</td></tr>`).join("")}
  </table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const win = window.open("", "_blank");
  if (!win) throw new Error("Popup bloklandi — PDF uchun ruxsat bering");
  win.document.write(html);
  win.document.close();
}

export default function HisobotlarPage() {
  const { showError } = useToast();
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
      showError(err instanceof Error ? err.message : "PDF tayyorlanmadi");
    } finally {
      setPdfBusy(false);
    }
  }

  function onExcel() {
    if (!data) return;
    const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? period;
    const services = [
      ...(data.top_services ?? []).map((s) => ["Eng ko'p", s.name, s.orders, Number(s.revenue)]),
      ...(data.least_services ?? []).map((s) => ["Eng kam", s.name, s.orders, Number(s.revenue)]),
    ];
    downloadExcel(`hisobot_${period}`, [
      {
        name: "Ko'rsatkichlar",
        headers: ["Ko'rsatkich", "Qiymat"],
        rows: [
          ["Davr", `${periodLabel}: ${data.date_from} — ${data.date_to}`],
          ["Faol buyurtmalar", data.active_orders],
          ["Davr buyurtmalari", data.orders_in_period],
          ["Bajarilgan buyurtmalar", data.completed_orders],
          ["Jami aylanma (UZS)", Number(data.revenue_done)],
          ["Davr aylanmasi (UZS)", Number(data.revenue_period)],
          ["O'rtacha chek (UZS)", Number(data.avg_check)],
          ["Platforma ulushi (UZS)", Number(data.platform_share_total)],
        ],
      },
      {
        name: "Holatlar",
        headers: ["Holat", "Soni"],
        rows: (data.orders_by_status ?? []).map((r) => [statusLabel(r.status), r.count]),
      },
      {
        name: "Dinamika",
        headers: ["Sana", "Buyurtmalar", "Aylanma (UZS)"],
        rows: (data.orders_series ?? []).map((p) => [p.label || p.day || "", p.count, Number(p.revenue)]),
      },
      {
        name: "Xizmatlar",
        headers: ["Guruh", "Xizmat", "Buyurtmalar", "Aylanma (UZS)"],
        rows: services,
      },
    ]);
  }

  if (loading && !data) return <LoadingBlock />;
  if (!data) return <p className="p-8 text-error">{error}</p>;

  const kpis = [
    { label: "Jami aylanma", value: formatMoney(data.revenue_done), icon: "payments", meta: `${data.completed_orders} bajarilgan` },
    { label: "Davr aylanmasi", value: formatMoney(data.revenue_period), icon: "trending_up", meta: `${data.date_from} — ${data.date_to}` },
    { label: "Platforma ulushi", value: formatMoney(data.platform_share_total), icon: "account_balance", meta: "Yakunlangan ishlardan" },
    { label: "O'rtacha chek", value: formatMoney(data.avg_check), icon: "receipt_long", meta: `${data.orders_in_period} buyurtma` },
  ];

  const series = data.orders_series ?? [];
  const maxCount = Math.max(...series.map((p) => p.count || 0), 1);
  const topServices = data.top_services ?? [];
  const leastServices = data.least_services ?? [];
  const topMax = Math.max(...topServices.map((s) => s.orders || 0), 1);

  return (
    <div className="p-4 text-ink md:p-8">
      <div className="mb-6">
        <PageBar
          title="Hisobotlar"
          updatedAt={updatedAt}
          description="Tanlangan davr bo‘yicha buyurtmalar, aylanma va xizmatlar statistikasi. PDF chop etish, Excel esa tahlil uchun."
          actions={
            <>
              <ExcelButton onClick={onExcel} />
              <PrimaryButton icon="picture_as_pdf" disabled={pdfBusy} onClick={() => void onPdf()}>
                PDF yuklab olish
              </PrimaryButton>
            </>
          }
        />
      </div>

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
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
            <p className="truncate text-2xl font-extrabold tracking-tight text-ink">{k.value}</p>
            <p className="mt-2 truncate text-xs text-ink-muted">{k.meta}</p>
          </div>
        ))}
      </div>

      <div className="emakon-panel-card mb-6 overflow-hidden">
        <h3 className="border-b border-card-border bg-surface-container-low px-5 py-4 text-base font-semibold text-ink">
          Buyurtmalar holati bo&apos;yicha
        </h3>
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5 md:gap-4 md:p-5">
          {(data.orders_by_status ?? []).map((row) => (
            <div
              key={row.status}
              className="rounded-xl border border-card-border bg-surface-container-low p-4"
            >
              <p className="text-sm text-ink-muted">{statusLabel(row.status)}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{row.count}</p>
            </div>
          ))}
          {!data.orders_by_status?.length ? (
            <p className="col-span-full py-6 text-center text-sm text-ink-muted">Ma&apos;lumot yo&apos;q</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="emakon-panel-card min-w-0 p-5 md:p-6 lg:col-span-8">
          <h3 className="mb-5 text-base font-semibold text-ink md:text-lg">Buyurtmalar dinamikasi</h3>
          {series.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-muted">Buyurtmalar yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-surface-container-low px-2 py-3">
              <div
                className="flex h-64 min-w-full items-stretch gap-1.5"
                style={{ minWidth: series.length * 22 }}
              >
                {series.map((p, i) => {
                  const pct = p.count ? Math.max(6, (p.count / maxCount) * 100) : 2;
                  return (
                    <div key={`${p.day}-${i}`} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex w-full flex-1 flex-col items-center justify-end">
                        <span className="mb-1 text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          {p.count}
                        </span>
                        <div
                          className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-primary to-primary-fixed transition-all group-hover:brightness-110"
                          style={{ height: `${pct}%` }}
                          title={`${p.label}: ${p.count} ta · ${formatMoney(p.revenue)}`}
                        />
                      </div>
                      <span className="text-[9px] text-ink-muted">
                        {(p.label || "").slice(5) || p.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="emakon-panel-card p-5 md:p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Eng ko&apos;p foydalanilgan</h3>
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
              {!topServices.length ? <p className="text-sm text-ink-muted">Ma&apos;lumot yo&apos;q</p> : null}
            </div>
          </div>
          <div className="emakon-panel-card p-5 md:p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Eng kam foydalanilgan</h3>
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
              {!leastServices.length ? <p className="text-sm text-ink-muted">Ma&apos;lumot yo&apos;q</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
