"use client";

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
import type { Employee } from "@/lib/api/types";
import { SPECIALTY_LABEL } from "@/lib/domain";
import { formatPhone, relativeTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

const SPECIALTIES = Object.keys(SPECIALTY_LABEL);

export default function HamkorlarPage() {
  const { query } = useSearch();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", full_name: "", specialty: "general", notes: "" });
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/employees/", {
      query: { page_size: 50, search: query || undefined },
    });
    return asPage<Employee>(raw);
  }, [query]);

  const partners = useMemo(() => {
    const list = data?.results ?? [];
    if (filter === "active") return list.filter((p) => p.is_active);
    if (filter === "inactive") return list.filter((p) => !p.is_active);
    return list;
  }, [data, filter]);

  async function createPartner() {
    setBusy(true);
    try {
      await api("/admin/employees/", { method: "POST", body: form });
      setOpen(false);
      setForm({ phone: "", full_name: "", specialty: "general", notes: "" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: Employee) {
    await api(`/admin/employees/${p.id}/`, { method: "PATCH", body: { is_active: !p.is_active } });
    await reload();
  }

  const all = data?.results ?? [];

  return (
    <div className="flex-1 px-4 py-6 md:px-8">
      <PageHeader
        title="Hamkorlar boshqaruvi"
        description="Xizmatni bajaradigan xodimlar / hamkorlar. Buyurtmaga shu yerda tayinlanadi."
      />

      <div className="mb-8 flex w-full flex-nowrap items-center gap-3 overflow-x-auto rounded-2xl border border-primary-container/30 bg-[#141916]/90 p-2">
        {[
          { id: "all" as const, label: "Barchasi", count: all.length },
          { id: "active" as const, label: "Faol", count: all.filter((p) => p.is_active).length },
          { id: "inactive" as const, label: "Nofaol", count: all.filter((p) => !p.is_active).length },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm ${
              filter === f.id ? "border border-primary/40 bg-primary-container/25 font-semibold text-primary" : "text-on-surface-variant"
            }`}
          >
            {f.label}
            <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs">{f.count}</span>
          </button>
        ))}
        <div className="ml-auto">
          <PrimaryButton icon="add_business" onClick={() => setOpen(true)}>
            Yangi hamkor
          </PrimaryButton>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !partners.length ? (
        <EmptyState icon="handshake" title="Hamkorlar yo'q" action={<PrimaryButton onClick={() => setOpen(true)}>Qo'shish</PrimaryButton>} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {partners.map((p) => (
            <div key={p.id} className="flex h-full flex-col justify-between rounded-2xl border border-primary-container/35 bg-gradient-to-b from-[#151a18] to-[#101412] p-5">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="truncate pr-2 text-lg font-bold text-on-surface">{p.user.full_name || p.user.phone}</h3>
                  <StatusPill variant={p.is_active ? "success" : "error"} pulse={p.is_active}>
                    {p.is_active ? "Faol" : "Nofaol"}
                  </StatusPill>
                </div>
                <span className="mb-3 inline-block rounded-full bg-surface-container-high/80 px-2.5 py-0.5 text-[11px] text-on-surface-variant uppercase">
                  {SPECIALTY_LABEL[p.specialty] || p.specialty}
                </span>
                <div className="mb-3 flex items-center gap-1.5 text-yellow-400">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="font-bold text-on-surface">{p.rating}</span>
                </div>
                <div className="space-y-1.5 text-xs text-on-surface-variant">
                  <p className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                    {formatPhone(p.user.phone)}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                    <span className="truncate">{p.user.formatted_address || p.user.home_address || "Manzil yo'q"}</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-xs text-on-surface-variant">{relativeTime(p.created_at)}</span>
                <button type="button" onClick={() => void toggle(p)} className="text-xs font-semibold text-primary">
                  {p.is_active ? "Nofaollashtirish" : "Faollashtirish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title="Yangi hamkor" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Ism">
            <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Mutaxassislik">
            <select className={inputClass} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{SPECIALTY_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Izoh">
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <PrimaryButton disabled={busy || !form.phone} onClick={() => void createPartner()}>
            Saqlash
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
