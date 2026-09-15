import type { ReactNode } from "react";

type DataTableProps = {
  headers: ReactNode[];
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function DataTable({
  headers,
  children,
  footer,
  className = "",
}: DataTableProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917] shadow-xl ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#26352c]/60 bg-[#0e1211] text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              {headers.map((header, i) => (
                <th key={i} className="px-4 py-3.5 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#26352c]/30">{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

type ActionButtonsProps = {
  actions?: Array<"visibility" | "edit" | "block" | "delete" | "more_vert" | "lock_open">;
};

export function RowActions({
  actions = ["visibility", "edit", "block", "more_vert"],
}: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {actions.map((icon) => (
        <button
          key={icon}
          type="button"
          className={`flex h-8 w-8 items-center justify-center border border-[#26352c] bg-[#1a221e] text-on-surface-variant shadow-sm transition-all hover:border-primary/60 hover:text-primary ${
            icon === "more_vert" ? "rounded-full" : "rounded-lg"
          } ${icon === "block" || icon === "delete" ? "hover:border-error/60 hover:text-error" : ""}`}
        >
          <span className="material-symbols-outlined text-[17px]">{icon}</span>
        </button>
      ))}
    </div>
  );
}

export function Avatar({
  initials,
  tone = "primary",
}: {
  initials: string;
  tone?: "primary" | "error" | "neutral";
}) {
  const tones = {
    primary: "bg-[#1b382b] text-primary border-primary-container/50",
    error: "bg-[#381617] text-error border-error/40",
    neutral: "bg-surface-variant text-on-surface-variant border-white/10",
  };
  return (
    <div
      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-[13px] font-bold tracking-wider ${tones[tone]}`}
    >
      {initials}
    </div>
  );
}
