"use client";

import { useMemo, useState } from "react";
import {
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { Banner, BannerStatus, Service } from "@/lib/api/types";
import { BANNER_STATUS_LABEL } from "@/lib/domain";
import { useAsync } from "@/hooks/useAsync";

export default function BannerlarPage() {
  const [filter, setFilter] = useState<"all" | BannerStatus>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    image_url: "",
    status: "active" as BannerStatus,
    placement: "home",
  });
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const [banners, services] = await Promise.all([
      api("/admin/banners/", { query: { page_size: 50 } }),
      api("/admin/services/", { query: { page_size: 50 } }),
    ]);
    return { banners: asPage<Banner>(banners).results, services: asPage<Service>(services).results };
  }, []);

  const list = useMemo(() => {
    const all = data?.banners ?? [];
    if (filter === "all") return all;
    return all.filter((b) => b.status === filter);
  }, [data, filter]);

  function startCreate() {
    setEditing(null);
    setForm({ title: "", description: "", image_url: "", status: "active", placement: "home" });
    setOpen(true);
  }

  function startEdit(b: Banner) {
    setEditing(b);
    setForm({
      title: b.title,
      description: b.description,
      image_url: b.image_url || b.image_src,
      status: b.status,
      placement: b.placement,
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) await api(`/admin/banners/${editing.id}/`, { method: "PATCH", body: form });
      else await api("/admin/banners/", { method: "POST", body: form });
      setOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Banner) {
    if (!confirm("Banner o'chirilsinmi?")) return;
    await api(`/admin/banners/${b.id}/`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="Barchasi" active={filter === "all"} onClick={() => setFilter("all")} count={data?.banners.length} />
        <FilterChip label="Faol" active={filter === "active"} onClick={() => setFilter("active")} />
        <FilterChip label="Rejalashtirilgan" active={filter === "scheduled"} onClick={() => setFilter("scheduled")} />
        <div className="ml-auto">
          <PrimaryButton icon="add" onClick={startCreate}>Banner qo&apos;shish</PrimaryButton>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => (
            <article key={b.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
              <div className="relative h-48 bg-surface-container-high">
                {b.image_src || b.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image_src || b.image_url} alt={b.title} className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute top-3 right-3">
                  <StatusPill variant={b.status === "active" ? "success" : "warning"}>{BANNER_STATUS_LABEL[b.status]}</StatusPill>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 text-xl font-semibold">{b.title}</h3>
                <p className="mb-4 line-clamp-2 text-sm text-on-surface-variant">{b.description}</p>
                <div className="mt-auto flex items-center justify-between border-t border-[#26352c]/60 pt-3">
                  <span className="text-xs text-tertiary">{b.placement === "home" ? "Bosh sahifa" : "Promo"}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEdit(b)} className="rounded-lg p-1.5 hover:text-primary">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button type="button" onClick={() => void remove(b)} className="rounded-lg p-1.5 hover:text-error">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
          <button
            type="button"
            onClick={startCreate}
            className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-primary"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
            <h3 className="text-lg font-semibold">Yangi banner qo&apos;shish</h3>
          </button>
          {!list.length ? <EmptyState icon="ad_units" title="Bannerlar yo'q" /> : null}
        </div>
      )}

      <Modal open={open} title={editing ? "Bannerni tahrirlash" : "Yangi banner"} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Sarlavha">
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Tavsif">
            <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Rasm URL">
            <input className={inputClass} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          </Field>
          <Field label="Holat">
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BannerStatus })}>
              {Object.entries(BANNER_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <PrimaryButton disabled={busy || !form.title} onClick={() => void save()}>Saqlash</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
