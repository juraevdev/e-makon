export type NavCapability = "can_manage_orders" | "can_manage_staff" | "can_view_analytics";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  title: string;
  /** Yo'q = barcha faol adminlar ko'radi */
  capability?: NavCapability;
};

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Bosh sahifa",
    icon: "dashboard",
    title: "Firma ko'rsatkichlari",
    capability: "can_view_analytics",
  },
  {
    href: "/buyurtmalar",
    label: "Buyurtmalar",
    icon: "shopping_cart",
    title: "Buyurtmalar",
    capability: "can_manage_orders",
  },
  {
    href: "/xizmatlar",
    label: "Xizmatlar",
    icon: "nature_people",
    title: "Firma xizmatlari",
    capability: "can_manage_orders",
  },
  {
    href: "/xodimlar",
    label: "Xodimlar",
    icon: "badge",
    title: "Firma xodimlari",
    capability: "can_manage_staff",
  },
  {
    href: "/mijozlar",
    label: "Mijozlar",
    icon: "group",
    title: "Mijozlar",
    capability: "can_manage_orders",
  },
  {
    href: "/parvarish",
    label: "Parvarish",
    icon: "verified",
    title: "Parvarish shartnomalari",
    capability: "can_manage_orders",
  },
  {
    href: "/moliya",
    label: "Moliya",
    icon: "account_balance_wallet",
    title: "Moliya va hisob-kitob",
    capability: "can_view_analytics",
  },
  {
    href: "/xarita",
    label: "Xarita",
    icon: "map",
    title: "Jonli xarita",
    capability: "can_view_analytics",
  },
  {
    href: "/aloqa",
    label: "Murojaatlar",
    icon: "support_agent",
    title: "Mijoz murojaatlari",
    capability: "can_manage_orders",
  },
  {
    href: "/hisobotlar",
    label: "Hisobotlar",
    icon: "assessment",
    title: "Hisobotlar",
    capability: "can_view_analytics",
  },
  {
    href: "/firma",
    label: "Firma profili",
    icon: "storefront",
    title: "Firma profili",
  },
  {
    href: "/sozlamalar",
    label: "Sozlamalar",
    icon: "settings",
    title: "Sozlamalar",
  },
];

export function canAccessNav(
  item: NavItem,
  caps: Partial<Record<NavCapability, boolean | null | undefined>> | null | undefined,
): boolean {
  if (!item.capability) return true;
  // Bayroq kelmagan eski sessiyada ochiq qoldiramiz (backend baribir tekshiradi).
  if (!caps || caps[item.capability] == null) return true;
  return Boolean(caps[item.capability]);
}

export function getNavTitle(pathname: string): string {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.title;
  const match = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.title ?? "E-MAKON";
}
