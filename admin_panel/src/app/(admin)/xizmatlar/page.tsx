"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog,
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
import { api, asPage, fetchAll } from "@/lib/api/client";
import type { ModerationStatus, Service } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { MODERATION_LABEL, MODERATION_TONE } from "@/lib/domain";
import { formatDate, formatMoney, slugify } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type FilterId = "all" | ModerationStatus | "inactive";

const FILTERS: { id: FilterId; label: string; match: (s: Service) => boolean }[] = [
  { id: "all", label: "Barchasi", match: () => true },
  { id: "approved", label: "Ilovada", match: (s) => s.moderation_status === "approved" && s.is_active },
  { id: "pending", label: "Tekshiruvda", match: (s) => s.moderation_status === "pending" },
  { id: "rejected", label: "Rad etilgan", match: (s) => s.moderation_status === "rejected" },
  { id: "inactive", label: "To'xtatilgan", match: (s) => !s.is_active },
];

const emptyForm = {
  base_service: "",
  name: "",
  price: "",
  duration: "O'rtacha vaqt: 1.5 - 2 soat",
  short_description: "",
  description: "",
  icon: "eco",
  emoji: "🌿",
  category: "Parvarish",
  is_active: true,
};

const priceOf = (s: Service) => Number(s.price ?? s.price_from ?? 0);

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[`'‘’ʻʼ´]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export default function XizmatlarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [toPause, setToPause] = useState<Service | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const { data, loading, error, reload } = useAsync(
    async () => fetchAll<Service>("/admin/services/", { search: query || undefined }),
    [query],
    { keepPrevious: true },
  );

  const { data: catalog } = useAsync(async () => {
    const raw = await api("/services/", { auth: false, query: { page_size: 100 } });
    return asPage<Service>(raw).results;
  }, []);

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => all.filter((FILTERS.find((f) => f.id === filter) ?? FILTERS[0]).match), [all, filter]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.match).length])) as Record<FilterId, number>,
    [all],
  );
  const takenTypes = new Set(all.filter((s) => s.id !== editing?.id).map((s) => s.base_service).filter(Boolean));
  const chosenType = catalog?.find((c) => String(c.id) === form.base_service) ?? null;
  const similarTypes = useMemo(() => {
    const key = normalizeName(form.name);
    if (form.base_service || key.length < 3) return [];
    const words = key.split(" ").filter((w) => w.length >= 4);
    return (catalog ?? []).filter((c) => {
      const name = normalizeName(c.name);
      return name === key || name.includes(key) || key.includes(name) || words.some((w) => name.includes(w.slice(0, 5)));
    });
  }, [catalog, form.base_service, form.name]);
  const exactType = similarTypes.find((c) => normalizeName(c.name) === normalizeName(form.name)) ?? null;

  function resetImage(src = "") {
    setImageFile(null);
    setImagePreview(src);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    resetImage();
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      base_service: s.base_service ? String(s.base_service) : "",
      name: s.name,
      price: priceOf(s) ? String(Math.round(priceOf(s))) : "",
      duration: s.duration,
      short_description: s.short_description,
      description: s.description,
      icon: s.icon || "eco",
      emoji: s.emoji || "🌿",
      category: s.category,
      is_active: s.is_active,
    });
    resetImage(s.image || "");
    setOpen(true);
  }

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return showError("Faqat rasm fayl yuklang");
    if (file.size > 5 * 1024 * 1024) return showError("Rasm 5 MB dan oshmasin");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function pickType(id: string) {
    const type = catalog?.find((c) => String(c.id) === id);
    setForm((f) => ({
      ...f,
      base_service: id,
      name: type && (!f.name || catalog?.some((c) => c.name === f.name)) ? type.name : f.name,
      icon: type?.icon || f.icon,
      emoji: type?.emoji || f.emoji,
      category: type?.category || f.category,
    }));
  }

  async function save() {
    const price = Number(form.price);
    if (!form.name.trim()) return showError("Xizmat nomini kiriting");
    if (!price || price < 1000) return showError("Aniq narxni so'mda kiriting (masalan 250000)");
    if (!form.short_description.trim()) return showError("Qisqa tavsifni yozing — mijoz nima olishini bilsin");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        price,
        duration: form.duration,
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        icon: form.icon,
        emoji: form.emoji,
        category: form.category,
        is_active: form.is_active,
        base_service: form.base_service ? Number(form.base_service) : null,
      };
      if (!editing) payload.slug = `${slugify(form.name) || "xizmat"}-${Date.now().toString(36)}`;
      let body: Record<string, unknown> | FormData = payload;
      if (imageFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v === null ? "" : String(v)));
        fd.append("cover_image", imageFile);
        body = fd;
      }
      const saved = editing
        ? await api<Service>(`/admin/services/${editing.id}/`, { method: "PATCH", body })
        : await api<Service>("/admin/services/", { method: "POST", body });
      setOpen(false);
      showSuccess(
        saved?.base_service_name
          ? `Yuborildi. Tasdiqlangach ilovada "${saved.base_service_name}" bo'limida firmangiz chiqadi.`
          : "Yangi xizmat turi superadminga yuborildi. Tasdiqlangach ilova katalogiga qo'shiladi.",
      );
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await api(`/admin/services/${s.id}/`, { method: "PATCH", body: { is_active: !s.is_active } });
      showSuccess(s.is_active ? "Xizmat to'xtatildi" : "Xizmat qayta yoqildi");
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    }
  }

  async function remove(s: Service) {
    try {
      await api(`/admin/services/${s.id}/`, { method: "DELETE" });
      showSuccess("Xizmat o'chirildi");
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "O'chirib bo'lmadi — buyurtmalari bor xizmatni to'xtating");
    }
  }

  function exportTable() {
    downloadCsv(
      `xizmatlar-${new Date().toISOString().slice(0, 10)}`,
      ["ID", "Xizmat", "Katalog turi", "Narx (UZS)", "Davomiylik", "Holat", "Faol", "Qo'shilgan"],
      rows.map((s) => [
        s.id,
        s.name,
        s.base_service_name || "Yangi tur",
        priceOf(s),
        s.duration,
        s.moderation_status ? MODERATION_LABEL[s.moderation_status] : "",
        s.is_active ? "Ha" : "Yo'q",
        s.created_at ? formatDate(s.created_at) : "",
      ]),
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Firmangiz ko&apos;rsatadigan xizmatlar va <b className="text-on-surface">o&apos;zgarmas aniq narxlari</b>. Xizmat turini
          katalogdan tanlang (masalan &quot;Daraxt butash&quot;) — ilovada bitta xizmat ichida uni ko&apos;rsatadigan barcha firmalar narxi
          bilan chiqadi. Katalogda yo&apos;q bo&apos;lsa, yangi tur taklif qiling: superadmin tasdiqlagach katalogga qo&apos;shiladi.
        </p>
        <div className="flex shrink-0 gap-2">
          <SecondaryButton icon="download" onClick={exportTable} disabled={!rows.length}>
            Jadval (CSV)
          </SecondaryButton>
          <PrimaryButton icon="add" onClick={openCreate}>
            Xizmat qo&apos;shish
          </PrimaryButton>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <FilterChip key={f.id} label={f.label} count={counts[f.id]} active={filter === f.id} onClick={() => setFilter(f.id)} />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <p className="p-8 text-error">{error}</p>
        ) : !rows.length ? (
          <EmptyState
            icon="nature_people"
            title="Xizmatlar yo'q"
            description="Ko'rsatadigan xizmatingizni katalog turidan tanlab, aniq narxini kiriting."
            action={<PrimaryButton onClick={openCreate}>Qo&apos;shish</PrimaryButton>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#26352c] text-xs uppercase text-on-surface-variant">
                  {["Xizmat", "Katalog turi", "Narx", "Davomiylik", "Tekshiruv", "Ilovada", ""].map((h) => (
                    <th key={h} className="px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26352c]/50">
                {rows.map((s) => (
                  <tr key={s.id} className="transition hover:bg-white/5">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {s.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.image} alt="" className="h-10 w-10 rounded-xl border border-primary-container/30 object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-container/30 bg-primary-container/20 text-primary">
                            <span className="material-symbols-outlined">{s.icon || "eco"}</span>
                          </span>
                        )}
                        <div>
                          <p className="font-semibold">{s.emoji} {s.name}</p>
                          <p className="line-clamp-1 max-w-xs text-xs text-on-surface-variant">{s.short_description || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {s.base_service_name || <span className="text-amber-300">Yangi tur taklifi</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-bold">{formatMoney(priceOf(s), s.currency)}</td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">{s.duration || "—"}</td>
                    <td className="px-5 py-4">
                      {s.moderation_status ? (
                        <StatusPill variant={MODERATION_TONE[s.moderation_status]} pulse={s.moderation_status === "pending"}>
                          {MODERATION_LABEL[s.moderation_status]}
                        </StatusPill>
                      ) : null}
                      {s.moderation_status === "rejected" && s.moderation_note ? (
                        <p className="mt-1 max-w-[220px] text-xs text-error">{s.moderation_note}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => (s.is_active ? setToPause(s) : void toggleActive(s))}
                        className={`relative h-6 w-11 rounded-full transition ${s.is_active ? "bg-primary/70" : "bg-surface-container-highest"}`}
                        title={s.is_active ? "To'xtatish" : "Yoqish"}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${s.is_active ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-primary/10 hover:text-primary"
                          title="Tahrirlash"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(s)}
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error"
                          title="O'chirish"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} title={editing ? "Xizmatni tahrirlash" : "Yangi xizmat"} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Katalogdagi xizmat turi" required>
              <select className={inputClass} value={form.base_service} onChange={(e) => pickType(e.target.value)}>
                <option value="">Katalogda yo&apos;q — yangi tur taklif qilaman</option>
                {(catalog ?? []).map((c) => (
                  <option key={c.id} value={c.id} disabled={takenTypes.has(c.id)}>
                    {c.emoji} {c.name}
                    {c.offers_count ? ` — ${c.offers_count} ta firma` : ""}
                    {takenTypes.has(c.id) ? " (qo'shilgan)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={form.base_service ? "Xizmat nomi (firmangiz taklifi)" : "Yangi xizmat turi nomi"} required>
            <input
              className={inputClass}
              placeholder={form.base_service ? "" : "Masalan: Daraxt butash"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Aniq narx (UZS)" required>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="250000"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <Field label="Davomiylik">
            <input className={inputClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </Field>
          <Field label="Ikonka (Material)">
            <input className={inputClass} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>
          {similarTypes.length ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 sm:col-span-2">
              <p className="mb-2">
                {exactType
                  ? `"${exactType.name}" katalogda bor — takrorlanmasligi uchun xizmatingiz shu turga qo'shiladi.`
                  : "Katalogda shunga o'xshash tur bor. Xizmatingiz shulardan biri bo'lsa, tanlang — ilovada alohida emas, shu xizmat ichida chiqasiz:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {similarTypes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={takenTypes.has(c.id)}
                    onClick={() => pickType(String(c.id))}
                    className="rounded-lg border border-amber-400/40 px-3 py-1.5 font-semibold hover:bg-amber-400/20 disabled:opacity-40"
                  >
                    {c.emoji} {c.name}
                    {c.offers_count ? ` · ${c.offers_count} ta firma` : ""}
                    {takenTypes.has(c.id) ? " (qo'shilgan)" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Field label="Qisqa tavsif (nima kiradi)" required>
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Masalan: mevali va manzarali daraxtlarni shakl berib butash, shox-shabbani olib ketish"
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Batafsil ma'lumot">
              <textarea
                className={inputClass}
                rows={4}
                placeholder="Ish tartibi, ishlatiladigan asboblar, kafolat, qo'shimcha shartlar..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Xizmat rasmi">
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="" className="h-20 w-28 rounded-xl border border-[#26352c] object-cover" />
                ) : (
                  <span className="flex h-20 w-28 items-center justify-center rounded-xl border border-dashed border-[#26352c] text-on-surface-variant">
                    <span className="material-symbols-outlined">add_photo_alternate</span>
                  </span>
                )}
                <label className="cursor-pointer rounded-lg border border-[#26352c] px-4 py-2 text-sm hover:bg-white/5">
                  {imagePreview ? "Rasmni almashtirish" : "Rasm yuklash"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                </label>
                <span className="text-xs text-on-surface-variant">JPG/PNG, 5 MB gacha</span>
              </div>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Faol (tasdiqlangach ilovada ko&apos;rinsin)
          </label>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-[#26352c] bg-[#0e1510] p-3 text-xs text-on-surface-variant">
          {form.price ? (
            <p>
              Ilovada: <b className="text-primary">{formatMoney(Number(form.price))}</b> — narx o&apos;zgarmas, maydonga qarab
              oshmaydi.
            </p>
          ) : null}
          {chosenType && (chosenType.offers_count ?? 0) > 0 ? (
            <p>
              Bozordagi narxlar ({chosenType.offers_count} ta firma): {formatMoney(chosenType.price_min)} –{" "}
              {formatMoney(chosenType.price_max)}
            </p>
          ) : null}
          {!form.base_service && !exactType ? (
            <p>
              Yangi tur taklifi superadminga yuboriladi. Tasdiqlansa, u ilova katalogiga qo&apos;shiladi va boshqa firmalar ham shu turga
              o&apos;z narxi bilan qo&apos;shila oladi.
            </p>
          ) : null}
          {editing?.moderation_status === "approved" ? (
            <p className="text-amber-200">Nom, narx, tavsif yoki rasm o&apos;zgarsa xizmat qayta tekshiruvga yuboriladi.</p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)}>Bekor</SecondaryButton>
          <PrimaryButton disabled={busy} icon="send" onClick={() => void save()}>
            Tekshiruvga yuborish
          </PrimaryButton>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Xizmat o'chirilsinmi?"
        description={toDelete ? `${toDelete.name} katalogdan butunlay o'chadi.` : ""}
        confirmText="O'chirish"
        cancelText="Bekor"
        variant="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const s = toDelete;
          setToDelete(null);
          if (s) void remove(s);
        }}
      />

      <ConfirmDialog
        open={!!toPause}
        title="Xizmat to'xtatilsinmi?"
        description={toPause ? `${toPause.name} ilovada ko'rinmay qoladi va yangi buyurtma qabul qilinmaydi.` : ""}
        confirmText="To'xtatish"
        cancelText="Bekor"
        variant="warning"
        onCancel={() => setToPause(null)}
        onConfirm={() => {
          const s = toPause;
          setToPause(null);
          if (s) void toggleActive(s);
        }}
      />
    </div>
  );
}
