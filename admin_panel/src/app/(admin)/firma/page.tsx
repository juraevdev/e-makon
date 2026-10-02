"use client";

import { useState } from "react";
import {
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import type { FirmStats, PartnerFirm } from "@/lib/api/types";
import { FIRM_STATUS_LABEL, SPECIALTY_LABEL } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useFirm } from "@/providers/FirmProvider";
import { useToast } from "@/providers/ToastProvider";

type ContactForm = {
  phone: string;
  email: string;
  address: string;
  region: string;
  district: string;
  description: string;
  location_lat: string;
  location_lng: string;
  work_hours: string;
  website: string;
  telegram_channel: string;
  telegram_group: string;
  instagram: string;
  youtube: string;
  facebook: string;
};

type SocialKey = "telegram_channel" | "telegram_group" | "instagram" | "youtube" | "facebook" | "website";

const SOCIALS: { key: SocialKey; label: string; icon: string; color: string; placeholder: string }[] = [
  { key: "telegram_channel", label: "Telegram kanal", icon: "campaign", color: "#29a9eb", placeholder: "@kanal_nomi yoki https://t.me/..." },
  { key: "telegram_group", label: "Telegram guruh", icon: "groups", color: "#29a9eb", placeholder: "@guruh_nomi" },
  { key: "instagram", label: "Instagram", icon: "photo_camera", color: "#e1306c", placeholder: "@instagram_sahifa" },
  { key: "youtube", label: "YouTube", icon: "smart_display", color: "#ff0000", placeholder: "@kanal yoki https://youtube.com/..." },
  { key: "facebook", label: "Facebook", icon: "thumb_up", color: "#1877f2", placeholder: "sahifa nomi" },
  { key: "website", label: "Veb-sayt", icon: "language", color: "#4caf50", placeholder: "https://firma.uz" },
];

function socialUrl(key: SocialKey, value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  if (key === "telegram_channel" || key === "telegram_group") return `https://t.me/${handle}`;
  if (key === "instagram") return `https://instagram.com/${handle}`;
  if (key === "youtube") return `https://youtube.com/@${handle}`;
  if (key === "facebook") return `https://facebook.com/${handle}`;
  return `https://${raw}`;
}

const MESSAGE_KIND_LABEL: Record<string, string> = {
  message: "Xabar",
  warning: "Ogohlantirish",
  report: "Hisobot",
};

function toForm(f: PartnerFirm): ContactForm {
  return {
    phone: f.phone || "",
    email: f.email || "",
    address: f.address || "",
    region: f.region || "",
    district: f.district || "",
    description: f.description || "",
    location_lat: f.location_lat != null ? String(f.location_lat) : "",
    location_lng: f.location_lng != null ? String(f.location_lng) : "",
    work_hours: f.work_hours || "",
    website: f.website || "",
    telegram_channel: f.telegram_channel || "",
    telegram_group: f.telegram_group || "",
    instagram: f.instagram || "",
    youtube: f.youtube || "",
    facebook: f.facebook || "",
  };
}

function ContactSection({ firm }: { firm: PartnerFirm }) {
  const { refreshFirm } = useFirm();
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState<ContactForm>(() => toForm(firm));
  const [busy, setBusy] = useState(false);

  function fillMyLocation() {
    if (!navigator.geolocation) return showError("Brauzer joylashuvni bermaydi");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          location_lat: pos.coords.latitude.toFixed(6),
          location_lng: pos.coords.longitude.toFixed(6),
        })),
      () => showError("Joylashuvga ruxsat berilmadi"),
    );
  }

  async function save() {
    setBusy(true);
    try {
      await api("/admin/firms/me/", {
        method: "PATCH",
        body: {
          ...form,
          location_lat: form.location_lat ? Number(form.location_lat) : null,
          location_lng: form.location_lng ? Number(form.location_lng) : null,
        },
      });
      await refreshFirm();
      showSuccess("Firma ma'lumotlari saqlandi");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-6">
      <h3 className="mb-1 text-lg font-semibold">Aloqa ma&apos;lumotlari</h3>
      <p className="mb-4 text-xs text-on-surface-variant">Mijozlar ilovada shu ma&apos;lumotlarni ko&apos;radi.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Telefon">
          <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Viloyat">
          <input className={inputClass} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </Field>
        <Field label="Tuman">
          <input className={inputClass} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Manzil">
            <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
        </div>
        <Field label="Kenglik (lat)">
          <input className={inputClass} value={form.location_lat} onChange={(e) => setForm({ ...form, location_lat: e.target.value })} />
        </Field>
        <Field label="Uzunlik (lng)">
          <input className={inputClass} value={form.location_lng} onChange={(e) => setForm({ ...form, location_lng: e.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <SecondaryButton icon="my_location" onClick={fillMyLocation}>
            Joriy joylashuvni olish
          </SecondaryButton>
          {form.location_lat && form.location_lng ? (
            <a
              href={`https://www.google.com/maps?q=${form.location_lat},${form.location_lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-[#26352c] px-4 py-2 text-sm text-primary hover:bg-primary/10"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              Google Mapsda ko&apos;rish
            </a>
          ) : null}
        </div>
        <Field label="Ish vaqti">
          <input
            className={inputClass}
            placeholder="DuвЂ“Sha 08:00вЂ“19:00"
            value={form.work_hours}
            onChange={(e) => setForm({ ...form, work_hours: e.target.value })}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Firma haqida">
            <textarea
              className={inputClass}
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <h3 className="mb-1 mt-8 text-lg font-semibold">Ijtimoiy tarmoqlar</h3>
      <p className="mb-4 text-xs text-on-surface-variant">
        Telegram kanal, guruh, Instagram va YouTube sahifalaringiz ilovadagi firma sahifasida tugma sifatida chiqadi. @nom yoki
        to&apos;liq havola kiritishingiz mumkin.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SOCIALS.map((s) => (
            <Field key={s.key} label={s.label}>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: s.color }}>
                  {s.icon}
                </span>
                <input
                  className={`${inputClass} pl-10`}
                  placeholder={s.placeholder}
                  value={form[s.key]}
                  onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                />
              </div>
            </Field>
          ))}
        </div>
        <div className="rounded-3xl border border-[#26352c] bg-[#0b0f0c] p-4">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-on-surface-variant">Ilovada ko&apos;rinishi</p>
          <p className="font-bold">{firm.name}</p>
          <p className="text-xs text-on-surface-variant">
            в… {Number(firm.rating).toFixed(1)} В· {form.work_hours || "Ish vaqti ko'rsatilmagan"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIALS.filter((s) => form[s.key].trim()).map((s) => (
              <a
                key={s.key}
                href={socialUrl(s.key, form[s.key])}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: s.color }}
              >
                <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
                {s.label}
              </a>
            ))}
            {!SOCIALS.some((s) => form[s.key].trim()) ? (
              <p className="text-xs text-on-surface-variant">Hali tarmoq qo&apos;shilmagan</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <PrimaryButton icon="save" disabled={busy} onClick={() => void save()}>
          Saqlash
        </PrimaryButton>
      </div>
    </section>
  );
}

export default function FirmaPage() {
  const { firm } = useFirm();
  const { showError } = useToast();

  const { data: stats, reload } = useAsync(async () => {
    if (!firm) return null;
    return api<FirmStats>(`/admin/firms/${firm.id}/stats/`);
  }, [firm?.id]);

  const unread = stats?.messages.filter((m) => !m.is_read).length ?? 0;

  async function markRead() {
    try {
      await api("/admin/firms/me/read-messages/", { method: "POST" });
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    }
  }

  if (!firm) return <LoadingBlock />;

  const info: { label: string; value: string }[] = [
    { label: "Yuridik nomi", value: firm.legal_name || "вЂ”" },
    { label: "Yo'nalish", value: firm.specialty_label || SPECIALTY_LABEL[firm.specialty] || firm.specialty },
    { label: "Holat", value: firm.is_sales_banned ? "Sotuv taqiqlangan" : FIRM_STATUS_LABEL[firm.status] },
    { label: "Reyting", value: `в… ${Number(firm.rating).toFixed(1)} (${firm.ratings_count} baho)` },
    { label: "Platforma ulushi", value: `${firm.commission_rate}%` },
    {
      label: "Obuna",
      value:
        firm.subscription_plan === "none"
          ? "Yo'q"
          : `${firm.subscription_plan === "monthly" ? "Oylik" : "Yillik"} В· $${firm.subscription_fee_usd}`,
    },
    { label: "Sinov muddati", value: firm.trial_ends_at ? `${formatDate(firm.trial_ends_at)} gacha` : "вЂ”" },
    { label: "Ogohlantirishlar", value: String(firm.warnings_count) },
    { label: "Platformaga qo'shilgan", value: formatDate(firm.created_at) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <section className="rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[28px]">storefront</span>
          </div>
          <div>
            <h2 className="text-xl font-bold">{firm.name}</h2>
            <p className="text-xs text-on-surface-variant">
              Nom, yo&apos;nalish va ulush stavkasini tizim ma&apos;muriyati belgilaydi.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {info.map((i) => (
            <div key={i.label} className="rounded-xl border border-[#263b2a] bg-[#0e1510] px-4 py-3">
              <p className="text-xs text-on-surface-variant">{i.label}</p>
              <p className="mt-0.5 text-sm font-semibold">{i.value}</p>
            </div>
          ))}
        </div>
      </section>

      <ContactSection key={firm.updated_at} firm={firm} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90">
          <div className="flex items-center justify-between border-b border-[#263b2a] px-5 py-4">
            <h3 className="text-sm font-bold">
              Ma&apos;muriyat xabarlari
              {unread ? <span className="ml-2 rounded-full bg-error/20 px-2 py-0.5 text-xs text-error">{unread} yangi</span> : null}
            </h3>
            {unread ? (
              <SecondaryButton icon="done_all" onClick={() => void markRead()}>
                O&apos;qildi
              </SecondaryButton>
            ) : null}
          </div>
          {!stats?.messages.length ? (
            <EmptyState icon="mail" title="Xabarlar yo'q" />
          ) : (
            <div className="max-h-[420px] divide-y divide-[#263b2a]/40 overflow-y-auto">
              {stats.messages.map((m) => (
                <div key={m.id} className={`px-5 py-3 ${m.is_read ? "" : "bg-primary/5"}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <StatusPill variant={m.kind === "warning" ? "error" : "info"}>{MESSAGE_KIND_LABEL[m.kind] || m.kind}</StatusPill>
                    <span className="text-xs text-on-surface-variant">{formatDateTime(m.created_at)}</span>
                  </div>
                  {m.subject ? <p className="text-sm font-semibold">{m.subject}</p> : null}
                  <p className="text-sm text-on-surface-variant">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90">
          <h3 className="border-b border-[#263b2a] px-5 py-4 text-sm font-bold">Jarimalar</h3>
          {!stats?.fines.length ? (
            <EmptyState icon="gavel" title="Jarimalar yo'q" />
          ) : (
            <div className="divide-y divide-[#263b2a]/40">
              {stats.fines.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{f.reason || "Jarima"}</p>
                    <p className="text-xs text-on-surface-variant">{formatDateTime(f.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatMoney(f.amount, f.currency)}</p>
                    <StatusPill variant={f.is_paid ? "success" : "error"}>{f.is_paid ? "To'langan" : "To'lanmagan"}</StatusPill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90">
        <h3 className="border-b border-[#263b2a] px-5 py-4 text-sm font-bold">Mijoz baholari</h3>
        {!stats?.reviews.length ? (
          <EmptyState icon="star" title="Hali baholar yo'q" />
        ) : (
          <div className="divide-y divide-[#263b2a]/40">
            {stats.reviews.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <p className="text-sm font-medium">
                  <span className="text-amber-400">{"в…".repeat(r.score)}</span>
                  <span className="text-on-surface-variant">{"в…".repeat(Math.max(0, 5 - r.score))}</span>
                  <span className="ml-2">{r.customer_name || "Mijoz"}</span>
                  {r.order ? <span className="text-on-surface-variant"> В· #{r.order}</span> : null}
                </p>
                {r.comment ? <p className="text-sm text-on-surface-variant">{r.comment}</p> : null}
                <p className="text-xs text-on-surface-variant">{formatDateTime(r.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
