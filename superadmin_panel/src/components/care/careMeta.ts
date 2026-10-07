import type { CareContract, CareStatus, CareVisit, CareVisitStatus } from "@/lib/api/types";

export type CareAction = "approve" | "reject" | "submit" | "pause" | "resume" | "complete" | "cancel";

export type CareActionConfig = {
  id: CareAction;
  label: string;
  icon: string;
  /** Sabab majburiy — backend bo'sh `note` ni rad etadi. */
  noteRequired: boolean;
  noteLabel: string;
  confirmText: string;
  description: string;
  variant: "primary" | "danger" | "warning";
};

export const CARE_ACTIONS: Record<CareAction, CareActionConfig> = {
  approve: {
    id: "approve",
    label: "Tasdiqlash",
    icon: "verified",
    noteRequired: false,
    noteLabel: "Firmaga izoh (ixtiyoriy)",
    confirmText: "Tasdiqlash",
    description: "Shartnoma faollashadi, tashriflar jadvali avtomatik tuziladi va mijozga xabar yuboriladi.",
    variant: "primary",
  },
  reject: {
    id: "reject",
    label: "Rad etish",
    icon: "block",
    noteRequired: true,
    noteLabel: "Rad etish sababi (firmaga yuboriladi)",
    confirmText: "Rad etish",
    description: "Firma sababni ko'radi, shartnomani tuzatib qayta yuborishi mumkin.",
    variant: "danger",
  },
  submit: {
    id: "submit",
    label: "Tasdiqqa qaytarish",
    icon: "undo",
    noteRequired: false,
    noteLabel: "Izoh (ixtiyoriy)",
    confirmText: "Tasdiqqa qaytarish",
    description: "Shartnoma qayta \"Tasdiq kutmoqda\" holatiga o'tadi, rad sababi tozalanadi.",
    variant: "primary",
  },
  pause: {
    id: "pause",
    label: "To'xtatish",
    icon: "pause_circle",
    noteRequired: false,
    noteLabel: "To'xtatish sababi (ixtiyoriy)",
    confirmText: "To'xtatish",
    description: "Kelgusi rejalashtirilgan tashriflar \"Kechiktirilgan\" holatiga o'tadi.",
    variant: "warning",
  },
  resume: {
    id: "resume",
    label: "Davom ettirish",
    icon: "play_circle",
    noteRequired: false,
    noteLabel: "Izoh (ixtiyoriy)",
    confirmText: "Davom ettirish",
    description: "Kechiktirilgan kelgusi tashriflar yana rejalashtiriladi.",
    variant: "primary",
  },
  complete: {
    id: "complete",
    label: "Yakunlash",
    icon: "task_alt",
    noteRequired: false,
    noteLabel: "Yakuniy izoh (ixtiyoriy)",
    confirmText: "Yakunlash",
    description: "Shartnoma \"Tugagan\" deb belgilanadi. Bu amalni qaytarib bo'lmaydi.",
    variant: "warning",
  },
  cancel: {
    id: "cancel",
    label: "Bekor qilish",
    icon: "cancel",
    noteRequired: true,
    noteLabel: "Bekor qilish sababi",
    confirmText: "Bekor qilish",
    description: "Kelgusi rejalashtirilgan tashriflar o'chiriladi. Bu amalni qaytarib bo'lmaydi.",
    variant: "danger",
  },
};

/** Backend `CareContractService` dagi holat o'tishlari bilan bir xil. */
export const ACTIONS_BY_STATUS: Record<CareStatus, CareAction[]> = {
  draft: ["submit", "cancel"],
  pending: ["approve", "reject", "cancel"],
  active: ["pause", "complete", "cancel"],
  paused: ["resume", "complete", "cancel"],
  rejected: ["submit", "cancel"],
  completed: [],
  cancelled: [],
};

export const STATUS_TABS: { id: "all" | CareStatus; label: string; icon: string }[] = [
  { id: "all", label: "Barchasi", icon: "list" },
  { id: "pending", label: "Tasdiq kutmoqda", icon: "hourglass_top" },
  { id: "active", label: "Faol", icon: "verified" },
  { id: "paused", label: "To'xtatilgan", icon: "pause_circle" },
  { id: "rejected", label: "Rad etilgan", icon: "block" },
  { id: "completed", label: "Tugagan", icon: "task_alt" },
  { id: "cancelled", label: "Bekor", icon: "cancel" },
  { id: "draft", label: "Qoralama", icon: "draft" },
];

export const EVENT_META: Record<string, { label: string; icon: string; tone: string }> = {
  create: { label: "Yaratildi", icon: "add_circle", tone: "text-sky-300" },
  update: { label: "Tahrirlandi", icon: "edit", tone: "text-sky-300" },
  submit: { label: "Tasdiqqa yuborildi", icon: "send", tone: "text-amber-300" },
  approve: { label: "Tasdiqlandi", icon: "verified", tone: "text-primary" },
  reject: { label: "Rad etildi", icon: "block", tone: "text-error" },
  pause: { label: "To'xtatildi", icon: "pause_circle", tone: "text-amber-300" },
  resume: { label: "Davom ettirildi", icon: "play_circle", tone: "text-primary" },
  complete: { label: "Yakunlandi", icon: "task_alt", tone: "text-primary" },
  cancel: { label: "Bekor qilindi", icon: "cancel", tone: "text-error" },
  comment: { label: "Izoh", icon: "chat", tone: "text-on-surface" },
};

export const PAYMENT_LABEL: Record<CareContract["payment_terms"], string> = {
  monthly: "Har oy",
  quarterly: "Har chorak",
  upfront: "Oldindan to'liq",
};

export const VISIT_TONE: Record<CareVisitStatus, { dot: string; text: string; bg: string }> = {
  scheduled: { dot: "bg-sky-400", text: "text-sky-300", bg: "bg-sky-500/10 border-sky-500/30" },
  reminded: { dot: "bg-sky-300", text: "text-sky-200", bg: "bg-sky-500/10 border-sky-500/30" },
  approved: { dot: "bg-teal-400", text: "text-teal-300", bg: "bg-teal-500/10 border-teal-500/30" },
  postponed: { dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/30" },
  done: { dot: "bg-primary", text: "text-primary", bg: "bg-primary/10 border-primary/30" },
  not_done: { dot: "bg-error", text: "text-error", bg: "bg-error/10 border-error/30" },
  rejected: { dot: "bg-error", text: "text-error", bg: "bg-error/10 border-error/30" },
  awaiting_report: { dot: "bg-violet-400", text: "text-violet-300", bg: "bg-violet-500/10 border-violet-500/30" },
};

const CLOSED_VISIT: CareVisitStatus[] = ["done", "not_done", "rejected"];

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isOpenVisit(v: CareVisit) {
  return !CLOSED_VISIT.includes(v.status);
}

export function nextVisit(contract: CareContract): CareVisit | null {
  const today = todayIso();
  return contract.visits.find((v) => v.visit_date >= today && isOpenVisit(v)) ?? null;
}

/** Sanasi o'tgan, lekin hali yopilmagan tashriflar. */
export function overdueVisits(contract: CareContract) {
  const today = todayIso();
  return contract.visits.filter((v) => v.visit_date < today && isOpenVisit(v));
}

export function contractSearchText(c: CareContract) {
  return [
    c.id,
    c.title,
    c.firm_name,
    c.customer_name,
    c.client_name,
    c.contact_person,
    c.customer_phone,
    c.phone_number,
    c.address,
    c.service_name,
  ]
    .join(" ")
    .toLowerCase();
}
