"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Field,
  inputClass,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api/client";
import type { FirmLedgerSummary, FirmStats, OrderStatus, PartnerFirm } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, SPECIALTY_LABEL } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

function statusTone(status: PartnerFirm["status"]) {
  if (status === "active") return "success" as const;
  if (status === "ended" || status === "suspended") return "error" as const;
  return "warning" as const;
}

function statusLabel(status: PartnerFirm["status"]) {
  if (status === "active") return "Faol";
  if (status === "suspended") return "Bloklangan";
  if (status === "ended") return "Tugatilgan";
  if (status === "pending") return "Sinov / kutilmoqda";
  return status;
}

export default function FirmaProfilPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rate, setRate] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [trialDays, setTrialDays] = useState("30");
  const [msgKind, setMsgKind] = useState<"message" | "warning" | "report">("message");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [banDays, setBanDays] = useState("7");
  const [debt, setDebt] = useState("");

  const { data, loading, error, reload } = useAsync(async () => {
    const [stats, ledger] = await Promise.all([
      api<FirmStats>(`/admin/firms/${id}/stats/`),
      api<FirmLedgerSummary>(`/admin/firms/${id}/ledger/`),
    ]);
    setRate(String(stats.firm.commission_rate));
    setDebt(String(stats.firm.debt_amount));
    return { ...stats, finance: ledger };
  }, [id]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : "Xato");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error || !data) return <p className="p-8 text-error">{error}</p>;

  const f = data.firm;

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/firmalar" className="text-xs text-primary hover:underline">
              ← Firmalar
            </Link>
            <span className="text-on-surface-variant">·</span>
            <button
              type="button"
              disabled={!data.prev_id}
              onClick={() => data.prev_id && router.push(`/firmalar/${data.prev_id}`)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] px-2 py-1 text-xs text-on-surface-variant disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Orqaga
            </button>
            <button
              type="button"
              disabled={!data.next_id}
              onClick={() => data.next_id && router.push(`/firmalar/${data.next_id}`)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] px-2 py-1 text-xs text-on-surface-variant disabled:opacity-40"
            >
              Oldinga
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-on-surface">{f.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {f.specialty_label || SPECIALTY_LABEL[f.specialty]} · {formatPhone(f.phone)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-amber-300">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
            {Number(f.rating).toFixed(1)} · {f.ratings_count} mijoz bahosi
            {f.is_sales_banned ? (
              <span className="rounded-md bg-error/20 px-2 py-0.5 text-[11px] text-error">
                Savdo taqiq: {f.sales_banned_until ? formatDateTime(f.sales_banned_until) : "—"}
              </span>
            ) : null}
          </p>
        </div>
        <StatusPill variant={statusTone(f.status)}>{statusLabel(f.status)}</StatusPill>
      </div>

      {err ? <p className="rounded-xl border border-error/40 bg-error/10 px-4 py-2 text-sm text-error">{err}</p> : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Daromad (aylanma)", value: formatMoney(data.revenue) },
          { label: "Kampaniya ulushi", value: formatMoney(data.platform_share) },
          { label: "Escrowda", value: formatMoney(data.finance.held_in_escrow) },
          { label: "Firmaga to'langan", value: formatMoney(data.finance.paid_to_firm) },
          { label: "Userga qaytarilgan", value: formatMoney(data.finance.refunded) },
          { label: "Qarz", value: formatMoney(data.finance.debt) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#26352c] bg-[#151917] p-4">
            <p className="text-xs text-on-surface-variant">{k.label}</p>
            <p className="mt-1 text-lg font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-4 text-sm text-on-surface-variant">
        <p className="font-semibold text-primary">To&apos;lov oqimi (escrow)</p>
        <p className="mt-1">
          User → E-Makon (ushlab turiladi) → Firma ishni tugatadi → Firmaga to&apos;lov (ulush E-Makonda qoladi).
          Firma ishsiz pul talab qilsa yoki tovlamachilik bo&apos;lsa — pul userga qaytariladi, firma jazolanishi mumkin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
          <h2 className="mb-4 text-lg font-bold">Profil</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-on-surface-variant">Yuridik nomi: </span>{f.legal_name || "—"}</p>
            <p><span className="text-on-surface-variant">Email: </span>{f.email || "—"}</p>
            <p><span className="text-on-surface-variant">Manzil: </span>{f.address || "—"}</p>
            <p><span className="text-on-surface-variant">Hudud: </span>{[f.region, f.district].filter(Boolean).join(", ") || "—"}</p>
            <p><span className="text-on-surface-variant">Tavsif: </span>{f.description || "—"}</p>
            <p>
              <span className="text-on-surface-variant">Obuna: </span>
              {f.subscription_plan === "none"
                ? "Yo'q"
                : `${f.subscription_plan === "monthly" ? "Oylik" : "Yillik"} · ${f.subscription_units} o'rin · $${f.subscription_fee_usd}`}
              {f.subscription_plan === "yearly" ? (
                <span className="text-on-surface-variant"> (oylik bo‘lsa ${f.subscription_yearly_if_monthly_usd})</span>
              ) : null}
            </p>
            <p>
              <span className="text-on-surface-variant">Sinov: </span>
              {f.trial_ends_at ? formatDateTime(f.trial_ends_at) : "Doimiy"}
            </p>
            <p><span className="text-on-surface-variant">Ogohlantirishlar: </span>{f.warnings_count}</p>
            {f.status === "ended" || f.status === "suspended" ? (
              <p className="text-error"><span className="text-on-surface-variant">Sabab: </span>{f.exit_reason || "—"}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
          <h2 className="mb-4 text-lg font-bold">Ulush va qarz</h2>
          <p className="mb-3 text-sm text-on-surface-variant">
            Tavsiya: <strong className="text-primary">{data.suggested_rate}%</strong> (0.1%–3%)
          </p>
          <Field label="Kampaniya ulushi (%)">
            <input className={inputClass} type="number" step="0.1" min="0.1" max="3" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(`/admin/firms/${id}/`, { method: "PATCH", body: { commission_rate: Number(rate) } });
                })
              }
            >
              Ulushni saqlash
            </PrimaryButton>
            <SecondaryButton
              disabled={busy}
              onClick={() => void run(async () => { await api(`/admin/firms/${id}/apply_suggested_rate/`, { method: "POST" }); })}
            >
              Avtomatik
            </SecondaryButton>
          </div>

          <div className="mt-5 border-t border-[#26352c] pt-4">
            <Field label="Qarz (UZS)">
              <div className="flex gap-2">
                <input className={inputClass} type="number" min="0" value={debt} onChange={(e) => setDebt(e.target.value)} />
                <SecondaryButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/admin/firms/${id}/adjust_debt/`, {
                        method: "POST",
                        body: { amount: Number(debt) || 0 },
                      });
                    })
                  }
                >
                  Belgilash
                </SecondaryButton>
              </div>
            </Field>
          </div>

          <div className="mt-5 space-y-3 border-t border-[#26352c] pt-4">
            <Field label="Sinov (kun)">
              <div className="flex gap-2">
                <input className={inputClass} type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                <SecondaryButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/admin/firms/${id}/set_trial/`, { method: "POST", body: { days: Number(trialDays) || 0 } });
                    })
                  }
                >
                  Belgilash
                </SecondaryButton>
              </div>
            </Field>
            <Field label="Blok / tugatish sababi">
              <input className={inputClass} value={exitReason} onChange={(e) => setExitReason(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {f.status === "suspended" ? (
                <PrimaryButton disabled={busy} onClick={() => void run(async () => { await api(`/admin/firms/${id}/unblock/`, { method: "POST" }); })}>
                  Blokdan chiqarish
                </PrimaryButton>
              ) : f.status !== "ended" ? (
                <SecondaryButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (!confirm("Bloklashni tasdiqlaysizmi?")) return;
                      await api(`/admin/firms/${id}/block/`, { method: "POST", body: { reason: exitReason || "Admin blokladi" } });
                    })
                  }
                >
                  Vaqtincha bloklash
                </SecondaryButton>
              ) : null}
              {f.status !== "ended" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (!confirm("Kelishuvni tugatish?")) return;
                      await api(`/admin/firms/${id}/end_agreement/`, { method: "POST", body: { exit_reason: exitReason } });
                    })
                  }
                  className="text-sm text-error hover:underline"
                >
                  Kelishuvni tugatish
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
          <h2 className="mb-2 text-lg font-bold">Xabar / ogohlantirish / hisobot</h2>
          <p className="mb-4 text-xs text-on-surface-variant">
            Jarima va savdo taqiqi faqat ogohlantirish yoki hisobotdan keyin beriladi.
          </p>
          <div className="space-y-3">
            <Field label="Turi">
              <select className={inputClass} value={msgKind} onChange={(e) => setMsgKind(e.target.value as typeof msgKind)}>
                <option value="message">Xabar</option>
                <option value="warning">Ogohlantirish</option>
                <option value="report">Hisobot</option>
              </select>
            </Field>
            <Field label="Mavzu">
              <input className={inputClass} value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} />
            </Field>
            <Field label="Matn">
              <textarea className={`${inputClass} min-h-[90px]`} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} />
            </Field>
            <PrimaryButton
              disabled={busy || !msgBody.trim()}
              onClick={() =>
                void run(async () => {
                  await api(`/admin/firms/${id}/send_message/`, {
                    method: "POST",
                    body: { kind: msgKind, subject: msgSubject, body: msgBody },
                  });
                  setMsgBody("");
                  setMsgSubject("");
                })
              }
            >
              Yuborish
            </PrimaryButton>
          </div>
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
            {data.messages.map((m) => (
              <li key={m.id} className="rounded-xl border border-[#26352c]/80 p-3">
                <p className="text-[11px] text-on-surface-variant">
                  {m.kind} · {m.sender_name} · {formatDateTime(m.created_at)}
                </p>
                {m.subject ? <p className="font-medium">{m.subject}</p> : null}
                <p className="text-on-surface-variant">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
            <h2 className="mb-4 text-lg font-bold">Jarima</h2>
            <Field label="Summa (UZS)">
              <input className={inputClass} type="number" min="0" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} />
            </Field>
            <Field label="Sabab">
              <input className={inputClass} value={fineReason} onChange={(e) => setFineReason(e.target.value)} />
            </Field>
            <div className="mt-3">
              <PrimaryButton
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`/admin/firms/${id}/add_fine/`, {
                      method: "POST",
                      body: { amount: Number(fineAmount), reason: fineReason },
                    });
                    setFineAmount("");
                    setFineReason("");
                  })
                }
              >
                Jarima belgilash
              </PrimaryButton>
            </div>
            <ul className="mt-4 max-h-36 space-y-2 overflow-y-auto text-sm">
              {data.fines.map((fine) => (
                <li key={fine.id} className="flex justify-between gap-2 border-b border-[#26352c]/50 py-2">
                  <span>{fine.reason}</span>
                  <span className={fine.is_paid ? "text-primary" : "text-error"}>{formatMoney(fine.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
            <h2 className="mb-4 text-lg font-bold">Savdo taqiqi</h2>
            <Field label="Kunlar">
              <input className={inputClass} type="number" min="1" value={banDays} onChange={(e) => setBanDays(e.target.value)} />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`/admin/firms/${id}/ban_sales/`, {
                      method: "POST",
                      body: { days: Number(banDays) || 7, reason: exitReason },
                    });
                  })
                }
              >
                Taqiqlash
              </SecondaryButton>
              {f.is_sales_banned ? (
                <PrimaryButton
                  disabled={busy}
                  onClick={() => void run(async () => { await api(`/admin/firms/${id}/lift_sales_ban/`, { method: "POST" }); })}
                >
                  Taqiqni olish
                </PrimaryButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
        <h2 className="mb-4 text-lg font-bold">Hisob-kitob (avtomatik ledger)</h2>
        <p className="mb-3 text-xs text-on-surface-variant">
          Foiz oshirish, jarima, escrow to&apos;lov/qaytarish — hammasi shu yerda yoziladi.
        </p>
        {!data.finance.ledger.length ? (
          <p className="text-sm text-on-surface-variant">Hali yozuv yo&apos;q</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {data.finance.ledger.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-[#26352c]/50 py-2">
                <div>
                  <p className="font-medium text-primary">{e.entry_type_label}</p>
                  <p className="text-on-surface-variant">{e.note || `${e.debit_label} → ${e.credit_label}`}</p>
                  <p className="text-[11px] text-on-surface-variant">{formatDateTime(e.created_at)}</p>
                </div>
                <p className="font-semibold">{Number(e.amount) ? formatMoney(e.amount) : "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
          <h2 className="mb-4 text-lg font-bold">Mijoz baholari</h2>
          {!data.reviews.length ? (
            <p className="text-sm text-on-surface-variant">Hali baho yo&apos;q</p>
          ) : (
            <ul className="max-h-64 space-y-3 overflow-y-auto">
              {data.reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-[#26352c]/60 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{r.customer_name || r.customer_phone}</span>
                    <span className="text-amber-300">{"★".repeat(r.score)}</span>
                  </div>
                  {r.comment ? <p className="mt-1 text-on-surface-variant">{r.comment}</p> : null}
                  <p className="mt-1 text-[11px] text-on-surface-variant">{formatDateTime(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
          <h2 className="mb-4 text-lg font-bold">Nazorat tarixi</h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {data.moderation_logs.map((log) => (
              <li key={log.id} className="border-b border-[#26352c]/40 py-2">
                <p className="font-medium text-primary">{log.action_label}</p>
                <p className="text-on-surface-variant">{log.note || "—"}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {log.created_by_name} · {formatDateTime(log.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-[#26352c] bg-[#151917] p-6">
        <h2 className="mb-4 text-lg font-bold">Xizmatlar bo&apos;yicha</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.by_service.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#26352c]/60 p-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{s.icon}</span>
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <div className="text-right text-xs">
                <p>{s.orders} buyurtma</p>
                <p className="text-primary">{formatMoney(s.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
        <h2 className="border-b border-[#26352c] p-6 text-lg font-bold">So&apos;nggi buyurtmalar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#26352c] text-xs uppercase text-on-surface-variant">
                {["ID", "Mijoz", "Xizmat", "Narx", "Ulush", "Holat", "Sana"].map((h) => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26352c]/40">
              {data.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3 text-primary">#{o.id}</td>
                  <td className="px-5 py-3">{o.customer_name || o.customer_phone}</td>
                  <td className="px-5 py-3">{o.service_name}</td>
                  <td className="px-5 py-3">{formatMoney(o.quoted_price)}</td>
                  <td className="px-5 py-3 text-primary">{formatMoney(o.platform_share)}</td>
                  <td className="px-5 py-3">
                    <StatusPill variant={ORDER_STATUS_TONE[o.status as OrderStatus]}>
                      {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
