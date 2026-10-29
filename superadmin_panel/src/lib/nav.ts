export type NavItem = {
  href: string;
  icon: string;
  labelKey: string;
  titleKey: string;
};

export const navItems: NavItem[] = [
  { href: "/", icon: "dashboard", labelKey: "nav.home", titleKey: "nav.homeTitle" },
  { href: "/hisobotlar", icon: "assessment", labelKey: "nav.reports", titleKey: "nav.reportsTitle" },
  { href: "/firmalar", icon: "storefront", labelKey: "nav.firms", titleKey: "nav.firmsTitle" },
  { href: "/foydalanuvchilar", icon: "group", labelKey: "nav.users", titleKey: "nav.usersTitle" },
  { href: "/investorlar", icon: "handshake", labelKey: "nav.investors", titleKey: "nav.investorsTitle" },
  { href: "/xodimlar", icon: "badge", labelKey: "nav.staff", titleKey: "nav.staffTitle" },
  { href: "/xizmatlar", icon: "nature_people", labelKey: "nav.services", titleKey: "nav.servicesTitle" },
  { href: "/buyurtmalar", icon: "shopping_cart", labelKey: "nav.orders", titleKey: "nav.ordersTitle" },
  { href: "/parvarish", icon: "verified", labelKey: "nav.care", titleKey: "nav.careTitle" },
  { href: "/bannerlar", icon: "ad_units", labelKey: "nav.banners", titleKey: "nav.bannersTitle" },
  { href: "/aloqa", icon: "mail", labelKey: "nav.contact", titleKey: "nav.contactTitle" },
  { href: "/ball-tizimi", icon: "military_tech", labelKey: "nav.loyalty", titleKey: "nav.loyaltyTitle" },
  { href: "/xarita", icon: "map", labelKey: "nav.map", titleKey: "nav.mapTitle" },
  { href: "/administratorlar", icon: "admin_panel_settings", labelKey: "nav.admins", titleKey: "nav.adminsTitle" },
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

/** Page root for nature atmosphere (longest matching nav href). */
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
  "/hisobotlar": "dry",
  "/firmalar": "wind",
  "/foydalanuvchilar": "wind",
  "/investorlar": "dry",
  "/xodimlar": "sunny",
  "/xizmatlar": "rain",
  "/buyurtmalar": "sunny",
  "/parvarish": "dew",
  "/bannerlar": "sunny",
  "/aloqa": "wind",
  "/ball-tizimi": "dry",
  "/xarita": "wind",
  "/administratorlar": "forest",
  "/sozlamalar": "snow",
};

export function getPageWeather(pathname: string): WeatherMood {
  return PAGE_WEATHER[getPageRoot(pathname)] ?? "sunny";
}

export function getWeatherLabelKey(mood: WeatherMood): string {
  return `weather.${mood}`;
}
