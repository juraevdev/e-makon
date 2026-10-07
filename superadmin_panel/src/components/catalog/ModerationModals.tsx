"use client";

import { useState, type ReactNode } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton, StatusPill } from "@/components/ui";
import type { Service } from "@/lib/api/types";
import { MODERATION_LABEL, MODERATION_TONE } from "@/lib/domain";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ServiceThumb } from "./ServiceThumb";

export const priceOf = (s: Service) => Number(s.price ?? s.price_from ?? 0);

const REJECT_REASONS = [
  "Narx noto'g'ri yoki asossiz",
  "Tavsif yetarli emas — batafsil yozing",
  "Rasm sifatsiz yoki xizmatga mos emas",
  "Katalogda bunday tur bor — mavjud turga qo'shing",
  "Platforma qoidalariga zid",
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <div className="mt-0.5 break-words text-sm font-semibold">{children}</div>
    </div>
  );
}

/** Firma yuborgan xizmatni to'liq ko'rish: rasm, narx, tavsif, holat + tasdiqlash/rad etish. */
export function ServicePreviewModal({
  service,
  peerPrices,
  busy,
  onClose,
  onApprove,
  onReject,
}: {
  service: Service | null;
  peerPrices: number[];
  busy: boolean;
  onClose: () => void;
  onApprove: (s: Service) => void;
  onReject: (s: Service) => void;
}) {
  if (!service) return null;
  const s = service;
  const gallery = (s.gallery_images ?? []).filter(Boolean);
  const longText = s.long_description && s.long_description !== s.description ? s.long_description : "";
  return (
    <Modal
      open
      size="lg"
      title={`${s.emoji ? `${s.emoji} ` : ""}${s.name}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {s.organization_name || "Platforma"}
          {s.moderation_status ? (
            <StatusPill variant={MODERATION_TONE[s.moderation_status]}>{MODERATION_LABEL[s.moderation_status]}</StatusPill>
          ) : null}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose} className="justify-center">
            Yopish
          </SecondaryButton>
          {!s.is_catalog_type && s.moderation_status !== "rejected" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(s)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-error/40 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Rad etish
            </button>
          ) : null}
          {!s.is_catalog_type && s.moderation_status !== "approved" ? (
            <PrimaryButton icon="check" disabled={busy} onClick={() => onApprove(s)} className="justify-center">
              Tasdiqlash
            </PrimaryButton>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {s.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.image} alt={s.name} className="aspect-[16/9] w-full rounded-2xl border border-[#26352c] object-cover" />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#26352c] p-4 text-sm text-on-surface-variant">
            <ServiceThumb service={s} className="h-12 w-12" />
            Rasm yuklanmagan
          </div>
        )}
        {gallery.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {gallery.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="h-20 w-28 shrink-0 rounded-xl border border-[#26352c] object-cover" />
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Row label="Narx">
            <span className="text-primary">{formatMoney(priceOf(s), s.currency || "UZS")}</span>
          </Row>
          <Row label="Katalog turi">{s.is_catalog_type ? "Asosiy tur" : s.base_service_name || <span className="text-amber-300">Yangi tur taklifi</span>}</Row>
          <Row label="Toifa">{s.category || "—"}</Row>
          <Row label="Davomiylik">{s.duration || "—"}</Row>
          <Row label="Yuborilgan">{formatDateTime(s.created_at)}</Row>
          <Row label="Yangilangan">{formatDateTime(s.updated_at)}</Row>
        </div>

        {peerPrices.length ? (
          <p className="rounded-xl bg-[#0e1210] px-3 py-2 text-xs text-on-surface-variant">
            Shu turdagi {peerPrices.length} ta tasdiqlangan firma narxi: {formatMoney(Math.min(...peerPrices))} –{" "}
            {formatMoney(Math.max(...peerPrices))}
            {priceOf(s) > Math.max(...peerPrices) * 1.5 ? (
              <span className="ml-1 font-semibold text-amber-300">· bu narx bozordan ancha yuqori</span>
            ) : null}
          </p>
        ) : null}

        <div className="space-y-2 text-sm">
          <p className="font-semibold">Qisqa tavsif</p>
          <p className="text-on-surface-variant">{s.short_description || "Tavsif yo'q"}</p>
          {s.description ? (
            <>
              <p className="pt-2 font-semibold">Batafsil</p>
              <p className="whitespace-pre-line text-on-surface-variant">{s.description}</p>
            </>
          ) : null}
          {longText ? <p className="whitespace-pre-line text-on-surface-variant">{longText}</p> : null}
        </div>

        {s.features?.length ? (
          <div className="flex flex-wrap gap-2">
            {s.features.map((f) => (
              <span key={f.label} className="inline-flex items-center gap-1 rounded-full border border-[#26352c] px-3 py-1 text-xs">
                <span className="material-symbols-outlined text-[14px] text-primary">{f.icon || "check"}</span>
                {f.label}
              </span>
            ))}
          </div>
        ) : null}

        {s.moderation_note ? (
          <p className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">Oxirgi izoh: {s.moderation_note}</p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Rad etish sababi firmaga xabar sifatida yuboriladi (backend sababsiz rad etishni qabul qilmaydi). */
export function RejectServiceModal({
  service,
  busy,
  onClose,
  onConfirm,
}: {
  service: Service | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (s: Service, note: string) => void;
}) {
  const [note, setNote] = useState("");
  if (!service) return null;
  const trimmed = note.trim();
  return (
    <Modal
      open
      size="md"
      title="Xizmatni rad etish"
      description={`${service.organization_name || "Firma"} · ${service.name} · ${formatMoney(priceOf(service))}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose} className="justify-center">
            Bekor qilish
          </SecondaryButton>
          <button
            type="button"
            disabled={busy || trimmed.length < 5}
            onClick={() => onConfirm(service, trimmed)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-error/50 bg-error/10 px-5 py-2.5 text-sm font-semibold text-error hover:bg-error/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">block</span>
            {busy ? "Yuborilmoqda..." : "Rad etish"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setNote((n) => (n.includes(r) ? n : n.trim() ? `${n.trim()}. ${r}` : r))}
              className="rounded-full border border-[#26352c] bg-[#0e1210] px-3 py-1.5 text-xs text-on-surface-variant hover:border-error/40 hover:text-on-surface"
            >
              {r}
            </button>
          ))}
        </div>
        <Field
          label="Sabab (firmaga yuboriladi)"
          required
          hint={trimmed && trimmed.length < 5 ? <span className="text-error">Sababni aniqroq yozing (kamida 5 belgi).</span> : undefined}
        >
          <textarea rows={4} autoFocus className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
