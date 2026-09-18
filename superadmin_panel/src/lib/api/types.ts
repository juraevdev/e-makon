export type UserRole = "customer" | "worker" | "admin" | "superadmin";

export type OrderStatus = "new" | "in_review" | "contacted" | "completed" | "cancelled";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high";

export type BannerStatus = "draft" | "scheduled" | "active" | "archived";
export type PointKind = "earn" | "redeem" | "expire" | "adjust";

export type User = {
  id: number;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  birth_date: string | null;
  home_address: string;
  country: string;
  region: string;
  district: string;
  street: string;
  formatted_address: string;
  location_lat: string | number | null;
  location_lng: string | number | null;
  additional_phones: string[];
  telegram_username: string;
  loyalty_points: number;
  is_active: boolean;
  date_joined: string;
  orders_count?: number;
  last_order_at?: string | null;
};

export type ServiceFeature = { icon: string; label: string };

export type Service = {
  id: number;
  name: string;
  slug: string;
  emoji: string;
  icon: string;
  category: string;
  short_description: string;
  description: string;
  long_description: string;
  detail_description: string;
  cover_image: string | null;
  hero_image_url: string;
  gallery_images: string[];
  price_label: string;
  duration: string;
  features: ServiceFeature[];
  sort_order: number;
  is_active: boolean;
  price_from: string | null;
  currency: string;
};

export type OrderMedia = {
  id: number;
  kind: "photo" | "video";
  file: string;
  sort_order: number;
  created_at: string;
};

export type OrderHistory = {
  id: number;
  from_status: string;
  to_status: string;
  note: string;
  created_at: string;
};

export type OrderEscrow = {
  id: number;
  order_id: number;
  status: "awaiting_payment" | "held" | "released" | "refunded" | "disputed" | "frozen";
  status_label: string;
  amount: string;
  currency: string;
  commission_rate: string;
  platform_fee: string;
  firm_payout: string;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  disputed_at: string | null;
  note: string;
  dispute_reason: string;
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  id: number;
  entry_type: string;
  entry_type_label: string;
  amount: string;
  currency: string;
  debit_account: string;
  debit_label: string;
  credit_account: string;
  credit_label: string;
  order: number | null;
  firm: number | null;
  user: number | null;
  escrow: number | null;
  note: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type FirmLedgerSummary = {
  held_in_escrow: string;
  paid_to_firm: string;
  platform_fees: string;
  refunded: string;
  debt: string;
  ledger: LedgerEntry[];
  escrows: OrderEscrow[];
};

export type Order = {
  id: number;
  service: Service;
  service_id: number;
  service_name: string;
  service_icon: string;
  status: OrderStatus;
  progress: number;
  area_size: string;
  plant_category: string;
  address: string;
  notes: string;
  phone_number: string;
  customer_id: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_name: string;
  customer_phone: string;
  agreed_duration: string;
  quoted_price: string | null;
  currency: string;
  assigned_worker_id: number | null;
  assigned_worker_name: string;
  firm_id: number | null;
  firm_name: string;
  platform_share: string | null;
  commission_rate_applied: string | null;
  escrow: OrderEscrow | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  media: OrderMedia[];
  status_history: OrderHistory[];
  created_at: string;
  updated_at: string;
};

export type Employee = {
  id: number;
  user: User;
  specialty: string;
  rating: string;
  is_active: boolean;
  notes: string;
  created_at: string;
};

export type AdminProfile = {
  id: number;
  user: User;
  title: string;
  can_manage_staff: boolean;
  can_manage_orders: boolean;
  can_view_analytics: boolean;
  is_active: boolean;
  created_at: string;
};

export type SupportMessage = {
  id: number;
  sender: number;
  sender_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type SupportTicket = {
  id: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  order: number | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  assigned_to: number | null;
  assigned_to_name: string;
  messages: SupportMessage[];
  created_at: string;
  updated_at: string;
};

export type Banner = {
  id: number;
  title: string;
  description: string;
  image_url: string;
  image: string | null;
  image_src: string;
  status: BannerStatus;
  placement: "home" | "promo";
  link_service: number | null;
  service_name: string | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LoyaltySettings = {
  uzs_per_point: number;
  min_redeem_points: number;
  expire_months: number;
};

export type LoyaltyReward = {
  id: number;
  name: string;
  icon: string;
  points_cost: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type PointTransaction = {
  id: number;
  user: number;
  user_name: string;
  user_phone: string;
  kind: PointKind;
  points: number;
  order: number | null;
  order_id: number | null;
  note: string;
  created_at: string;
};

export type DashboardData = {
  period: string;
  period_days: number;
  date_from: string;
  date_to: string;
  total_customers: number;
  active_customers: number;
  firms_total: number;
  firms_active: number;
  firms_ended: number;
  investors_total: number;
  investors_active: number;
  active_orders: number;
  today_orders: number;
  revenue_done: string;
  revenue_period: string;
  platform_share_total: string;
  avg_check: string;
  orders_in_period: number;
  orders_change_pct: number | null;
  completed_orders: number;
  orders_by_status: { status: string; count: number }[];
  orders_series: { day: string | null; label: string; count: number; revenue: string }[];
  orders_by_day: { day: string | null; label?: string; count: number; revenue?: string }[];
  top_services: ServiceUsage[];
  least_services: ServiceUsage[];
  firm_revenues: FirmRevenueRow[];
  recent_orders: {
    id: number;
    service: string;
    service_icon: string;
    customer: string;
    customer_phone?: string;
    firm_id: number | null;
    firm: string;
    status: OrderStatus;
    quoted_price: string | null;
    platform_share: string | null;
    created_at: string;
  }[];
  new_firms: {
    id: number;
    name: string;
    phone: string;
    region: string;
    specialty: string;
    status: string;
    commission_rate: string;
    address: string;
    created_at: string;
  }[];
  ended_firms: {
    id: number;
    name: string;
    phone: string;
    status: string;
    exit_reason: string;
    ended_at: string | null;
    created_at: string;
  }[];
  recent_investors: {
    id: number;
    full_name: string;
    company_name: string;
    phone: string;
    investment_amount: string;
    share_percent: string;
    status: string;
    created_at: string;
  }[];
  catalog_size: number;
  catalog_active: number;
};

export type ServiceUsage = {
  id: number;
  name: string;
  icon: string;
  image: string;
  category: string;
  orders: number;
  revenue: string;
  firms: { id: number; name: string; orders: number }[];
};

export type FirmRevenueRow = {
  id: number;
  name: string;
  status: string;
  orders: number;
  revenue: string;
  commission_rate: string;
  suggested_rate: string;
  platform_share: string;
};

export type PartnerFirm = {
  id: number;
  name: string;
  legal_name: string;
  phone: string;
  email: string;
  address: string;
  region: string;
  district: string;
  specialty: string;
  specialty_label: string;
  description: string;
  rating: string;
  ratings_count: number;
  commission_rate: string;
  suggested_rate: string;
  subscription_plan: "none" | "monthly" | "yearly";
  subscription_units: number;
  subscription_fee_usd: string;
  subscription_yearly_if_monthly_usd: string;
  debt_amount: string;
  debt_currency: string;
  warnings_count: number;
  sales_banned_until: string | null;
  is_sales_banned: boolean;
  unpaid_fines: string;
  status: "active" | "pending" | "suspended" | "ended";
  exit_reason: string;
  ended_at: string | null;
  trial_ends_at: string | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  owner: number | null;
  is_active: boolean;
  orders_count?: number;
  revenue: string;
  platform_share: string;
  created_at: string;
  updated_at: string;
};

export type FirmReview = {
  id: number;
  firm: number;
  order: number | null;
  customer: number;
  customer_name: string;
  customer_phone: string;
  score: number;
  comment: string;
  created_at: string;
};

export type FirmMessage = {
  id: number;
  firm: number;
  sender: number | null;
  sender_name: string;
  kind: "message" | "warning" | "report";
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type FirmFine = {
  id: number;
  firm: number;
  amount: string;
  currency: string;
  reason: string;
  created_by: number | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
};

export type FirmModerationLog = {
  id: number;
  firm: number;
  action: string;
  action_label: string;
  note: string;
  meta: Record<string, unknown>;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
};

export type FirmStats = {
  firm: PartnerFirm;
  revenue: string;
  platform_share: string;
  debt_total: string;
  unpaid_fines: string;
  subscription_fee_usd: string;
  suggested_rate: string;
  orders_total: number;
  orders_completed: number;
  prev_id: number | null;
  next_id: number | null;
  by_service: { id: number; name: string; icon: string; orders: number; revenue: string }[];
  recent_orders: Order[];
  reviews: FirmReview[];
  messages: FirmMessage[];
  fines: FirmFine[];
  moderation_logs: FirmModerationLog[];
};

export type Investor = {
  id: number;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  investment_amount: string;
  currency: string;
  share_percent: string;
  status: "active" | "pending" | "ended";
  notes: string;
  exit_reason: string;
  ended_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MapPayload = {
  firms?: {
    id: number;
    name: string;
    phone: string;
    specialty: string;
    rating: string;
    status: string;
    is_active: boolean;
    lat: number | null;
    lng: number | null;
    address: string;
  }[];
  workers: {
    id: number;
    user_id?: number;
    name: string;
    phone: string;
    specialty: string;
    rating: string;
    is_active: boolean;
    lat: number | null;
    lng: number | null;
    address: string;
  }[];
  orders: {
    id: number;
    status: OrderStatus;
    service: string;
    customer: string;
    firm?: string;
    address: string;
    lat: number | null;
    lng: number | null;
    assigned_worker: string;
  }[];
  workers_active: number;
  orders_active: number;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
