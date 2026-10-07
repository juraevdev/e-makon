"use client";

import { useState } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { Service } from "@/lib/api/types";
import { slugify } from "@/lib/format";
import { useToast } from "@/providers/ToastProvider";
import { ImageUploadField } from "./ImageUploadField";

const ICONS = [
  "eco",
  "park",
  "forest",
  "content_cut",
  "water_drop",
  "grain",
  "science",
  "architecture",
  "verified_user",
  "yard",
  "grass",
  "local_florist",
  "pest_control",
  "agriculture",
  "call",
  "phone_in_talk",
];

type FormState = {
  name: string;
  slug: string;
  emoji: string;
  icon: string;
  category: string;
  short_description: string;
  description: string;
  duration: string;
  hero_image_url: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY: FormState = {
  name: "",
  slug: "",
  emoji: "🌿",
  icon: "eco",
  category: "Parvarish",
  short_description: "",
  description: "",
  duration: "O'rtacha vaqt: 1.5 - 2 soat",
  hero_image_url: "",
  sort_order: "0",
  is_active: true,
};

function fromService(s: Service | null): FormState {
  if (!s) return EMPTY;
  return {
    name: s.name,
    slug: s.slug,
    emoji: s.emoji || "",
    icon: s.icon || "eco",
    category: s.category || "",
    short_description: s.short_description || "",
    description: s.description || "",
    duration: s.duration || "",
    hero_image_url: s.hero_image_url || "",
    sort_order: String(s.sort_order ?? 0),
    is_active: s.is_active,
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): Errors {
  const e: Errors = {};
  if (!form.name.trim()) e.name = "Nomini kiriting.";
  else if (form.name.length > 255) e.name = "Nomi 255 belgidan oshmasin.";
  if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) e.slug = "Faqat kichik lotin harflari, raqam va '-' belgisi.";
  if (form.slug.length > 64) e.slug = "Slug 64 belgidan oshmasin.";
  if (form.emoji.length > 8) e.emoji = "Bitta emoji kiriting.";
  if (form.short_description.length > 255) e.short_description = "Qisqa tavsif 255 belgidan oshmasin.";
  if (!/^\d+$/.test(form.sort_order || "0")) e.sort_order = "Musbat butun son kiriting.";
  if (form.hero_image_url && !/^https?:\/\/\S+$/i.test(form.hero_image_url)) e.hero_image_url = "URL http(s):// bilan boshlansin.";
  return e;
}

/** Ichki holat har ochilishda `key` orqali yangilanadi (ota komponent `key={editing?.id ?? "new"}` beradi). */
export function CatalogTypeFormModal({
  editing,
  categories,
  onClose,
  onSaved,
}: {
  editing: Service | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState<FormState>(() => fromService(editing));
  const [file, setFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const existingPreview = removeCover ? form.hero_image_url : editing?.image || form.hero_image_url;

  async function save() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setServerError("");
    const slug = form.slug || slugify(form.name) || `tur-${Date.now().toString(36)}`;
    const payload: Record<string, string | number | boolean> = {
      ...form,
      name: form.name.trim(),
      slug,
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      let body: Record<string, unknown> | FormData = payload;
      if (file || removeCover) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append("cover_image", file ?? "");
        body = fd;
      }
      if (editing) await api(`/admin/services/${editing.id}/`, { method: "PATCH", body });
      else await api("/admin/services/", { method: "POST", body });
      showSuccess(editing ? "Katalog turi yangilandi" : "Yangi katalog turi qo'shildi");
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Saqlanmadi";
      setServerError(msg);
      showError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title={editing ? "Katalog turini tahrirlash" : "Yangi katalog turi"}
      description="Katalog turi mijoz ilovasidagi bo'lim. Firmalar o'z narxlarini shu turga taklif sifatida qo'shadi."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose} className="justify-center">
            Bekor qilish
          </SecondaryButton>
          <PrimaryButton icon="save" disabled={busy} onClick={() => void save()} className="justify-center">
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {serverError ? (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error sm:col-span-2">{serverError}</p>
        ) : null}
        <Field label="Nomi" required className="sm:col-span-2" hint={errors.name ? <span className="text-error">{errors.name}</span> : undefined}>
          <input className={inputClass} value={form.name} autoFocus onChange={(e) => set("name", e.target.value)} placeholder="Masalan: Daraxt kesish" />
        </Field>
        <Field
          label="Slug (URL)"
          hint={errors.slug ? <span className="text-error">{errors.slug}</span> : `Bo'sh qolsa: ${slugify(form.name) || "avtomatik"}`}
        >
          <input className={inputClass} value={form.slug} placeholder="auto" onChange={(e) => set("slug", e.target.value.toLowerCase())} />
        </Field>
        <Field label="Toifa" hint="Filtrlash uchun guruh nomi">
          <input className={inputClass} list="catalog-categories" value={form.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="catalog-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Emoji" hint={errors.emoji ? <span className="text-error">{errors.emoji}</span> : undefined}>
          <input className={inputClass} value={form.emoji} onChange={(e) => set("emoji", e.target.value)} />
        </Field>
        <Field label="Tartib raqami" hint={errors.sort_order ? <span className="text-error">{errors.sort_order}</span> : "Kichik raqam — oldinroq"}>
          <input className={inputClass} inputMode="numeric" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <div className="flex min-w-0 flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-on-surface-variant">Ikonka</span>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                title={icon}
                onClick={() => set("icon", icon)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  form.icon === icon
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-[#26352c] bg-[#0d100f] text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </button>
            ))}
            <input
              className={`${inputClass} h-10 w-full sm:w-44`}
              value={form.icon}
              placeholder="material icon"
              onChange={(e) => set("icon", e.target.value.trim())}
            />
          </div>
        </div>
        <Field label="Davomiylik" className="sm:col-span-2">
          <input className={inputClass} value={form.duration} onChange={(e) => set("duration", e.target.value)} />
        </Field>
        <Field
          label="Qisqa tavsif"
          className="sm:col-span-2"
          hint={
            errors.short_description ? (
              <span className="text-error">{errors.short_description}</span>
            ) : (
              `${form.short_description.length}/255`
            )
          }
        >
          <textarea rows={2} className={inputClass} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} />
        </Field>
        <Field label="To'liq tavsif" className="sm:col-span-2">
          <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <ImageUploadField
            label="Rasm"
            file={file}
            existing={existingPreview}
            onFile={(f) => {
              setFile(f);
              setRemoveCover(false);
            }}
            onClear={() => {
              setFile(null);
              setRemoveCover(true);
              set("hero_image_url", "");
            }}
          />
        </div>
        <Field
          label="yoki rasm URL"
          className="sm:col-span-2"
          hint={errors.hero_image_url ? <span className="text-error">{errors.hero_image_url}</span> : "Yuklangan rasm bo'lsa, u ustun turadi."}
        >
          <input className={inputClass} value={form.hero_image_url} placeholder="https://..." onChange={(e) => set("hero_image_url", e.target.value.trim())} />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#26352c] bg-[#0d100f] px-4 py-3 text-sm sm:col-span-2">
          <span>
            <span className="font-semibold">Faol</span>
            <span className="block text-xs text-on-surface-variant">Mobil ilova katalogida ko&apos;rinsin</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[#4caf50]" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        </label>
      </div>
    </Modal>
  );
}
