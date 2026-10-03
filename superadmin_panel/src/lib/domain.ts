import type {
  OrderStatus,
  TicketStatus,
  BannerStatus,
  PointKind,
  CareStatus,
  CareVisitStatus,
  CareClientType,
  CareFrequency,
  WorkStage,
  ModerationStatus,
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
  worker: "Hamkor",
  admin: "Admin",
  superadmin: "Superadmin",
};

export const CARE_STATUS_LABEL: Record<CareStatus, string> = {
  draft: "Qoralama",
  pending: "Tasdiq kutmoqda",
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

export const WORK_STAGES: { key: WorkStage; label: string; icon: string }[] = [
  { key: "accepted", label: "Qabul qilindi", icon: "task_alt" },
  { key: "on_the_way", label: "Yo'lda", icon: "local_shipping" },
  { key: "arrived", label: "Yetib keldi", icon: "where_to_vote" },
  { key: "working", label: "Ishlayapti", icon: "construction" },
  { key: "finished", label: "Tugatdi", icon: "verified" },
];

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  pending: "Tekshiruvda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

export const MODERATION_TONE: Record<ModerationStatus, "success" | "warning" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
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
