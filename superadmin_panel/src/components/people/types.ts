import type { AdminProfile, Employee, PartnerFirm, User } from "@/lib/api/types";

/** Backend `UserSerializer` qaytaradigan, lekin umumiy `User` turida yo'q maydonlar. */
export type UserWithOrg = User & {
  organization_id?: number | null;
  first_order_at?: string | null;
  total_spent?: number | null;
};

export type EmploymentStatus = "active" | "on_leave" | "dismissed";

export type EmployeeFull = Omit<Employee, "user"> & {
  user: UserWithOrg;
  specialty_label?: string;
  employment_status?: EmploymentStatus;
  employment_status_label?: string;
  position?: string;
  hired_at?: string | null;
  dismissed_at?: string | null;
  dismissal_reason?: string;
  birth_date?: string | null;
  address?: string;
  emergency_phone?: string;
  skills?: string[];
  active_orders?: number;
  completed_orders?: number;
};

export type AdminProfileFull = Omit<AdminProfile, "user"> & {
  user: UserWithOrg;
  organization_id?: number | null;
};

export type FirmOption = Pick<PartnerFirm, "id" | "name" | "status" | "region">;
