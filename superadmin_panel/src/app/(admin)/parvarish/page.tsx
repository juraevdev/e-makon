"use client";

import { useState } from "react";
import {
  Breadcrumbs,
  DataTable,
  EmptyState,
  FilterChip,
  Modal,
  Pagination,
  SecondaryButton,
  StatusPill,
  TableSkeleton,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { CareContract, CareStatus } from "@/lib/api/types";
import {
  CARE_STATUS_LABEL,
  CARE_VISIT_STATUS_LABEL,
} from "@/lib/domain";
import { formatDate, formatPhone, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

const STATUS_FILTERS: { id: "all" | CareStatus; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "active", label: "Faol" },
  { id: "completed", label: "Tugagan" },
  { id: "cancelled", label: "Bekor qilingan" },
];

export default function ParvarishPage() {
  const { query } = useSearch();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | CareStatus>("all");
  const [selected, setSelected] = useState<CareContract | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/care-contracts/", {
      query: {
        page,
        page_size: 15,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: query || undefined,
      },
    });
    return asPage<CareContract>(raw);
  }, [page, statusFilter, query]);

  const contracts = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 15));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#26352c]/40">
        <div>
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Parvarish shartnomalari" }]} />
          <h2 className="text-xl font-bold text-white tracking-tight">Yillik parvarish shartnomalari</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Mijozlar bilan tuzilgan kafolatli parvarish shartnomalari va rejalashtirilgan tashriflar jurnali
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SecondaryButton icon="refresh" onClick={() => void reload()}>
            Yangilash
          </SecondaryButton>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            active={statusFilter === f.id}
            onClick={() => {
              setStatusFilter(f.id);
              setPage(1);
            }}
          />
        ))}
      </div>

      {/* Contracts Table */}
      {loading && !data ? (
        <TableSkeleton rows={6} cols={7} />
      ) : error ? (
        <div className="rounded-2xl border border-error/40 bg-[#291113] p-6 text-center">
          <span className="material-symbols-outlined text-error text-3xl mb-2">error</span>
          <p className="text-sm font-semibold text-white">Shartnomalarni yuklab bo&apos;lmadi</p>
          <p className="text-xs text-on-surface-variant mt-1">{error}</p>
          <div className="mt-4">
            <SecondaryButton icon="refresh" onClick={() => void reload()}>
              Qayta urinish
            </SecondaryButton>
          </div>
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="verified"
            title="Parvarish shartnomalari mavjud emas"
            description="Hozircha tizimda faol yoki yakunlangan yillik parvarish shartnomalari ro'yxatga olinmagan."
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-card-border bg-[#141816] overflow-hidden shadow-sm">
          <DataTable
            headers={[
              "Shartnoma #",
              "Mijoz",
              "Telefon",
              "Xizmat",
              "Maydon",
              "Muddat",
              "Tashriflar",
              "Holat",
              "Amallar",
            ]}
            footer={
              <Pagination
                current={page}
                pages={pageNumbers(page, totalPages)}
                onPageChange={setPage}
                info={
                  <>
                    Jami <strong className="text-primary">{totalCount}</strong> ta shartnoma
                  </>
                }
              />
            }
          >
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-[#26352c]/30 hover:bg-[#18211b]/50 transition-colors">
                <td className="px-4 py-3.5 text-xs font-bold text-white">
                  #{c.id} (Buyurtma #{c.order})
                </td>
                <td className="px-4 py-3.5 text-xs text-white font-medium">
                  {c.customer_name || "Mijoz"}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant font-mono">
                  {formatPhone(c.customer_phone || "")}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface">
                  {c.service_name || "Parvarish xizmati"}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant">
                  {c.area_size || "—"}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                  {formatDate(c.start_date)} — {formatDate(c.end_date)}
                </td>
                <td className="px-4 py-3.5 text-xs text-primary font-semibold">
                  {c.visits?.length || 0} ta tashrif
                </td>
                <td className="px-4 py-3.5 text-xs">
                  <StatusPill
                    variant={
                      c.status === "active"
                        ? "success"
                        : c.status === "completed"
                          ? "info"
                          : "neutral"
                    }
                  >
                    {CARE_STATUS_LABEL[c.status] || c.status}
                  </StatusPill>
                </td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] bg-[#121614] px-2.5 py-1 text-xs font-medium text-on-surface hover:border-primary/50 hover:text-primary transition-all"
                  >
                    Ko&apos;rish
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {/* Contract Detail Modal */}
      {selected && (
        <Modal
          open={!!selected}
          title={`Parvarish shartnomasi #${selected.id}`}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#26352c] bg-[#101412] p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Mijoz va xizmat ma&apos;lumotlari
                </h4>
                <div className="text-xs space-y-1.5 pt-1">
                  <p className="text-white font-semibold">
                    {selected.customer_name || "Mijoz"}
                  </p>
                  <p className="text-on-surface-variant">
                    Telefon: <span className="text-white font-mono">{formatPhone(selected.customer_phone || "")}</span>
                  </p>
                  <p className="text-on-surface-variant">
                    Xizmat: <span className="text-white">{selected.service_name || "Parvarish"}</span>
                  </p>
                  <p className="text-on-surface-variant">
                    Maydon o&apos;lchami: <span className="text-white">{selected.area_size || "—"}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#26352c] bg-[#101412] p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Shartnoma muddati va holati
                </h4>
                <div className="text-xs space-y-1.5 pt-1">
                  <p className="text-on-surface-variant">
                    Holat:{" "}
                    <StatusPill
                      variant={
                        selected.status === "active"
                          ? "success"
                          : selected.status === "completed"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {CARE_STATUS_LABEL[selected.status] || selected.status}
                    </StatusPill>
                  </p>
                  <p className="text-on-surface-variant">
                    Boshlanish: <span className="text-white">{formatDate(selected.start_date)}</span>
                  </p>
                  <p className="text-on-surface-variant">
                    Tugash: <span className="text-white">{formatDate(selected.end_date)}</span>
                  </p>
                  <p className="text-on-surface-variant">
                    Kelishilgan kunlar:{" "}
                    <span className="text-white font-semibold">
                      {Array.isArray(selected.preferred_weekdays) && selected.preferred_weekdays.length > 0
                        ? selected.preferred_weekdays.join(", ")
                        : "Belgilanmagan"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Visits Journal Table */}
            <div className="rounded-xl border border-[#26352c] bg-[#101412] p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                Rejalashtirilgan va amalga oshirilgan tashriflar ({selected.visits?.length || 0})
              </h4>

              {!selected.visits?.length ? (
                <p className="text-xs text-on-surface-variant py-4 text-center">
                  Hozircha biriktirilgan tashriflar mavjud emas
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#26352c]/50 text-on-surface-variant">
                        <th className="py-2 pr-3">Sana</th>
                        <th className="py-2 pr-3">Holat</th>
                        <th className="py-2 pr-3">Biriktirilgan xodim</th>
                        <th className="py-2">Hisobot izohi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#26352c]/30">
                      {selected.visits.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2.5 pr-3 text-white font-medium whitespace-nowrap">
                            {formatDate(v.visit_date)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="rounded bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
                              {CARE_VISIT_STATUS_LABEL[v.status] || v.status}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-on-surface">
                            {v.assigned_worker_name || "—"}
                          </td>
                          <td className="py-2.5 text-on-surface-variant">
                            {v.report_notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
