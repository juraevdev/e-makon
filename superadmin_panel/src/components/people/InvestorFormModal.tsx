"use client";

import { useState } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton, TabBar } from "@/components/ui";
import { api } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "./api";
import { FieldError, FormSection, errorRing, isValidEmail, isValidUzPhone, normalizeUzPhone } from "./form";

type TabId = "asosiy" | "investitsiya" | "izoh";
const TAB_ORDER: TabId[] = ["asosiy", "investitsiya", "izoh"];

export const CURRENCIES = ["UZS", "USD", "EUR"] as const;

type FormState = {
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  investment_amount: string;
  currency: (typeof CURRENCIES)[number];
  share_percent: string;
  status: "active" | "pending";
  notes: string;
};

type ErrorKey = "full_name" | "phone" | "email" | "investment_amount" | "share_percent";
type FormErrors = Partial<Record<ErrorKey, string>>;

const ERROR_TAB: Record<ErrorKey, TabId> = {
  full_name: "asosiy",
  phone: "asosiy",
  email: "asosiy",
  investment_amount: "investitsiya",
  share_percent: "investitsiya",
};

const emptyForm: FormState = {
  full_name: "",
  company_name: "",
  phone: "+998",
  email: "",
  address: "",
  investment_amount: "",
  currency: "UZS",
  share_percent: "",
  status: "active",
  notes: "",
};

function phoneEntered(value: string) {
  return value.replace(/\D/g, "").replace(/^998/, "").length > 0;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.full_name.trim().length < 2) errors.full_name = "F.I.Sh. ni kiriting";
  if (phoneEntered(form.phone) && !isValidUzPhone(form.phone)) errors.phone = "Telefon +998 XX XXX XX XX formatida bo'lsin";
  if (form.email.trim() && !isValidEmail(form.email)) errors.email = "Email formati noto'g'ri";
  const amount = Number(form.investment_amount);
  if (!form.investment_amount.trim() || !Number.isFinite(amount) || amount <= 0) errors.investment_amount = "Summani kiriting (0 dan katta)";
  else if (amount >= 1e12) errors.investment_amount = "Summa juda katta";
  if (form.share_percent.trim()) {
    const share = Number(form.share_percent);
    if (!Number.isFinite(share) || share < 0 || share > 100) errors.share_percent = "Ulush 0–100% oralig'ida bo'lsin";
  }
  return errors;
}

/** Backend investorni faqat yaratish va kelishuvni tugatishga ruxsat beradi (tahrirlash endpointi yo'q). */
export function InvestorFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<TabId>("asosiy");
  const [form, setFormState] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  function setForm(patch: Partial<FormState>) {
    setFormState((f) => ({ ...f, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((k) => k in errors)) {
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) as FormErrors);
    }
  }

  const errorCount = (id: TabId) => Object.keys(errors).filter((k) => ERROR_TAB[k as ErrorKey] === id).length || undefined;

  async function save() {
    const next = validate(form);
    setErrors(next);
    const firstBad = (Object.keys(next) as ErrorKey[])[0];
    if (firstBad) {
      setTab(ERROR_TAB[firstBad]);
      showError("Formadagi xatolarni tuzating");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/investors/", {
        method: "POST",
        body: {
          full_name: form.full_name.trim(),
          company_name: form.company_name.trim(),
          phone: phoneEntered(form.phone) ? normalizeUzPhone(form.phone) : "",
          email: form.email.trim(),
          address: form.address.trim(),
          investment_amount: Number(form.investment_amount).toFixed(2),
          currency: form.currency,
          share_percent: Number(form.share_percent || 0).toFixed(2),
          status: form.status,
          notes: form.notes.trim(),
        },
      });
      showSuccess(`"${form.full_name.trim()}" investor sifatida qo'shildi`);
      await onSaved();
      onClose();
    } catch (e) {
      showError(errorMessage(e, "Investorni saqlab bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }

  const idx = TAB_ORDER.indexOf(tab);
  const amount = Number(form.investment_amount);

  return (
    <Modal
      open={open}
      size="lg"
      title="Yangi investor"
      description="Platformaga kapital kiritgan hamkor — profil, summa va ulush"
      onClose={onClose}
      footer={
        <>
          <div className="flex gap-2 sm:mr-auto">
            <SecondaryButton
              icon="arrow_back"
              disabled={idx === 0}
              onClick={() => setTab(TAB_ORDER[Math.max(0, idx - 1)])}
              className="flex-1 justify-center sm:flex-none"
            >
              Orqaga
            </SecondaryButton>
            <SecondaryButton
              disabled={idx === TAB_ORDER.length - 1}
              onClick={() => setTab(TAB_ORDER[Math.min(TAB_ORDER.length - 1, idx + 1)])}
              className="flex-1 justify-center sm:flex-none"
            >
              Oldinga
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </SecondaryButton>
          </div>
          <SecondaryButton onClick={onClose} className="justify-center">
            Bekor qilish
          </SecondaryButton>
          <PrimaryButton icon="handshake" disabled={busy} onClick={() => void save()} className="justify-center">
            {busy ? "Saqlanmoqda..." : "Investorni qo'shish"}
          </PrimaryButton>
        </>
      }
    >
      <TabBar
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "asosiy", label: "Asosiy", icon: "person", count: errorCount("asosiy") },
          { id: "investitsiya", label: "Investitsiya", icon: "payments", count: errorCount("investitsiya") },
          { id: "izoh", label: "Izoh", icon: "notes" },
        ]}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {tab === "asosiy" ? (
          <FormSection icon="person" title="Investor ma'lumotlari" description="Jismoniy shaxs yoki kompaniya vakili">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="F.I.Sh." required hint={<FieldError message={errors.full_name} />}>
                <input
                  autoFocus
                  className={inputClass + errorRing(errors.full_name)}
                  placeholder="Masalan: Jasur Karimov"
                  value={form.full_name}
                  onChange={(e) => setForm({ full_name: e.target.value })}
                />
              </Field>
              <Field label="Kompaniya" hint="Bo'sh bo'lsa — shaxsiy investor">
                <input
                  className={inputClass}
                  placeholder="Masalan: Green Capital MChJ"
                  value={form.company_name}
                  onChange={(e) => setForm({ company_name: e.target.value })}
                />
              </Field>
              <Field label="Telefon" hint={<FieldError message={errors.phone} />}>
                <input
                  type="tel"
                  inputMode="tel"
                  className={inputClass + errorRing(errors.phone)}
                  placeholder="+998 90 123 45 67"
                  value={form.phone}
                  onChange={(e) => setForm({ phone: e.target.value })}
                />
              </Field>
              <Field label="Email" hint={<FieldError message={errors.email} />}>
                <input
                  type="email"
                  className={inputClass + errorRing(errors.email)}
                  placeholder="investor@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ email: e.target.value })}
                />
              </Field>
              <Field label="Manzil" className="sm:col-span-2">
                <input
                  className={inputClass}
                  placeholder="Shahar, tuman, ko'cha"
                  value={form.address}
                  onChange={(e) => setForm({ address: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>
        ) : null}

        {tab === "investitsiya" ? (
          <div className="space-y-4">
            <FormSection icon="payments" title="Kapital va ulush">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Investitsiya summasi" required hint={<FieldError message={errors.investment_amount} />}>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      className={`${inputClass} min-w-0 flex-1${errorRing(errors.investment_amount)}`}
                      placeholder="0"
                      value={form.investment_amount}
                      onChange={(e) => setForm({ investment_amount: e.target.value })}
                    />
                    <select
                      aria-label="Valyuta"
                      className={`${inputClass} w-24 shrink-0`}
                      value={form.currency}
                      onChange={(e) => setForm({ currency: e.target.value as FormState["currency"] })}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Ulush (%)" hint={errors.share_percent ? <FieldError message={errors.share_percent} /> : "0–100% oralig'ida"}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    className={inputClass + errorRing(errors.share_percent)}
                    placeholder="0"
                    value={form.share_percent}
                    onChange={(e) => setForm({ share_percent: e.target.value })}
                  />
                </Field>
                <Field label="Kelishuv holati" className="sm:col-span-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["active", "Faol", "Kelishuv imzolangan", "check_circle"],
                        ["pending", "Kutilmoqda", "Hujjatlar rasmiylashtirilmoqda", "hourglass_top"],
                      ] as const
                    ).map(([id, label, desc, icon]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={form.status === id}
                        onClick={() => setForm({ status: id })}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                          form.status === id ? "border-primary/40 bg-primary/10" : "border-[#26352c] bg-[#0d100f] hover:border-[#384f40]"
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[20px] ${form.status === id ? "text-primary" : "text-on-surface-variant"}`}>
                          {icon}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-on-surface">{label}</span>
                          <span className="block text-xs text-on-surface-variant">{desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </FormSection>
            {Number.isFinite(amount) && amount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm">
                <span className="text-on-surface-variant">Kiritilayotgan kapital</span>
                <span className="text-lg font-bold text-primary">
                  {formatMoney(amount, form.currency)}
                  {form.share_percent ? <span className="ml-2 text-sm font-semibold text-on-surface">· {form.share_percent}%</span> : null}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "izoh" ? (
          <Field label="Izoh / kelishuv shartlari">
            <textarea
              rows={6}
              className={inputClass}
              placeholder="Kelishuv raqami, to'lov jadvali, maxsus shartlar..."
              value={form.notes}
              onChange={(e) => setForm({ notes: e.target.value })}
            />
          </Field>
        ) : null}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
