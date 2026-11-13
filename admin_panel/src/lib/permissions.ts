import { api, ApiError } from "@/lib/api/client";
import { getPageRoot } from "@/lib/nav";

export type AdminCapabilityKey = "can_manage_staff" | "can_manage_orders" | "can_view_analytics";

export type AdminCapabilityState = {
  profileActive: boolean;
  can_manage_staff: boolean;
  can_manage_orders: boolean;
  can_view_analytics: boolean;
};

const EMPTY_CAPABILITIES: AdminCapabilityState = {
  profileActive: false,
  can_manage_staff: false,
  can_manage_orders: false,
  can_view_analytics: false,
};

/** Nav yo‘li → kerakli capability (null = faqat faol admin profil). */
const ROUTE_CAPABILITY: Record<string, AdminCapabilityKey | null> = {
  "/": "can_view_analytics",
  "/buyurtmalar": "can_manage_orders",
  "/xizmatlar": "can_manage_orders",
  "/xodimlar": "can_manage_staff",
  "/mijozlar": "can_manage_orders",
  "/parvarish": "can_manage_orders",
  "/moliya": null,
  "/xarita": "can_view_analytics",
  "/aloqa": "can_manage_orders",
  "/hisobotlar": "can_view_analytics",
  "/firma": null,
  "/sozlamalar": null,
};

export function capabilityForPath(pathname: string): AdminCapabilityKey | null {
  const root = getPageRoot(pathname);
  return ROUTE_CAPABILITY[root] ?? null;
}

export function hasRouteAccess(
  pathname: string,
  caps: AdminCapabilityState,
): boolean {
  if (!caps.profileActive) return false;
  const need = capabilityForPath(pathname);
  if (!need) return true;
  return caps[need];
}

async function probeAllowed(path: string, query?: Record<string, string | number>) {
  try {
    await api(path, { query });
    return true;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return false;
    throw err;
  }
}

/** Backend `RequiresAdminCapability` bilan mos — bir martalik yengil probe. */
export async function loadAdminCapabilities(): Promise<AdminCapabilityState> {
  const profileActive = await probeAllowed("/admin/firms/me/");
  if (!profileActive) return { ...EMPTY_CAPABILITIES };

  const [can_manage_orders, can_manage_staff, can_view_analytics] = await Promise.all([
    probeAllowed("/admin/orders/", { page_size: 1 }),
    probeAllowed("/admin/employees/", { page_size: 1 }),
    probeAllowed("/admin/dashboard/", { period: "month" }),
  ]);

  return {
    profileActive: true,
    can_manage_orders,
    can_manage_staff,
    can_view_analytics,
  };
}

export const CAPABILITY_I18N: Record<AdminCapabilityKey, string> = {
  can_manage_staff: "access.capabilityStaff",
  can_manage_orders: "access.capabilityOrders",
  can_view_analytics: "access.capabilityAnalytics",
};
