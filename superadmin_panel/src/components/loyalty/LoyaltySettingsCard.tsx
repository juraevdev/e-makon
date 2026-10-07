"use client";

import { useState } from "react";
import { Card, Field, LoadingBlock, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import type { LoyaltySettings } from "@/lib/api/types";

type Draft = Record<keyof LoyaltySettings, string>;
type Errors = Partial<Record<keyof LoyaltySettings, string>>;

const MAX_INT = 2_147_483_647;

function toDraft(s: LoyaltySettings): Draft {
  return {
    uzs_per_point: String(s.uzs_per_point),
    min_redeem_points: String(s.min_redeem_points),
    expire_months: String(s.expire_months),
  };
}

function validate(d: Draft): Errors {
  const errors: Errors = {};
  const int = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const rate = int(d.uzs_per_point);
  if (!Number.isInteger(rate) || rate < 1) errors.uzs_per_point = "Kamida 1 so'm, butun son";
  else if (rate > MAX_INT) errors.uzs_per_point = "Juda katta qiymat";
  const min = int(d.min_redeem_points);
  if (!Number.isInteger(min) || min < 0) errors.min_redeem_points = "0 yoki musbat butun son";
  else if (min > MAX_INT) errors.min_redeem_points = "Juda katta qiymat";
  const months = int(d.expire_months);
  if (!Number.isInteger(months) || months < 0) errors.expire_months = "0 yoki musbat butun son";
  else if (months > 120) errors.expire_months = "Ko'pi bilan 120 oy";
  return errors;
}

export function LoyaltySettingsCard({
  settings,
  error,
  saving,
  onSave,
}: {
  settings: LoyaltySettings | null;
  error: string | null;
  saving: boolean;
  onSave: (patch: Partial<LoyaltySettings>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sample, setSample] = useState("500000");

  if (!settings) {
    return <Card>{error ? <p className="text-sm text-error">{error}</p> : <LoadingBlock />}</Card>;
  }

  const base = toDraft(settings);
  const current = draft ?? base;
  const errors = validate(current);
  const changed = (Object.keys(base) as (keyof Draft)[]).filter((k) => current[k].trim() !== base[k]);
  const dirty = changed.length > 0;
  const valid = !Object.keys(errors).length;
  const rate = Number(current.uzs_per_point) || 0;
  const samplePoints = rate > 0 ? Math.floor((Number(sample) || 0) / rate) : 0;
  const minRedeem = Number(current.min_redeem_points) || 0;

  function set(key: keyof Draft, value: string) {
    setDraft({ ...current, [key]: value });
  }

  async function save() {
    if (!valid || !dirty) return;
    const patch: Partial<LoyaltySettings> = {};
    for (const k of changed) patch[k] = Number(current[k]);
    const ok = await onSave(patch);
    if (ok) setDraft(null);
  }

  const hint = (key: keyof Draft, text: string) =>
    errors[key] ? <span className="text-error">{errors[key]}</span> : text;

  return (
    <Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="material-symbols-outlined text-primary">tune</span>
            Ball to&apos;plash qoidalari
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Ball buyurtma &quot;Bajarildi&quot; holatiga o&apos;tganda kelishilgan narxdan avtomatik hisoblanadi (har buyurtmaga bir marta).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {dirty ? (
            <SecondaryButton icon="undo" disabled={saving} onClick={() => setDraft(null)}>
              Bekor
            </SecondaryButton>
          ) : null}
          <PrimaryButton icon="save" disabled={saving || !dirty || !valid} onClick={() => void save()}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="1 ball uchun buyurtma summasi (so'm)" required hint={hint("uzs_per_point", "Masalan 10 000 — har 10 000 so'mga 1 ball")}>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className={`${inputClass} ${errors.uzs_per_point ? "border-error!" : ""}`}
            value={current.uzs_per_point}
            onChange={(e) => set("uzs_per_point", e.target.value)}
          />
        </Field>
        <Field label="Minimal almashtirish (ball)" required hint={hint("min_redeem_points", "Mijoz balansida kamida shuncha ball bo'lsa almashtira oladi")}>
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className={`${inputClass} ${errors.min_redeem_points ? "border-error!" : ""}`}
            value={current.min_redeem_points}
            onChange={(e) => set("min_redeem_points", e.target.value)}
          />
        </Field>
        <Field label="Amal qilish muddati (oy)" required hint={hint("expire_months", "Ballarning amal qilish muddati")}>
          <input
            type="number"
            min={0}
            max={120}
            step={1}
            inputMode="numeric"
            className={`${inputClass} ${errors.expire_months ? "border-error!" : ""}`}
            value={current.expire_months}
            onChange={(e) => set("expire_months", e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">calculate</span>
          <span className="whitespace-nowrap text-on-surface-variant">Buyurtma summasi:</span>
          <input
            type="number"
            min={0}
            className={`${inputClass} w-36 py-1.5`}
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
        </div>
        <p>
          → mijoz <b className="text-primary">{samplePoints.toLocaleString("uz-UZ")} ball</b> oladi.
          {minRedeem > 0 && rate > 0 ? (
            <span className="text-on-surface-variant">
              {" "}
              Birinchi almashtirish uchun jami ~{(minRedeem * rate).toLocaleString("uz-UZ")} so&apos;mlik buyurtma kerak.
            </span>
          ) : null}
        </p>
      </div>
      {dirty ? <p className="mt-3 text-xs text-amber-300">Saqlanmagan o&apos;zgarishlar bor.</p> : null}
    </Card>
  );
}
