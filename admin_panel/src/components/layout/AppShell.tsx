"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useSearch } from "@/providers/SearchProvider";
import { useFirm } from "@/providers/FirmProvider";
import { formatDate, formatMoney } from "@/lib/format";

function FirmAlerts() {
  const { firm } = useFirm();
  if (!firm) return null;

  const alerts: { tone: "error" | "warning"; text: string }[] = [];
  if (firm.status === "suspended") {
    alerts.push({
      tone: "error",
      text: "Firmangiz tizim ma'muriyati tomonidan bloklangan. Xizmatlaringiz mijozlarga ko'rinmaydi.",
    });
  } else if (firm.status === "ended") {
    alerts.push({ tone: "error", text: "Platforma bilan kelishuv tugagan. Yangi buyurtmalar qabul qilinmaydi." });
  }
  if (firm.is_sales_banned) {
    alerts.push({
      tone: "error",
      text: `Sotuv vaqtincha taqiqlangan (${formatDate(firm.sales_banned_until)} gacha). Yangi buyurtmalar kelmaydi.`,
    });
  }
  if (Number(firm.unpaid_fines) > 0) {
    alerts.push({ tone: "warning", text: `To'lanmagan jarimalar: ${formatMoney(firm.unpaid_fines)}.` });
  }
  if (Number(firm.debt_amount) > 0) {
    alerts.push({ tone: "warning", text: `Platforma oldidagi qarz: ${formatMoney(firm.debt_amount, firm.debt_currency)}.` });
  }
  if (!alerts.length) return null;

  return (
    <div className="space-y-2 px-4 pt-2 md:px-8">
      {alerts.map((a) => (
        <div
          key={a.text}
          className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm ${
            a.tone === "error"
              ? "border-error/40 bg-error/10 text-error"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {a.tone === "error" ? "block" : "warning"}
          </span>
          <span>{a.text}</span>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarPath, setSidebarPath] = useState<string | null>(null);
  const sidebarOpen = sidebarPath === pathname;
  const { setQuery } = useSearch();

  useEffect(() => {
    setQuery("");
  }, [pathname, setQuery]);

  return (
    <div className="flex min-h-screen bg-background text-on-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarPath(null)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarPath(pathname)} />
        <FirmAlerts />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
