"use client";

import { useState } from "react";
import { Field, Modal, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import type { LoyaltyReward } from "@/lib/api/types";

export type RewardInput = Pick<LoyaltyReward, "name" | "icon" | "points_cost" | "is_active" | "sort_order">;

const ICONS = [
  "redeem",
  "card_giftcard",
  "local_offer",
  "percent",
  "loyalty",
  "workspace_premium",
  "diamond",
  "star",
  "celebration",
  "yard",
  "local_florist",
  "eco",
  "spa",
  "park",
  "grass",
  "water_drop",
  "content_cut",
  "local_shipping",
];

type Draft = { name: string; icon: string; points_cost: string; sort_order: string; is_active: boolean };
type Errors = Partial<Record<keyof Draft, string>>;

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.name.trim()) errors.name = "Nomini kiriting";
  else if (d.name.trim().length > 255) errors.name = "255 belgidan oshmasin";
  if (!/^[a-z0-9_]{1,64}$/.test(d.icon.trim())) errors.icon = "Material Symbols nomi: kichik lotin harflari, raqam va _";
  const cost = Number(d.points_cost);
  if (!d.points_cost.trim() || !Number.isInteger(cost) || cost < 1) errors.points_cost = "Butun son, kamida 1 ball";
  else if (cost > 2_000_000_000) errors.points_cost = "Juda katta qiymat";
  const order = Number(d.sort_order || "0");
  if (!Number.isInteger(order) || order < 0) errors.sort_order = "0 yoki musbat butun son";
  return errors;
}

export function RewardFormModal({
  reward,
  nextSortOrder,
  minRedeem,
  busy,
  onClose,
  onSave,
}: {
  reward: LoyaltyReward | null;
  nextSortOrder: number;
  minRedeem: number | undefined;
  busy: boolean;
  onClose: () => void;
  onSave: (input: RewardInput) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    reward
      ? {
          name: reward.name,
          icon: reward.icon || "redeem",
          points_cost: String(reward.points_cost),
          sort_order: String(reward.sort_order),
          is_active: reward.is_active,
        }
      : { name: "", icon: "redeem", points_cost: "100", sort_order: String(nextSortOrder), is_active: true },
  );
  const [touched, setTouched] = useState(false);
  const errors = validate(draft);
  const show = (key: keyof Draft) => (touched && errors[key] ? <span className="text-error">{errors[key]}</span> : null);
  const cost = Number(draft.points_cost);

  function submit() {
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSave({
      name: draft.name.trim(),
      icon: draft.icon.trim(),
      points_cost: cost,
      sort_order: Number(draft.sort_order || "0"),
      is_active: draft.is_active,
    });
  }

  return (
    <Modal
      open
      size="lg"
      title={reward ? "Mukofotni tahrirlash" : "Yangi mukofot"}
      description="Mijozlar mobil ilovada ballarini shu mukofotlarga almashtiradi."
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>
            Bekor qilish
          </SecondaryButton>
          <PrimaryButton icon="save" onClick={submit} disabled={busy}>
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </PrimaryButton>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_220px]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="space-y-4">
          <Field label="Nomi" required hint={show("name")}>
            <input
              autoFocus
              maxLength={255}
              className={inputClass}
              value={draft.name}
              placeholder="Masalan: Bepul sug'orish xizmati"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Narxi (ball)"
              required
              hint={
                show("points_cost") ??
                (minRedeem && cost > 0 && cost < minRedeem ? (
                  <span className="text-amber-300">Minimal almashtirish {minRedeem} ball — mijozga kamida shuncha ball kerak bo&apos;ladi.</span>
                ) : null)
              }
            >
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className={inputClass}
                value={draft.points_cost}
                onChange={(e) => setDraft({ ...draft, points_cost: e.target.value })}
              />
            </Field>
            <Field label="Tartib raqami" hint={show("sort_order") ?? "Kichik raqam ro'yxatda yuqorida turadi"}>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className={inputClass}
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Belgi (ikonka)" required hint={show("icon")}>
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    title={icon}
                    onClick={() => setDraft({ ...draft, icon })}
                    className={`flex aspect-square items-center justify-center rounded-xl border transition ${
                      draft.icon === icon
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-[#26352c] text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{icon}</span>
                  </button>
                ))}
              </div>
              <input
                maxLength={64}
                className={`${inputClass} font-mono text-xs`}
                value={draft.icon}
                placeholder="Yoki boshqa Material Symbols nomi"
                onChange={(e) => setDraft({ ...draft, icon: e.target.value.toLowerCase() })}
              />
            </div>
          </Field>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Faol</span>
              <span className="text-xs text-on-surface-variant">Nofaol mukofot mobil ilovada ko&apos;rinmaydi va almashtirilmaydi</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#2e7d32]"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-on-surface-variant">Ko&apos;rinishi</p>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#26352c] bg-gradient-to-b from-[#16211a] to-[#0f1411] p-5 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[34px]">{draft.icon || "redeem"}</span>
            </span>
            <p className="line-clamp-2 font-semibold">{draft.name || "Mukofot nomi"}</p>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
              {Number.isFinite(cost) && cost > 0 ? cost.toLocaleString("uz-UZ") : "—"} ball
            </span>
            {!draft.is_active ? <span className="text-xs text-on-surface-variant">Nofaol</span> : null}
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
