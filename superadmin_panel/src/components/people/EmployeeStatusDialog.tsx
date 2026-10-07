"use client";

import { useState } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton } from "@/components/ui";
import { api } from "@/lib/api/client";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "./api";
import type { EmployeeFull, EmploymentStatus } from "./types";

export const EMPLOYMENT_META: Record<
  EmploymentStatus,
  { label: string; icon: string; tone: "success" | "warning" | "error"; description: string }
> = {
  active: { label: "Ishda", icon: "check_circle", tone: "success", description: "Buyurtmalarga tayinlanishi mumkin" },
  on_leave: { label: "Ta'tilda", icon: "beach_access", tone: "warning", description: "Vaqtincha tayinlanmaydi" },
  dismissed: { label: "Ishdan bo'shagan", icon: "person_off", tone: "error", description: "Hisob bloklanadi, tarix saqlanadi" },
};

export function employmentStatus(emp: EmployeeFull): EmploymentStatus {
  return emp.employment_status ?? (emp.is_active ? "active" : "dismissed");
}

const TONE_CLS = {
  success: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  error: "border-error/40 bg-error/10 text-error",
};

/** `key` bilan qayta o'rnatiladi; `is_active` backendda faqat o'qiladi — holat `set-status` orqali o'zgaradi. */
export function EmployeeStatusDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeFull | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { showSuccess, showError } = useToast();
  const current = employee ? employmentStatus(employee) : "active";
  const [next, setNext] = useState<EmploymentStatus>(current === "active" ? "on_leave" : "active");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!employee) return;
    if (next === "dismissed" && !reason.trim()) {
      setError("Ishdan bo'shatish sababini yozing");
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/employees/${employee.id}/set-status/`, {
        method: "POST",
        body: { status: next, reason: reason.trim() },
      });
      showSuccess(`"${employee.user.full_name || employee.user.phone}" — ${EMPLOYMENT_META[next].label.toLowerCase()}`);
      await onSaved();
      onClose();
    } catch (e) {
      showError(errorMessage(e, "Holatni o'zgartirib bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!employee}
      size="md"
      title="Xodim holatini o'zgartirish"
      description={
        employee ? (
          <>
            {employee.user.full_name || employee.user.phone} · hozir: <strong>{EMPLOYMENT_META[current].label}</strong>
          </>
        ) : null
      }
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose} className="justify-center">
            Bekor qilish
          </SecondaryButton>
          <PrimaryButton icon="published_with_changes" disabled={busy || next === current} onClick={() => void submit()} className="justify-center">
            {busy ? "Saqlanmoqda..." : "Holatni saqlash"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Yangi holat">
          {(Object.keys(EMPLOYMENT_META) as EmploymentStatus[]).map((s) => {
            const meta = EMPLOYMENT_META[s];
            const selected = next === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={s === current}
                onClick={() => {
                  setNext(s);
                  setError("");
                }}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected ? TONE_CLS[meta.tone] : "border-[#26352c] bg-[#0d100f] text-on-surface hover:border-[#384f40]"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                  {meta.label}
                </span>
                <span className="text-[11px] text-on-surface-variant">{s === current ? "Joriy holat" : meta.description}</span>
              </button>
            );
          })}
        </div>
        <Field
          label={next === "dismissed" ? "Ishdan bo'shatish sababi" : "Izoh (ixtiyoriy)"}
          required={next === "dismissed"}
          hint={error ? <span className="text-error">{error}</span> : "Izoh xodim kartasidagi tarixga yoziladi"}
        >
          <textarea
            rows={3}
            className={`${inputClass}${error ? " border-error/70" : ""}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            placeholder={next === "dismissed" ? "Masalan: o'z xohishiga ko'ra" : "Masalan: yillik ta'til, 14 kun"}
          />
        </Field>
      </div>
    </Modal>
  );
}
