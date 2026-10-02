import type {
  OrderEscrow,
  PartnerFirm,
  PaymentStatus,
  OrderStatus,
  TicketStatus,
  BannerStatus,
  PointKind,
  CareStatus,
  CareVisitStatus,
  CareClientType,
  CareFrequency,
  EmploymentStatus,
  ModerationStatus,
  WorkStage,
} from "./api/types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Yangi",
  in_review: "Kelishilmoqda",
  contacted: "Bog'lanildi",
  completed: "Bajarildi",
  cancelled: "Bekor qilindi",
};

export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "success" | "warning" | "error" | "neutral" | "info"
> = {
  new: "warning",
  in_review: "info",
  contacted: "info",
  completed: "success",
  cancelled: "error",
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["new", "in_review", "contacted"];

export const NEXT_ORDER_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ["in_review", "cancelled"],
  in_review: ["contacted", "cancelled"],
  contacted: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const NEXT_STATUS_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: string }>> = {
  new: { to: "in_review", label: "Qabul qilish", icon: "task_alt" },
  in_review: { to: "contacted", label: "Mijoz bilan bog'lanildi", icon: "call" },
  contacted: { to: "completed", label: "Ish yakunlandi", icon: "verified" },
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  not_required: "Talab qilinmaydi",
  unpaid: "To'lanmagan",
  checking: "Tekshirilmoqda",
  rejected: "Rad etilgan",
  paid: "Tizim hisobida",
  released: "Firmaga o'tkazilgan",
  refunded: "Mijozga qaytarilgan",
};

export const PAYMENT_TONE: Record<PaymentStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  not_required: "neutral",
  unpaid: "warning",
  checking: "info",
  rejected: "error",
  paid: "success",
  released: "success",
  refunded: "neutral",
};

export const ESCROW_LABEL: Record<OrderEscrow["status"], string> = {
  awaiting_payment: "To'lov kutilmoqda",
  held: "Tizim hisobida ushlab turilgan",
  released: "Firmaga o'tkazilgan",
  refunded: "Mijozga qaytarilgan",
  disputed: "Nizoli",
  frozen: "Muzlatilgan",
};

export const FIRM_STATUS_LABEL: Record<PartnerFirm["status"], string> = {
  active: "Faol",
  pending: "Tekshiruvda",
  suspended: "Bloklangan",
  ended: "Kelishuv tugagan",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Ochiq",
  in_progress: "Jarayonda",
  resolved: "Yechilgan",
  closed: "Yopilgan",
};

export const BANNER_STATUS_LABEL: Record<BannerStatus, string> = {
  draft: "Qoralama",
  scheduled: "Rejalashtirilgan",
  active: "Faol",
  archived: "Arxiv",
};

export const POINT_KIND_LABEL: Record<PointKind, string> = {
  earn: "Hisobga olindi",
  redeem: "Almashtirildi",
  expire: "Muddati o'tdi",
  adjust: "Tuzatish",
};

export const SPECIALTY_LABEL: Record<string, string> = {
  general: "Umumiy",
  landscape: "Landshaft",
  garden_care: "Bog' parvarishi",
  ornamental: "Manzarali o'simliklar",
  irrigation: "Sug'orish",
  pest_control: "Dorilash",
};

export const ROLE_LABEL: Record<string, string> = {
  customer: "Mijoz",
  worker: "Xodim",
  admin: "Firma admini",
  superadmin: "Superadmin",
};

export const CARE_STATUS_LABEL: Record<CareStatus, string> = {
  draft: "Qoralama",
  pending: "Tizim tasdig'ida",
  active: "Faol",
  paused: "To'xtatilgan",
  completed: "Tugagan",
  cancelled: "Bekor qilingan",
  rejected: "Rad etilgan",
};

export const CARE_STATUS_TONE: Record<CareStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral",
  pending: "warning",
  active: "success",
  paused: "info",
  completed: "neutral",
  cancelled: "error",
  rejected: "error",
};

export const CARE_CLIENT_TYPE_LABEL: Record<CareClientType, string> = {
  household: "Uy xo'jaligi",
  organization: "Tashkilot / markaz",
};

export const CARE_FREQUENCY_LABEL: Record<CareFrequency, string> = {
  weekly: "Haftalik",
  biweekly: "2 haftada bir",
  monthly: "Oylik",
};

export const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

export const WORK_STAGES: { key: WorkStage; label: string; icon: string; action: string }[] = [
  { key: "accepted", label: "Qabul qilindi", icon: "task_alt", action: "Ishchi guruh qabul qildi" },
  { key: "on_the_way", label: "Yo'lda", icon: "local_shipping", action: "Yo'lga chiqdi" },
  { key: "arrived", label: "Yetib keldi", icon: "where_to_vote", action: "Yetib keldi" },
  { key: "working", label: "Ishlayapti", icon: "construction", action: "Ish boshlandi" },
  { key: "finished", label: "Tugatdi", icon: "verified", action: "Ishni tugatdi" },
];

export const WORK_STAGE_LABEL: Record<WorkStage, string> = Object.fromEntries(
  WORK_STAGES.map((s) => [s.key, s.label]),
) as Record<WorkStage, string>;

export function nextWorkStage(current: WorkStage | "" | null | undefined) {
  const index = current ? WORK_STAGES.findIndex((s) => s.key === current) : -1;
  return WORK_STAGES[index + 1] ?? null;
}

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  pending: "Tekshiruvda",
  approved: "Ilovada",
  rejected: "Rad etilgan",
};

export const MODERATION_TONE: Record<ModerationStatus, "success" | "warning" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export const EMPLOYMENT_LABEL: Record<EmploymentStatus, string> = {
  active: "Ishda",
  on_leave: "Ta'tilda",
  dismissed: "Ishdan bo'shagan",
};

export const EMPLOYMENT_TONE: Record<EmploymentStatus, "success" | "info" | "error"> = {
  active: "success",
  on_leave: "info",
  dismissed: "error",
};

export const CARE_VISIT_STATUS_LABEL: Record<CareVisitStatus, string> = {
  scheduled: "Rejalashtirilgan",
  reminded: "Eslatma yuborildi",
  approved: "Tasdiqlangan",
  postponed: "Kechiktirilgan",
  done: "Bajarildi",
  not_done: "Bajarilmadi",
  rejected: "Rad etilgan",
  awaiting_report: "Hisobot kutilmoqda",
};
