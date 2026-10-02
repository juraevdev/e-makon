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
import { api, asPage } from "@/lib/api/client";
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
  icon: "eco",
  emoji: "🌿",
  category: "Parvarish",
  is_active: true,
};

const priceOf = (s: Service) => Number(s.price ?? s.price_from ?? 0);

export default function XizmatlarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const { data, loading, error, reload } = useAsync(
    async () => {
      const raw = await api("/admin/services/", { query: { page_size: 100, search: query || undefined } });
      return asPage<Service>(raw).results;
    },
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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
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
      icon: s.icon || "eco",
      emoji: s.emoji || "🌿",
      category: s.category,
      is_active: s.is_active,
    });
    setOpen(true);
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
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        price,
        duration: form.duration,
        short_description: form.short_description,
        icon: form.icon,
        emoji: form.emoji,
        category: form.category,
        is_active: form.is_active,
        base_service: form.base_service ? Number(form.base_service) : null,
      };
      if (editing) {
        await api(`/admin/services/${editing.id}/`, { method: "PATCH", body: payload });
      } else {
        payload.slug = `${slugify(form.name) || "xizmat"}-${Date.now().toString(36)}`;
        await api("/admin/services/", { method: "POST", body: payload });
      }
      setOpen(false);
      showSuccess("Saqlandi. Xizmat tizim ma'muriyati tekshiruvidan so'ng ilovada chiqadi.");
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
          Firmangiz xizmatlari va <b className="text-on-surface">o&apos;zgarmas aniq narxlari</b>. Har bir yangi xizmat yoki narx
          o&apos;zgarishi tizim ma&apos;muriyati tekshiruvidan o&apos;tgach mobil ilovaga chiqadi. Mijoz xizmat tanlaganda barcha firmalar
          narxi yonma-yon ko&apos;rsatiladi.
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
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-container/30 bg-primary-container/20 text-primary">
                          <span className="material-symbols-outlined">{s.icon || "eco"}</span>
                        </span>
                        <div>
                          <p className="font-semibold">{s.emoji} {s.name}</p>
                          <p className="line-clamp-1 max-w-xs text-xs text-on-surface-variant">{s.short_description || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{s.base_service_name || "Yangi tur"}</td>
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
                        onClick={() => void toggleActive(s)}
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
                    {takenTypes.has(c.id) ? " (qo'shilgan)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Xizmat nomi (ilovada)" required>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          <div className="sm:col-span-2">
            <Field label="Qisqa tavsif (nima kiradi)">
              <textarea
                className={inputClass}
                rows={3}
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
              />
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
          {editing?.moderation_status === "approved" ? (
            <p className="text-amber-200">Nom, narx yoki tavsif o&apos;zgarsa xizmat qayta tekshiruvga yuboriladi.</p>
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
    </div>
  );
}
