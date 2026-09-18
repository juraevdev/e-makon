"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  Modal,
  PageHeader,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { Investor } from "@/lib/api/types";
import { formatMoney, formatPhone, relativeTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

export default function InvestorlarPage() {
  const { query } = useSearch();
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Investor | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    phone: "",
    email: "",
    investment_amount: "",
    share_percent: "",
    notes: "",
  });

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/investors/", {
      query: { page_size: 100, search: query || undefined },
    });
    return asPage<Investor>(raw);
  }, [query]);

  const list = useMemo(() => {
    const all = data?.results ?? [];
    if (filter === "active") return all.filter((i) => i.status === "active");
    if (filter === "ended") return all.filter((i) => i.status === "ended");
    return all;
  }, [data, filter]);

  async function createInvestor() {
    setBusy(true);
    try {
      await api("/admin/investors/", {
        method: "POST",
        body: {
          ...form,
          investment_amount: Number(form.investment_amount || 0),
          share_percent: Number(form.share_percent || 0),
          status: "active",
        },
      });
      setOpen(false);
      setForm({
        full_name: "",
        company_name: "",
        phone: "",
        email: "",
        investment_amount: "",
        share_percent: "",
        notes: "",
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function endInvestor(inv: Investor) {
    const reason = prompt("Chiqish sababi?") || "";
    await api(`/admin/investors/${inv.id}/end_agreement/`, {
      method: "POST",
      body: { exit_reason: reason },
    });
    await reload();
    setDetail(null);
  }

  const all = data?.results ?? [];

  return (
    <div className="flex-1 px-4 py-6 md:px-8">
      <PageHeader
        title="Investor hamkorlar"
        description="Platformaga kapital kiritgan investorlar — profil, ulush va kelishuv statusi."
      />

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-primary-container/30 bg-[#141916]/90 p-2">
        {[
          { id: "all" as const, label: "Barchasi", count: all.length },
          { id: "active" as const, label: "Faol", count: all.filter((i) => i.status === "active").length },
          { id: "ended" as const, label: "Tugatilgan", count: all.filter((i) => i.status === "ended").length },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-xl px-3.5 py-2 text-sm ${
              filter === f.id ? "border border-primary/40 bg-primary-container/25 font-semibold text-primary" : "text-on-surface-variant"
            }`}
          >
            {f.label} <span className="ml-1 text-xs opacity-70">{f.count}</span>
          </button>
        ))}
        <div className="ml-auto">
          <PrimaryButton icon="person_add" onClick={() => setOpen(true)}>
            Yangi investor
          </PrimaryButton>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !list.length ? (
        <EmptyState icon="handshake" title="Investorlar yo'q" action={<PrimaryButton onClick={() => setOpen(true)}>Qo'shish</PrimaryButton>} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setDetail(i)}
              className="rounded-2xl border border-primary-container/35 bg-gradient-to-b from-[#151a18] to-[#101412] p-5 text-left hover:border-primary/60"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{i.full_name}</h3>
                  <p className="text-xs text-on-surface-variant">{i.company_name || "Shaxsiy investor"}</p>
                </div>
                <StatusPill variant={i.status === "active" ? "success" : "error"}>{i.status}</StatusPill>
              </div>
              <p className="text-xs text-on-surface-variant">{formatPhone(i.phone)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs">
                <div>
                  <p className="text-on-surface-variant">Investitsiya</p>
                  <p className="font-semibold">{formatMoney(i.investment_amount, i.currency)}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant">Ulush</p>
                  <p className="font-semibold text-primary">{i.share_percent}%</p>
                </div>
              </div>
              {i.status === "ended" ? (
                <p className="mt-2 text-xs text-error">{i.exit_reason || "Sabab yo'q"}</p>
              ) : (
                <p className="mt-2 text-[11px] text-on-surface-variant">{relativeTime(i.created_at)}</p>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal open={open} title="Yangi investor" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="F.I.Sh.">
            <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Kompaniya">
            <input className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Investitsiya summasi">
            <input className={inputClass} type="number" value={form.investment_amount} onChange={(e) => setForm({ ...form, investment_amount: e.target.value })} />
          </Field>
          <Field label="Ulush (%)">
            <input className={inputClass} type="number" value={form.share_percent} onChange={(e) => setForm({ ...form, share_percent: e.target.value })} />
          </Field>
          <PrimaryButton disabled={busy || !form.full_name} onClick={() => void createInvestor()}>
            Saqlash
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={!!detail} title={detail?.full_name || "Investor"} onClose={() => setDetail(null)}>
        {detail ? (
          <div className="space-y-3 text-sm">
            <p>Kompaniya: {detail.company_name || "—"}</p>
            <p>Telefon: {formatPhone(detail.phone)}</p>
            <p>Email: {detail.email || "—"}</p>
            <p>Investitsiya: {formatMoney(detail.investment_amount, detail.currency)}</p>
            <p>Ulush: {detail.share_percent}%</p>
            <p>Izoh: {detail.notes || "—"}</p>
            {detail.status === "ended" ? (
              <p className="text-error">Sabab: {detail.exit_reason || "—"}</p>
            ) : (
              <button type="button" className="text-error hover:underline" onClick={() => void endInvestor(detail)}>
                Kelishuvni tugatish
              </button>
            )}
            <Link href="/hisobotlar" className="block text-primary hover:underline">
              Aylanma hisobotlarga o&apos;tish
            </Link>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
