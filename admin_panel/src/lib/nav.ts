export type NavCapability = "can_manage_orders" | "can_manage_staff" | "can_view_analytics";

export type NavItem = {
  href: string;
  icon: string;
  labelKey: string;
  titleKey: string;
  /** Yo'q = barcha faol adminlar ko'radi */
  capability?: NavCapability;
};

export const navItems: NavItem[] = [
  { href: "/", icon: "dashboard", labelKey: "nav.home", titleKey: "nav.homeTitle", capability: "can_view_analytics" },
  { href: "/buyurtmalar", icon: "shopping_cart", labelKey: "nav.orders", titleKey: "nav.ordersTitle", capability: "can_manage_orders" },
  { href: "/xizmatlar", icon: "nature_people", labelKey: "nav.services", titleKey: "nav.servicesTitle", capability: "can_manage_orders" },
  { href: "/xodimlar", icon: "badge", labelKey: "nav.staff", titleKey: "nav.staffTitle", capability: "can_manage_staff" },
  { href: "/mijozlar", icon: "group", labelKey: "nav.clients", titleKey: "nav.clientsTitle", capability: "can_manage_orders" },
  { href: "/parvarish", icon: "verified", labelKey: "nav.care", titleKey: "nav.careTitle", capability: "can_manage_orders" },
  { href: "/moliya", icon: "account_balance_wallet", labelKey: "nav.finance", titleKey: "nav.financeTitle", capability: "can_view_analytics" },
  { href: "/xarita", icon: "map", labelKey: "nav.map", titleKey: "nav.mapTitle", capability: "can_view_analytics" },
  { href: "/aloqa", icon: "support_agent", labelKey: "nav.contact", titleKey: "nav.contactTitle", capability: "can_manage_orders" },
  { href: "/hisobotlar", icon: "assessment", labelKey: "nav.reports", titleKey: "nav.reportsTitle", capability: "can_view_analytics" },
  { href: "/firma", icon: "storefront", labelKey: "nav.firm", titleKey: "nav.firmTitle" },
  { href: "/sozlamalar", icon: "settings", labelKey: "nav.settings", titleKey: "nav.settingsTitle" },
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

export function getNavTitleKey(pathname: string): string {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.titleKey;
  const match = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.titleKey ?? "brand";
}

export function getPageRoot(pathname: string): string {
  if (pathname === "/") return "/";
  const match = navItems
    .filter((item) => item.href !== "/" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? "/";
}

/** Uzbekistan climate mood for page background art. */
export type WeatherMood =
  | "sunny"
  | "dry"
  | "wind"
  | "rain"
  | "snow"
  | "dew"
  | "forest";

const PAGE_WEATHER: Record<string, WeatherMood> = {
  "/": "sunny",
  "/buyurtmalar": "sunny",
  "/xizmatlar": "rain",
  "/xodimlar": "sunny",
  "/mijozlar": "wind",
  "/parvarish": "dew",
  "/moliya": "dry",
  "/xarita": "wind",
  "/aloqa": "wind",
  "/hisobotlar": "dry",
  "/firma": "forest",
  "/sozlamalar": "snow",
};

export function getPageWeather(pathname: string): WeatherMood {
  return PAGE_WEATHER[getPageRoot(pathname)] ?? "sunny";
}

export function getWeatherLabelKey(mood: WeatherMood): string {
  return `weather.${mood}`;
}
