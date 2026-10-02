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
    title: "Firma ko'rsatkichlari",
  },
  {
    href: "/buyurtmalar",
    label: "Buyurtmalar",
    icon: "shopping_cart",
    title: "Buyurtmalar",
  },
  {
    href: "/xizmatlar",
    label: "Xizmatlar",
    icon: "nature_people",
    title: "Firma xizmatlari",
  },
  {
    href: "/xodimlar",
    label: "Xodimlar",
    icon: "badge",
    title: "Firma xodimlari",
  },
  {
    href: "/mijozlar",
    label: "Mijozlar",
    icon: "group",
    title: "Mijozlar",
  },
  {
    href: "/parvarish",
    label: "Parvarish",
    icon: "verified",
    title: "Parvarish shartnomalari",
  },
  {
    href: "/moliya",
    label: "Moliya",
    icon: "account_balance_wallet",
    title: "Moliya va hisob-kitob",
  },
  {
    href: "/xarita",
    label: "Xarita",
    icon: "map",
    title: "Jonli xarita",
  },
  {
    href: "/aloqa",
    label: "Murojaatlar",
    icon: "support_agent",
    title: "Mijoz murojaatlari",
  },
  {
    href: "/hisobotlar",
    label: "Hisobotlar",
    icon: "assessment",
    title: "Hisobotlar",
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

export function getNavTitle(pathname: string): string {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.title;
  const match = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.title ?? "E-MAKON";
}
