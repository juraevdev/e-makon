import Link from "next/link";
import React from "react";
import { Breadcrumbs } from "./Breadcrumbs";

type ShelvedModuleProps = {
  title: string;
  icon: string;
  description: string;
  plannedPhase?: string;
};

export function ShelvedModule({
  title,
  icon,
  description,
  plannedPhase = "2-bosqich (Keyingi reliz)",
}: ShelvedModuleProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 max-w-4xl mx-auto w-full">
      <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: title }]} />

      <div className="mt-6 rounded-2xl border border-[#26352c] bg-[#141816] p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <span className="material-symbols-outlined text-[32px]">{icon}</span>
        </div>

        <h2 className="mt-4 text-xl font-bold text-white tracking-tight">{title}</h2>
        <span className="mt-2 inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/30">
          {plannedPhase}
        </span>

        <p className="mx-auto mt-4 max-w-lg text-sm text-on-surface-variant leading-relaxed">
          {description}
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-[#16271c] px-5 py-2.5 text-xs font-semibold text-primary hover:bg-[#1f3827] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Bosh sahifaga qaytish
          </Link>
          <Link
            href="/buyurtmalar"
            className="inline-flex items-center gap-2 rounded-xl border border-[#26352c] bg-[#101412] px-4 py-2.5 text-xs font-medium text-on-surface hover:bg-[#161c18] transition-all"
          >
            Buyurtmalar nazorati
          </Link>
        </div>
      </div>
    </div>
  );
}
