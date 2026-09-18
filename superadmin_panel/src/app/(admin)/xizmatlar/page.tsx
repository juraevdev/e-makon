"use client";

import { useState } from "react";
import {
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  Modal,
  Pagination,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { Service } from "@/lib/api/types";
import { formatMoney, pageNumbers, slugify } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

const emptyForm = {
  name: "",
  slug: "",
  emoji: "🌿",
  icon: "eco",
  category: "Parvarish",
  short_description: "",
  description: "",
  duration: "O'rtacha vaqt: 1.5 - 2 soat",
  price_label: "Kelishilgan narxda",
  price_from: "",
  hero_image_url: "",
  is_active: true,
};

export default function XizmatlarPage() {
  const { query } = useSearch();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/services/", {
      query: { page, page_size: 9, search: query || undefined },
    });
    return asPage<Service>(raw);
  }, [page, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      slug: s.slug,
      emoji: s.emoji || "🌿",
      icon: s.icon || "eco",
      category: s.category,
      short_description: s.short_description,
      description: s.description,
      duration: s.duration,
      price_label: s.price_label,
      price_from: s.price_from || "",
      hero_image_url: s.hero_image_url,
      is_active: s.is_active,
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
        price_from: form.price_from ? Number(form.price_from) : null,
      };
      if (editing) {
        await api(`/admin/services/${editing.slug}/`, { method: "PATCH", body: payload });
      } else {
        await api("/admin/services/", { method: "POST", body: payload });
      }
      setOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Service) {
    if (!confirm(`${s.name} o'chirilsinmi?`)) return;
    await api(`/admin/services/${s.slug}/`, { method: "DELETE" });
    await reload();
  }

  const activeCount = data?.results.filter((s) => s.is_active).length ?? 0;
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / 9));

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Mobil ilova katalogi bilan bir xil xizmatlar. Qo&apos;shilgan yoki o&apos;zgartirilgan yozuvlar darhol mijoz ilovasida ko&apos;rinadi.
        </p>
        <PrimaryButton icon="add" onClick={openCreate}>
          Xizmat qo&apos;shish
        </PrimaryButton>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { label: "Jami xizmatlar", value: String(data?.count ?? 0), icon: "eco" },
          { label: "Faol", value: String(activeCount), icon: "check_circle" },
          { label: "Mobil katalog", value: "9 tur", icon: "phone_iphone" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-primary-container/30 bg-[#111414] p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">{k.label}</span>
              <span className="material-symbols-outlined text-primary">{k.icon}</span>
            </div>
            <p className="text-3xl font-bold text-on-surface">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <p className="p-8 text-error">{error}</p>
        ) : !data?.results.length ? (
          <EmptyState icon="nature_people" title="Xizmatlar yo'q" action={<PrimaryButton onClick={openCreate}>Qo'shish</PrimaryButton>} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
              {data.results.map((s) => (
                <div key={s.id} className="group relative flex flex-col justify-between rounded-2xl border border-[#26352c] bg-[#111414] p-5">
                  <div>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-container/30 bg-primary-container/20 text-primary">
                        <span className="material-symbols-outlined">{s.icon || "eco"}</span>
                      </div>
                      <StatusPill variant={s.is_active ? "success" : "neutral"} pulse={s.is_active}>
                        {s.is_active ? "Faol" : "To'xtatilgan"}
                      </StatusPill>
                    </div>
                    <h4 className="mb-1 text-base font-bold text-on-surface">
                      {s.emoji} {s.name}
                    </h4>
                    <p className="mb-4 line-clamp-2 text-xs text-on-surface-variant">{s.short_description || s.description}</p>
                    <div className="mb-4 rounded-xl border border-white/5 bg-[#191c1c] p-3">
                      <span className="text-[11px] tracking-wider text-on-surface-variant uppercase">Narx</span>
                      <p className="text-sm font-bold">{s.price_from ? formatMoney(s.price_from, s.currency) : s.price_label}</p>
                    </div>
                    <p className="mb-4 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined mr-1 align-middle text-[16px] text-primary">schedule</span>
                      {s.duration}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#26352c]/50 pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary-container/40 bg-primary-container/20 px-3 py-2 text-xs font-semibold text-primary"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(s)}
                      className="rounded-lg border border-white/5 bg-surface-container-low p-2 text-on-surface-variant hover:text-error"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              current={page}
              pages={pageNumbers(page, totalPages)}
              onPageChange={setPage}
              info={
                <>
                  Jami <span className="font-bold text-on-surface">{data.count}</span> ta xizmat
                </>
              }
            />
          </>
        )}
      </div>

      <Modal open={open} title={editing ? "Xizmatni tahrirlash" : "Yangi xizmat"} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nomi">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug">
            <input className={inputClass} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto" />
          </Field>
          <Field label="Ikonka">
            <input className={inputClass} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>
          <Field label="Toifa">
            <input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Davomiylik">
            <input className={inputClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </Field>
          <Field label="Narxdan (UZS)">
            <input className={inputClass} value={form.price_from} onChange={(e) => setForm({ ...form, price_from: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Qisqa tavsif">
              <textarea className={inputClass} rows={3} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Faol (mobil katalogda ko&apos;rinsin)
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <PrimaryButton disabled={busy || !form.name} onClick={() => void save()}>
            Saqlash
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
