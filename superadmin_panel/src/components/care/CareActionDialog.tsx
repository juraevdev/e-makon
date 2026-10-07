"use client";

import { useState } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { CareContract } from "@/lib/api/types";
import { CARE_ACTIONS, type CareAction } from "./careMeta";

const CONFIRM_STYLE = {
  primary: "",
  warning: "border-amber-500/50! bg-amber-950/70! text-amber-200! hover:bg-amber-900!",
  danger: "border-error/50! bg-error/15! text-error! hover:bg-error/25!",
} as const;

export function CareActionDialog({
  contract,
  action,
  busy,
  onClose,
  onConfirm,
}: {
  contract: CareContract;
  action: CareAction | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (action: CareAction, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  if (!action) return null;
  const conf = CARE_ACTIONS[action];
  const missing = conf.noteRequired && !note.trim();

  function submit() {
    setTouched(true);
    if (missing || !action) return;
    onConfirm(action, note.trim());
  }

  return (
    <Modal
      open
      size="sm"
      title={`${conf.label}: shartnoma #${contract.id}`}
      description={contract.title || contract.customer_name}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>
            Ortga
          </SecondaryButton>
          <PrimaryButton
            icon={busy ? "progress_activity" : conf.icon}
            disabled={busy}
            onClick={submit}
            className={CONFIRM_STYLE[conf.variant]}
          >
            {busy ? "Bajarilmoqda..." : conf.confirmText}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 text-sm text-on-surface-variant">
          {conf.description}
        </p>
        <Field
          label={conf.noteLabel}
          required={conf.noteRequired}
          hint={touched && missing ? <span className="text-error">Sababni yozing — u firmaga yuboriladi.</span> : null}
        >
          <textarea
            autoFocus
            rows={3}
            maxLength={2000}
            className={`${inputClass} resize-y ${touched && missing ? "border-error!" : ""}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            placeholder={conf.noteRequired ? "Masalan: narx bozor narxidan juda yuqori" : "Ixtiyoriy"}
          />
        </Field>
      </div>
    </Modal>
  );
}
