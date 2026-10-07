"use client";

import { useState } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { Banner, BannerStatus, Service } from "@/lib/api/types";
import { BANNER_STATUS_LABEL } from "@/lib/domain";
import { useToast } from "@/providers/ToastProvider";
import { ImageUploadField } from "./ImageUploadField";

export const PLACEMENT_LABEL: Record<Banner["placement"], string> = {
  home: "Bosh sahifa karuseli",
  promo: "Promo bo'lim",
};

const STATUS_HINT: Record<BannerStatus, string> = {
  draft: "Ilovada ko'rinmaydi",
  scheduled: "Boshlanish vaqti kelganda chiqadi",
  active: "Darhol ko'rinadi (muddat oralig'ida)",
  archived: "Yashirilgan, tarix uchun saqlanadi",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → `<input type="datetime-local">` qiymati (mahalliy vaqt). */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

type FormState = {
  title: string;
  description: string;
  image_url: string;
  placement: Banner["placement"];
  link_service: string;
  starts_at: string;
  ends_at: string;
  status: BannerStatus;
  sort_order: string;
};

type Errors = Partial<Record<keyof FormState | "image", string>>;

function fromBanner(b: Banner | null): FormState {
  if (!b) {
    return {
      title: "",
      description: "",
      image_url: "",
      placement: "home",
      link_service: "",
      starts_at: "",
      ends_at: "",
      status: "active",
      sort_order: "0",
    };
  }
  return {
    title: b.title,
    description: b.description || "",
    image_url: b.image_url || "",
    placement: b.placement,
    link_service: b.link_service ? String(b.link_service) : "",
    starts_at: toLocalInput(b.starts_at),
    ends_at: toLocalInput(b.ends_at),
    status: b.status,
    sort_order: String(b.sort_order ?? 0),
  };
}

/** Ota komponent har ochilishda `key` beradi — shuning uchun holat to'g'ridan-to'g'ri `editing`dan olinadi. */
export function BannerFormModal({
  editing,
  services,
  onClose,
  onSaved,
}: {
  editing: Banner | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState<FormState>(() => fromBanner(editing));
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const uploaded = editing?.image && !removeImage ? editing.image_src : "";
  const existingPreview = uploaded || form.image_url;
  const linkedMissing =
    editing?.link_service && !services.some((s) => s.id === editing.link_service)
      ? { id: editing.link_service, name: editing.service_name || `Xizmat #${editing.link_service}` }
      : null;

  function validate(): Errors {
    const e: Errors = {};
    if (!form.title.trim()) e.title = "Sarlavhani kiriting.";
    else if (form.title.length > 255) e.title = "Sarlavha 255 belgidan oshmasin.";
    if (!file && !uploaded && !form.image_url) e.image = "Rasm yuklang yoki rasm URL kiriting.";
    if (form.image_url && !/^https?:\/\/\S+$/i.test(form.image_url)) e.image_url = "URL http(s):// bilan boshlansin.";
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      e.ends_at = "Tugash vaqti boshlanishdan keyin bo'lsin.";
    }
    if (form.status === "scheduled" && !form.starts_at) e.starts_at = "Rejalashtirilgan banner uchun boshlanish vaqtini kiriting.";
    if (!/^\d+$/.test(form.sort_order || "0")) e.sort_order = "Musbat butun son kiriting.";
    return e;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setServerError("");
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("image_url", form.image_url);
    fd.append("placement", form.placement);
    fd.append("status", form.status);
    fd.append("sort_order", String(Number(form.sort_order) || 0));
    fd.append("link_service", form.link_service);
    fd.append("starts_at", fromLocalInput(form.starts_at));
    fd.append("ends_at", fromLocalInput(form.ends_at));
    if (file) fd.append("image", file);
    else if (removeImage && editing?.image) fd.append("image", "");
    try {
      if (editing) await api(`/admin/banners/${editing.id}/`, { method: "PATCH", body: fd });
      else await api("/admin/banners/", { method: "POST", body: fd });
      showSuccess(editing ? "Banner yangilandi" : "Banner qo'shildi");
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Saqlanmadi";
      setServerError(msg);
      showError(msg);
    } finally {
      setBusy(false);
    }
  }

  const errorHint = (key: keyof Errors, fallback?: string) =>
    errors[key] ? <span className="text-error">{errors[key]}</span> : fallback;

  return (
    <Modal
      open
      size="lg"
      title={editing ? "Bannerni tahrirlash" : "Yangi banner"}
      description="Mijoz ilovasidagi karusel/promo banner. Rasm 16:9 (masalan 1280×720) bo'lsa chiroyli ko'rinadi."
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

        <div className="sm:col-span-2">
          <ImageUploadField
            label="Banner rasmi *"
            file={file}
            existing={existingPreview}
            error={errors.image}
            onFile={(f) => {
              setFile(f);
              setRemoveImage(false);
              setErrors((e) => ({ ...e, image: undefined }));
            }}
            onClear={() => {
              setFile(null);
              setRemoveImage(true);
              set("image_url", "");
            }}
          />
        </div>

        <Field label="Sarlavha" required className="sm:col-span-2" hint={errorHint("title", `${form.title.length}/255`)}>
          <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Masalan: Bahorgi chegirma −20%" />
        </Field>
        <Field label="Qisqa matn (subtitle)" className="sm:col-span-2" hint="Ilovada sarlavha ostida chiqadi">
          <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <Field label="Joylashuv" required>
          <select className={inputClass} value={form.placement} onChange={(e) => set("placement", e.target.value as Banner["placement"])}>
            {Object.entries(PLACEMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bog'langan xizmat" hint="Banner bosilganda shu xizmat ochiladi">
          <select className={inputClass} value={form.link_service} onChange={(e) => set("link_service", e.target.value)}>
            <option value="">— Bog&apos;lanmagan —</option>
            {linkedMissing ? <option value={linkedMissing.id}>{linkedMissing.name}</option> : null}
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji ? `${s.emoji} ` : ""}
                {s.name}
                {s.is_active ? "" : " (to'xtatilgan)"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Boshlanish" hint={errorHint("starts_at", "Bo'sh — darhol")}>
          <input type="datetime-local" className={inputClass} value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
        </Field>
        <Field label="Tugash" hint={errorHint("ends_at", "Bo'sh — muddatsiz")}>
          <input
            type="datetime-local"
            className={inputClass}
            value={form.ends_at}
            min={form.starts_at || undefined}
            onChange={(e) => set("ends_at", e.target.value)}
          />
        </Field>

        <Field label="Tartib raqami" hint={errorHint("sort_order", "Kichik raqam — oldinroq")}>
          <input className={inputClass} inputMode="numeric" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <Field label="yoki rasm URL" hint={errorHint("image_url", "Fayl yuklansa, fayl ustun turadi")}>
          <input className={inputClass} value={form.image_url} placeholder="https://..." onChange={(e) => set("image_url", e.target.value.trim())} />
        </Field>

        <div className="flex min-w-0 flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-on-surface-variant">Holat</span>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(Object.keys(BANNER_STATUS_LABEL) as BannerStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => set("status", st)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  form.status === st
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[#26352c] bg-[#0d100f] text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="block text-sm font-semibold">{BANNER_STATUS_LABEL[st]}</span>
                <span className="block text-[11px] leading-tight opacity-80">{STATUS_HINT[st]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
