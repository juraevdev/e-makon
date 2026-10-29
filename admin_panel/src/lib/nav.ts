export type NavItem = {
  href: string;
  icon: string;
  labelKey: string;
  titleKey: string;
};

export const navItems: NavItem[] = [
  { href: "/", icon: "dashboard", labelKey: "nav.home", titleKey: "nav.homeTitle" },
  { href: "/buyurtmalar", icon: "shopping_cart", labelKey: "nav.orders", titleKey: "nav.ordersTitle" },
  { href: "/xizmatlar", icon: "nature_people", labelKey: "nav.services", titleKey: "nav.servicesTitle" },
  { href: "/xodimlar", icon: "badge", labelKey: "nav.staff", titleKey: "nav.staffTitle" },
  { href: "/mijozlar", icon: "group", labelKey: "nav.clients", titleKey: "nav.clientsTitle" },
  { href: "/parvarish", icon: "verified", labelKey: "nav.care", titleKey: "nav.careTitle" },
  { href: "/moliya", icon: "account_balance_wallet", labelKey: "nav.finance", titleKey: "nav.financeTitle" },
  { href: "/xarita", icon: "map", labelKey: "nav.map", titleKey: "nav.mapTitle" },
  { href: "/aloqa", icon: "support_agent", labelKey: "nav.contact", titleKey: "nav.contactTitle" },
  { href: "/hisobotlar", icon: "assessment", labelKey: "nav.reports", titleKey: "nav.reportsTitle" },
  { href: "/firma", icon: "storefront", labelKey: "nav.firm", titleKey: "nav.firmTitle" },
  { href: "/sozlamalar", icon: "settings", labelKey: "nav.settings", titleKey: "nav.settingsTitle" },
];

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
