"use client";

import { EmptyState, LoadingBlock, SecondaryButton, StatCard, StatusPill } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { FirmLedgerSummary, OrderEscrow } from "@/lib/api/types";
import { ESCROW_LABEL } from "@/lib/domain";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useFirm } from "@/providers/FirmProvider";

const ESCROW_TONE: Record<OrderEscrow["status"], "success" | "warning" | "error" | "neutral" | "info"> = {
  awaiting_payment: "warning",
  held: "info",
  released: "success",
  refunded: "neutral",
  disputed: "error",
  frozen: "error",
};

export default function MoliyaPage() {
  const { firm } = useFirm();

  const { data, loading, error, reload } = useAsync(async () => {
    if (!firm) return null;
    return api<FirmLedgerSummary>(`/admin/firms/${firm.id}/ledger/`);
  }, [firm?.id]);

  if (!firm || loading) return <LoadingBlock />;
  if (error) return <p className="p-8 text-error">{error}</p>;
  if (!data) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Mijoz to&apos;lovi avval E-Makon hisobida ushlanadi. Ish yakunlanib, tizim ma&apos;muriyati tasdiqlagach
          platforma ulushi ({firm.commission_rate}%) ayirilib, qolgan summa firmangizga o&apos;tkaziladi.
        </p>
        <SecondaryButton icon="refresh" onClick={() => void reload()}>
          Yangilash
        </SecondaryButton>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tizim hisobida ushlangan"
          value={formatMoney(data.held_in_escrow)}
          icon="account_balance"
          hint="Ish yakunlanishini kutayotgan to'lovlar"
        />
        <StatCard
          label="Firmaga o'tkazilgan"
          value={formatMoney(data.paid_to_firm)}
          icon="payments"
          hint="Yakunlangan ishlar bo'yicha"
        />
        <StatCard label="Platforma ulushi" value={formatMoney(data.platform_fees)} icon="percent" />
        <StatCard
          label="Mijozlarga qaytarilgan"
          value={formatMoney(data.refunded)}
          icon="undo"
          hint={Number(data.debt) > 0 ? `Qarz: ${formatMoney(data.debt)}` : undefined}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90">
        <h3 className="border-b border-[#263b2a] px-5 py-4 text-sm font-bold">Buyurtmalar bo&apos;yicha to&apos;lovlar</h3>
        {!data.escrows.length ? (
          <EmptyState icon="receipt_long" title="Hali to'lovlar yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#263b2a] text-xs uppercase text-on-surface-variant">
                  {["Buyurtma", "Holat", "Mijoz to'lagan", "Platforma ulushi", "Sizga", "To'langan", "O'tkazilgan"].map((h) => (
                    <th key={h} className="px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263b2a]/40">
                {data.escrows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 font-semibold text-primary">#{e.order_id}</td>
                    <td className="px-5 py-3">
                      <StatusPill variant={ESCROW_TONE[e.status]}>{e.status_label || ESCROW_LABEL[e.status]}</StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">{formatMoney(e.amount, e.currency)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-on-surface-variant">{formatMoney(e.platform_fee)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-primary">{formatMoney(e.firm_payout)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-on-surface-variant">{formatDateTime(e.paid_at)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-on-surface-variant">{formatDateTime(e.released_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90">
        <h3 className="border-b border-[#263b2a] px-5 py-4 text-sm font-bold">Hisob-kitob jurnali</h3>
        {!data.ledger.length ? (
          <EmptyState icon="menu_book" title="Jurnal bo'sh" />
        ) : (
          <div className="divide-y divide-[#263b2a]/40">
            {data.ledger.map((l) => (
              <div key={l.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {l.entry_type_label}
                    {l.order ? <span className="text-on-surface-variant"> · #{l.order}</span> : null}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {l.debit_label} → {l.credit_label}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatMoney(l.amount, l.currency)}</p>
                  <p className="text-xs text-on-surface-variant">{formatDateTime(l.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
