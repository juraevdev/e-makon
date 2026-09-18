import type { OrderStatus, TicketStatus, BannerStatus, PointKind } from "./api/types";

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
