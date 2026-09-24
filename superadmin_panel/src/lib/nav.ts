export type NavItem = {
  href: string;
  label: string;
  icon: string;
  title: string;
};

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Bosh sahifa",
    icon: "dashboard",
    title: "Umumiy ko'rinish",
  },
  {
    href: "/hisobotlar",
    label: "Hisobotlar",
    icon: "assessment",
    title: "Hisobotlar",
  },
  {
    href: "/firmalar",
    label: "Firmalar",
    icon: "storefront",
    title: "Xizmat firmalari",
  },
  {
    href: "/foydalanuvchilar",
    label: "Foydalanuvchilar",
    icon: "group",
    title: "Foydalanuvchilar",
  },
  {
    href: "/investorlar",
    label: "Investorlar",
    icon: "handshake",
    title: "Investor hamkorlar",
  },
  {
    href: "/xodimlar",
    label: "Xodimlar",
    icon: "badge",
    title: "Firma xodimlari",
  },
  {
    href: "/xizmatlar",
    label: "Xizmatlar",
    icon: "nature_people",
    title: "Xizmatlar",
  },
  {
    href: "/buyurtmalar",
    label: "Buyurtmalar",
    icon: "shopping_cart",
    title: "Buyurtmalar",
  },
  {
    href: "/parvarish",
    label: "Parvarish",
    icon: "verified",
    title: "Parvarish shartnomalari",
  },
  {
    href: "/bannerlar",
    label: "Bannerlar",
    icon: "ad_units",
    title: "Bannerlar va aksiyalar",
  },
  {
    href: "/aloqa",
    label: "Aloqa",
    icon: "mail",
    title: "Aloqa markazi",
  },
  {
    href: "/ball-tizimi",
    label: "Ball tizimi",
    icon: "military_tech",
    title: "Ball tizimi",
  },
  {
    href: "/xarita",
    label: "Xarita",
    icon: "map",
    title: "Jonli xarita",
  },
  {
    href: "/administratorlar",
    label: "Administratorlar",
    icon: "admin_panel_settings",
    title: "Administratorlar",
  },
  {
    href: "/sozlamalar",
    label: "Sozlamalar",
    icon: "settings",
    title: "Sozlamalar",
  },
];

export function getNavTitle(pathname: string): string {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.title;
  const match = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.title ?? "E-MAKON";
}
