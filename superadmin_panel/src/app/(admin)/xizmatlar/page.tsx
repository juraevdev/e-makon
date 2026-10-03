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
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { ModerationStatus, Service } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { MODERATION_LABEL, MODERATION_TONE } from "@/lib/domain";
import { formatDateTime, formatMoney, slugify } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type Tab = "queue" | "offers" | "catalog";

const emptyForm = {
  name: "",
  slug: "",
  emoji: "🌿",
  icon: "eco",
  category: "Parvarish",
  short_description: "",
  duration: "O'rtacha vaqt: 1.5 - 2 soat",
  hero_image_url: "",
  sort_order: "0",
  is_active: true,
};

const priceOf = (s: Service) => Number(s.price ?? s.price_from ?? 0);

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[`'‘’ʻʼ´]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function similarityScore(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (x === y) return 3;
  if (x.includes(y) || y.includes(x)) return 2;
  const stems = (s: string) => s.split(" ").filter((w) => w.length >= 4).map((w) => w.slice(0, 5));
  const ys = stems(y);
  return stems(x).some((w) => ys.includes(w)) ? 1 : 0;
}

export default function XizmatlarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("queue");
  const [offerFilter, setOfferFilter] = useState<"all" | ModerationStatus>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<{ service: Service; note: string } | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Record<number, string>>({});

  const { data, loading, error, reload } = useAsync(
    async () => asPage<Service>(await api("/admin/services/", { query: { page_size: 100, search: query || undefined } })).results,
    [query],
    { keepPrevious: true },
  );

  const all = useMemo(() => data ?? [], [data]);
  const catalog = all.filter((s) => s.is_catalog_type);
  const offers = all.filter((s) => !s.is_catalog_type);
  const queue = offers.filter((s) => s.moderation_status === "pending");
  const visibleOffers = offerFilter === "all" ? offers : offers.filter((s) => s.moderation_status === offerFilter);
  const siblings = (s: Service) =>
    offers.filter((o) => o.id !== s.id && o.base_service && o.base_service === s.base_service && o.moderation_status === "approved");
  const similarTypes = (s: Service) =>
    catalog
      .map((c) => ({ c, score: similarityScore(c.name, s.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  const samePending = (s: Service) =>
    queue.filter((o) => o.id !== s.id && o.is_type_proposal && similarityScore(o.name, s.name) >= 2);

  async function moderate(s: Service, action: "approve" | "reject", note = "") {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { note };
      const target = mergeTarget[s.id] ?? (s.is_type_proposal ? similarTypes(s).find((c) => similarityScore(c.name, s.name) === 3)?.id : undefined);
      if (action === "approve" && s.is_type_proposal && target) body.base_service = Number(target);
      const saved = await api<Service>(`/admin/services/${s.id}/${action}/`, { method: "POST", body });
      showSuccess(
        action === "approve"
          ? `"${s.name}" tasdiqlandi — ilovada "${saved?.base_service_name || s.name}" ichida ko'rinadi`
          : "Rad etildi, firmaga xabar yuborildi",
      );
      setRejecting(null);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await api(`/admin/services/${s.id}/`, { method: "PATCH", body: { is_active: !s.is_active } });
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    }
  }

  function openForm(s: Service | null) {
    setEditing(s);
    setForm(
      s
        ? {
            name: s.name,
            slug: s.slug,
            emoji: s.emoji || "🌿",
            icon: s.icon || "eco",
            category: s.category,
            short_description: s.short_description,
            duration: s.duration,
            hero_image_url: s.hero_image_url,
            sort_order: String(s.sort_order ?? 0),
            is_active: s.is_active,
          }
        : emptyForm,
    );
    setOpen(true);
  }

  async function saveCatalog() {
    setBusy(true);
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name), sort_order: Number(form.sort_order) || 0 };
      if (editing) await api(`/admin/services/${editing.id}/`, { method: "PATCH", body: payload });
      else await api("/admin/services/", { method: "POST", body: payload });
      setOpen(false);
      showSuccess("Katalog turi saqlandi");
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function removeCatalog(s: Service) {
    if (!confirm(`${s.name} katalogdan o'chirilsinmi? Unga bog'langan firma takliflari ham ta'sirlanadi.`)) return;
    try {
      await api(`/admin/services/${s.id}/`, { method: "DELETE" });
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    }
  }

  function exportOffers() {
    downloadCsv(
      `firma-xizmatlari-${new Date().toISOString().slice(0, 10)}`,
      ["ID", "Firma", "Xizmat", "Katalog turi", "Narx (UZS)", "Holat", "Faol", "Yangilangan"],
      visibleOffers.map((s) => [
        s.id,
        s.organization_name,
        s.name,
        s.base_service_name || "Yangi tur",
        priceOf(s),
        s.moderation_status ? MODERATION_LABEL[s.moderation_status] : "",
        s.is_active ? "Ha" : "Yo'q",
        s.updated_at ? formatDateTime(s.updated_at) : "",
      ]),
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Firmalar o&apos;z xizmatlarini <b className="text-on-surface">aniq, o&apos;zgarmas narx</b> bilan qo&apos;shadi. Har bir yangi xizmat
          yoki narx o&apos;zgarishi shu yerda tekshiriladi; tasdiqlangach mijoz ilovasida firma narxlari yonma-yon chiqadi.
        </p>
        <div className="flex gap-2">
          {tab === "catalog" ? (
            <PrimaryButton icon="add" onClick={() => openForm(null)}>
              Katalog turi
            </PrimaryButton>
          ) : (
            <SecondaryButton icon="download" onClick={exportOffers}>
              CSV
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip label="Tekshiruv navbati" icon="fact_check" count={queue.length} active={tab === "queue"} onClick={() => setTab("queue")} />
        <FilterChip label="Firma takliflari" icon="storefront" count={offers.length} active={tab === "offers"} onClick={() => setTab("offers")} />
        <FilterChip label="Katalog turlari" icon="category" count={catalog.length} active={tab === "catalog"} onClick={() => setTab("catalog")} />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : tab === "queue" ? (
        !queue.length ? (
          <div className="rounded-2xl border border-[#26352c] bg-[#151917]">
            <EmptyState icon="task_alt" title="Navbat bo'sh" description="Tekshiruvni kutayotgan firma xizmati yo'q." />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {queue.map((s) => {
              const peers = siblings(s);
              const prices = peers.map(priceOf).filter(Boolean);
              const similar = s.is_type_proposal ? similarTypes(s) : [];
              const exact = similar.find((c) => similarityScore(c.name, s.name) === 3);
              const twins = s.is_type_proposal ? samePending(s) : [];
              const target = mergeTarget[s.id] ?? (exact ? String(exact.id) : "");
              return (
                <div key={s.id} className="rounded-2xl border border-amber-500/30 bg-[#151917] p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt="" className="h-16 w-20 shrink-0 rounded-xl border border-[#26352c] object-cover" />
                      ) : null}
                      <div>
                        <p className="text-xs text-on-surface-variant">{s.organization_name}</p>
                        <p className="text-lg font-bold">
                          {s.emoji} {s.name}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Katalog turi: {s.base_service_name || <span className="text-amber-300">yangi tur taklifi</span>}
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-primary">{formatMoney(priceOf(s))}</p>
                  </div>
                  <p className="mb-2 text-sm text-on-surface-variant">{s.short_description || "Tavsif yo'q"}</p>
                  {s.description ? <p className="mb-2 whitespace-pre-line text-xs text-on-surface-variant">{s.description}</p> : null}
                  <p className="mb-3 text-xs text-on-surface-variant">{s.duration}</p>
                  {s.is_type_proposal ? (
                    <div className="mb-3 rounded-lg border border-[#26352c] bg-[#0e1210] p-3 text-xs">
                      <Field label="Tasdiqlanganda ilovada qayerda chiqadi">
                        <select
                          className={inputClass}
                          value={target}
                          onChange={(e) => setMergeTarget((m) => ({ ...m, [s.id]: e.target.value }))}
                        >
                          <option value="">Yangi katalog turi: &quot;{s.name}&quot;</option>
                          {(similar.length ? similar : catalog).map((c) => (
                            <option key={c.id} value={c.id}>
                              Mavjud turga qo&apos;shish: {c.emoji} {c.name} ({c.offers_count ?? 0} ta firma)
                            </option>
                          ))}
                          {similar.length
                            ? catalog
                                .filter((c) => !similar.includes(c))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    Mavjud turga qo&apos;shish: {c.emoji} {c.name}
                                  </option>
                                ))
                            : null}
                        </select>
                      </Field>
                      {similar.length ? (
                        <p className="mt-2 text-amber-200">
                          Katalogda o&apos;xshash tur bor: {similar.map((c) => c.name).join(", ")}. Takror xizmat chiqmasligi uchun
                          mavjud turga qo&apos;shing.
                        </p>
                      ) : null}
                      {twins.length ? (
                        <p className="mt-2 text-on-surface-variant">
                          Shu nomdagi boshqa takliflar navbatda: {twins.map((o) => o.organization_name).join(", ")} — bittasi
                          tasdiqlangach qolganlari shu turga avtomatik qo&apos;shiladi.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {prices.length ? (
                    <p className="mb-3 rounded-lg bg-[#0e1210] px-3 py-2 text-xs text-on-surface-variant">
                      Shu turdagi {prices.length} ta firma narxi: {formatMoney(Math.min(...prices))} – {formatMoney(Math.max(...prices))}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <PrimaryButton icon="check" disabled={busy} onClick={() => void moderate(s, "approve")}>
                      Tasdiqlash
                    </PrimaryButton>
                    <SecondaryButton icon="close" onClick={() => setRejecting({ service: s, note: "" })}>
                      Rad etish
                    </SecondaryButton>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "offers" ? (
        <>
          <div className="mb-4 flex gap-2">
            {(["all", "approved", "pending", "rejected"] as const).map((f) => (
              <FilterChip
                key={f}
                label={f === "all" ? "Barchasi" : MODERATION_LABEL[f]}
                active={offerFilter === f}
                onClick={() => setOfferFilter(f)}
              />
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#26352c] bg-[#151917]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#26352c] text-xs uppercase text-on-surface-variant">
                  {["Firma", "Xizmat", "Katalog turi", "Narx", "Holat", "Ilovada", ""].map((h) => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26352c]/50">
                {visibleOffers.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">{s.organization_name}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{s.base_service_name || "Yangi tur"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold">{formatMoney(priceOf(s))}</td>
                    <td className="px-4 py-3">
                      {s.moderation_status ? (
                        <StatusPill variant={MODERATION_TONE[s.moderation_status]}>{MODERATION_LABEL[s.moderation_status]}</StatusPill>
                      ) : null}
                      {s.moderation_note ? <p className="mt-1 max-w-[200px] text-xs text-on-surface-variant">{s.moderation_note}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void toggleActive(s)} className="text-xs text-primary hover:underline">
                        {s.is_active ? "Faol" : "O'chiq"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {s.moderation_status !== "approved" ? (
                        <button type="button" className="mr-2 text-xs text-primary hover:underline" onClick={() => void moderate(s, "approve")}>
                          Tasdiqlash
                        </button>
                      ) : null}
                      {s.moderation_status !== "rejected" ? (
                        <button type="button" className="text-xs text-error hover:underline" onClick={() => setRejecting({ service: s, note: "" })}>
                          Rad etish
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleOffers.length ? <EmptyState icon="storefront" title="Takliflar yo'q" /> : null}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((s) => (
            <div key={s.id} className="flex flex-col justify-between rounded-2xl border border-[#26352c] bg-[#111414] p-5">
              <div>
                <div className="mb-3 flex items-start justify-between">
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" className="h-11 w-14 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
                      <span className="material-symbols-outlined">{s.icon || "eco"}</span>
                    </span>
                  )}
                  <StatusPill variant={s.is_active ? "success" : "neutral"}>{s.is_active ? "Faol" : "To'xtatilgan"}</StatusPill>
                </div>
                <p className="font-bold">{s.emoji} {s.name}</p>
                <p className="mb-3 line-clamp-2 text-xs text-on-surface-variant">{s.short_description}</p>
                <p className="text-xs text-on-surface-variant">
                  {s.offers_count ?? 0} ta firma taklifi
                  {s.offers_count ? ` · ${formatMoney(s.price_min)} – ${formatMoney(s.price_max)}` : ""}
                </p>
              </div>
              <div className="mt-4 flex gap-2 border-t border-[#26352c]/50 pt-3">
                <SecondaryButton icon="edit" className="flex-1" onClick={() => openForm(s)}>
                  Tahrirlash
                </SecondaryButton>
                <button type="button" onClick={() => void removeCatalog(s)} className="rounded-lg p-2 text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!rejecting} title="Xizmatni rad etish" onClose={() => setRejecting(null)}>
        {rejecting ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              {rejecting.service.organization_name} · {rejecting.service.name} · {formatMoney(priceOf(rejecting.service))}
            </p>
            <Field label="Sabab (firmaga yuboriladi)" required>
              <textarea rows={3} className={inputClass} value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} />
            </Field>
            <PrimaryButton disabled={busy || !rejecting.note.trim()} onClick={() => void moderate(rejecting.service, "reject", rejecting.note)}>
              Rad etish
            </PrimaryButton>
          </div>
        ) : null}
      </Modal>

      <Modal open={open} title={editing ? "Katalog turini tahrirlash" : "Yangi katalog turi"} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nomi" required>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug">
            <input className={inputClass} value={form.slug} placeholder="auto" onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Ikonka">
            <input className={inputClass} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>
          <Field label="Emoji">
            <input className={inputClass} value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          </Field>
          <Field label="Toifa">
            <input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Tartib raqami">
            <input className={inputClass} inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </Field>
          <Field label="Davomiylik">
            <input className={inputClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </Field>
          <Field label="Rasm URL">
            <input className={inputClass} value={form.hero_image_url} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Qisqa tavsif">
              <textarea rows={3} className={inputClass} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Faol (mobil katalogda ko&apos;rinsin)
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton disabled={busy || !form.name} onClick={() => void saveCatalog()}>
            Saqlash
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
