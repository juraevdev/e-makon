"use client";

import { useState } from "react";
import { Field, inputClass, Modal, PrimaryButton, SecondaryButton, TabBar } from "@/components/ui";
import { api } from "@/lib/api/client";
import { SPECIALTY_LABEL } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "./api";
import {
  FieldError,
  FormSection,
  PasswordInput,
  StrengthMeter,
  errorRing,
  isValidUzPhone,
  normalizeUzPhone,
} from "./form";
import type { EmployeeFull } from "./types";

type TabId = "asosiy" | "shaxsiy" | "malaka";
const TAB_ORDER: TabId[] = ["asosiy", "shaxsiy", "malaka"];

type FormState = {
  full_name: string;
  phone: string;
  password: string;
  position: string;
  specialty: string;
  hired_at: string;
  birth_date: string;
  address: string;
  emergency_phone: string;
  skills: string[];
  notes: string;
};

type ErrorKey = "full_name" | "phone" | "password" | "position" | "emergency_phone" | "birth_date" | "hired_at";
type FormErrors = Partial<Record<ErrorKey, string>>;

const ERROR_TAB: Record<ErrorKey, TabId> = {
  full_name: "asosiy",
  phone: "asosiy",
  password: "asosiy",
  position: "asosiy",
  hired_at: "shaxsiy",
  birth_date: "shaxsiy",
  emergency_phone: "shaxsiy",
};

const POSITION_PRESETS = ["Bog'bon", "Brigadir", "Landshaft dizayneri", "Sug'orish ustasi", "Dorilovchi", "Haydovchi"];

function toForm(emp: EmployeeFull | null): FormState {
  return {
    full_name: emp?.user.full_name || "",
    phone: emp?.user.phone || "+998",
    password: "",
    position: emp?.position || "",
    specialty: emp?.specialty || "general",
    hired_at: emp?.hired_at || "",
    birth_date: emp?.birth_date || "",
    address: emp?.address || "",
    emergency_phone: emp?.emergency_phone || "",
    skills: emp?.skills ?? [],
    notes: emp?.notes || "",
  };
}

function validate(form: FormState, editing: boolean): FormErrors {
  const errors: FormErrors = {};
  const today = new Date().toISOString().slice(0, 10);
  if (form.full_name.trim().length < 2) errors.full_name = "To'liq ismni kiriting";
  if (!isValidUzPhone(form.phone)) errors.phone = "Telefon +998 XX XXX XX XX formatida bo'lsin";
  const pwd = form.password.trim();
  if (!editing && !pwd) errors.password = "Yangi xodim uchun parol majburiy";
  else if (pwd && pwd.length < 6) errors.password = "Kamida 6 ta belgi";
  if (form.position.length > 120) errors.position = "Lavozim 120 belgidan oshmasin";
  if (form.emergency_phone.trim() && !isValidUzPhone(form.emergency_phone)) errors.emergency_phone = "Telefon formati noto'g'ri";
  if (form.birth_date && form.birth_date > today) errors.birth_date = "Kelajakdagi sana bo'lishi mumkin emas";
  if (form.hired_at && form.hired_at > today) errors.hired_at = "Kelajakdagi sana bo'lishi mumkin emas";
  return errors;
}

/** Ochilganda `key` orqali qayta o'rnatiladi — ichki holat har safar yangidan boshlanadi. */
export function EmployeeFormModal({
  open,
  employee,
  firmName,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: EmployeeFull | null;
  firmName: (id: number | null | undefined) => string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { showSuccess, showError } = useToast();
  const editing = !!employee;
  const [tab, setTab] = useState<TabId>("asosiy");
  const [form, setFormState] = useState<FormState>(() => toForm(employee));
  const [errors, setErrors] = useState<FormErrors>({});
  const [skillDraft, setSkillDraft] = useState("");
  const [busy, setBusy] = useState(false);

  function setForm(patch: Partial<FormState>) {
    setFormState((f) => ({ ...f, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((k) => k in errors)) {
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) as FormErrors);
    }
  }

  function addSkill(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim().slice(0, 60))
      .filter(Boolean);
    if (!parts.length) return;
    setForm({ skills: [...new Set([...form.skills, ...parts])].slice(0, 20) });
    setSkillDraft("");
  }

  const errorCount = (id: TabId) => Object.keys(errors).filter((k) => ERROR_TAB[k as ErrorKey] === id).length || undefined;

  async function save() {
    const next = validate(form, editing);
    setErrors(next);
    const firstBad = (Object.keys(next) as ErrorKey[])[0];
    if (firstBad) {
      setTab(ERROR_TAB[firstBad]);
      showError("Formadagi xatolarni tuzating");
      return;
    }
    const pendingSkill = skillDraft.trim();
    const skills = pendingSkill ? [...new Set([...form.skills, pendingSkill.slice(0, 60)])] : form.skills;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        phone: normalizeUzPhone(form.phone),
        full_name: form.full_name.trim(),
        specialty: form.specialty,
        position: form.position.trim(),
        birth_date: form.birth_date || null,
        address: form.address.trim(),
        emergency_phone: form.emergency_phone.trim() ? normalizeUzPhone(form.emergency_phone) : "",
        skills,
        notes: form.notes.trim(),
      };
      if (form.hired_at) payload.hired_at = form.hired_at;
      else if (editing) payload.hired_at = null;
      if (form.password.trim()) payload.password = form.password.trim();

      if (employee) {
        await api(`/admin/employees/${employee.id}/`, { method: "PATCH", body: payload });
        showSuccess(`"${form.full_name.trim()}" ma'lumotlari yangilandi`);
      } else {
        await api("/admin/employees/", { method: "POST", body: payload });
        showSuccess(`"${form.full_name.trim()}" xodimlar ro'yxatiga qo'shildi`);
      }
      await onSaved();
      onClose();
    } catch (e) {
      showError(errorMessage(e, "Saqlashda xatolik yuz berdi"));
    } finally {
      setBusy(false);
    }
  }

  const idx = TAB_ORDER.indexOf(tab);

  return (
    <Modal
      open={open}
      size="lg"
      title={editing ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}
      description={
        employee
          ? `${employee.user.full_name || "Ism yo'q"} · ${formatPhone(employee.user.phone)}`
          : "Buyurtmalarni joyida bajaradigan mutaxassis profilini yarating"
      }
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
          <PrimaryButton icon={editing ? "save" : "person_add"} disabled={busy} onClick={() => void save()} className="justify-center">
            {busy ? "Saqlanmoqda..." : editing ? "Saqlash" : "Xodimni qo'shish"}
          </PrimaryButton>
        </>
      }
    >
      <TabBar
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "asosiy", label: "Asosiy", icon: "badge", count: errorCount("asosiy") },
          { id: "shaxsiy", label: "Shaxsiy", icon: "contact_page", count: errorCount("shaxsiy") },
          { id: "malaka", label: "Malaka", icon: "workspace_premium", count: form.skills.length || undefined },
        ]}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {tab === "asosiy" ? (
          <div className="space-y-4">
            <FormSection icon="person" title="Shaxs va kirish">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="To'liq ismi" required hint={<FieldError message={errors.full_name} />}>
                  <input
                    autoFocus
                    className={inputClass + errorRing(errors.full_name)}
                    placeholder="Masalan: Ali Valiyev"
                    value={form.full_name}
                    onChange={(e) => setForm({ full_name: e.target.value })}
                  />
                </Field>
                <Field label="Telefon raqami" required hint={<FieldError message={errors.phone} />}>
                  <input
                    type="tel"
                    inputMode="tel"
                    className={inputClass + errorRing(errors.phone)}
                    placeholder="+998 90 123 45 67"
                    value={form.phone}
                    onChange={(e) => setForm({ phone: e.target.value })}
                  />
                </Field>
                <Field
                  label={editing ? "Yangi parol" : "Parol"}
                  required={!editing}
                  className="sm:col-span-2"
                  hint={
                    errors.password ? (
                      <FieldError message={errors.password} />
                    ) : form.password ? (
                      <StrengthMeter value={form.password} />
                    ) : editing ? (
                      "O'zgartirmasangiz bo'sh qoldiring"
                    ) : (
                      "Xodim mobil ilovaga shu parol bilan kiradi"
                    )
                  }
                >
                  <PasswordInput value={form.password} onChange={(v) => setForm({ password: v })} invalid={!!errors.password} />
                </Field>
              </div>
            </FormSection>
            <FormSection icon="work" title="Ish joyi">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Mutaxassislik" required>
                  <select className={inputClass} value={form.specialty} onChange={(e) => setForm({ specialty: e.target.value })}>
                    {Object.entries(SPECIALTY_LABEL).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lavozim" hint={<FieldError message={errors.position} />}>
                  <input
                    list="employee-position-presets"
                    className={inputClass + errorRing(errors.position)}
                    placeholder="Masalan: Brigadir"
                    value={form.position}
                    onChange={(e) => setForm({ position: e.target.value })}
                  />
                  <datalist id="employee-position-presets">
                    {POSITION_PRESETS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </Field>
                <div className="sm:col-span-2">
                  <div className="flex items-start gap-3 rounded-xl border border-[#26352c] bg-[#0d100f] px-4 py-3">
                    <span className="material-symbols-outlined text-[20px] text-primary">storefront</span>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-on-surface">
                        Firma: {employee ? firmName(employee.user.organization_id) : "Standart tashkilot (E-Makon)"}
                      </p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {employee
                          ? "Xodimni boshqa firmaga o'tkazish hozircha qo'llab-quvvatlanmaydi."
                          : "Superadmin qo'shgan xodim standart tashkilotga biriktiriladi. Firmaga xos xodimni firma admini o'z panelidan qo'shadi."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>
        ) : null}

        {tab === "shaxsiy" ? (
          <FormSection icon="contact_page" title="Shaxsiy ma'lumotlar" description="Ixtiyoriy — kadrlar hisobi uchun">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tug'ilgan sana" hint={<FieldError message={errors.birth_date} />}>
                <input
                  type="date"
                  className={inputClass + errorRing(errors.birth_date)}
                  value={form.birth_date}
                  onChange={(e) => setForm({ birth_date: e.target.value })}
                />
              </Field>
              <Field
                label="Ishga olingan sana"
                hint={errors.hired_at ? <FieldError message={errors.hired_at} /> : editing ? undefined : "Bo'sh bo'lsa — bugungi sana"}
              >
                <input
                  type="date"
                  className={inputClass + errorRing(errors.hired_at)}
                  value={form.hired_at}
                  onChange={(e) => setForm({ hired_at: e.target.value })}
                />
              </Field>
              <Field label="Favqulodda aloqa telefoni" hint={<FieldError message={errors.emergency_phone} />}>
                <input
                  type="tel"
                  inputMode="tel"
                  className={inputClass + errorRing(errors.emergency_phone)}
                  placeholder="+998 ..."
                  value={form.emergency_phone}
                  onChange={(e) => setForm({ emergency_phone: e.target.value })}
                />
              </Field>
              <Field label="Yashash manzili" className="sm:col-span-2">
                <input
                  className={inputClass}
                  placeholder="Viloyat, tuman, ko'cha, uy"
                  value={form.address}
                  onChange={(e) => setForm({ address: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>
        ) : null}

        {tab === "malaka" ? (
          <div className="space-y-4">
            <FormSection icon="workspace_premium" title="Ko'nikmalar" description="Enter yoki vergul bilan qo'shing (20 tagacha)">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  placeholder="Masalan: Daraxt butash"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addSkill(skillDraft);
                    }
                  }}
                />
                <SecondaryButton icon="add" onClick={() => addSkill(skillDraft)} disabled={!skillDraft.trim()} className="justify-center">
                  Qo&apos;shish
                </SecondaryButton>
              </div>
              {form.skills.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-1 pr-1 pl-3 text-xs font-medium text-primary"
                    >
                      {s}
                      <button
                        type="button"
                        aria-label={`${s} ni o'chirish`}
                        onClick={() => setForm({ skills: form.skills.filter((x) => x !== s) })}
                        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/20"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-on-surface-variant">Hali ko&apos;nikma qo&apos;shilmagan</p>
              )}
            </FormSection>
            <Field label="Qo'shimcha izoh">
              <textarea
                rows={4}
                className={inputClass}
                placeholder="Malakasi, sertifikatlari, ish tajribasi haqida..."
                value={form.notes}
                onChange={(e) => setForm({ notes: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
