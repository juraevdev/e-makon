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
      className={`overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-card-border/60 bg-surface-container-low text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              {headers.map((header, i) => (
                <th key={i} className="px-4 py-3.5 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/30">{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

type ActionButtonsProps = {
  actions?: Array<"visibility" | "edit" | "block" | "delete" | "more_vert" | "lock_open">;
  onAction?: (action: string) => void;
};

export function RowActions({
  actions = ["visibility", "edit", "block", "more_vert"],
  onAction,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {actions.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onAction?.(icon)}
          className={`flex h-8 w-8 items-center justify-center border border-card-border bg-surface-container text-on-surface-variant shadow-sm transition-all hover:border-primary/60 hover:text-primary ${
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
    primary: "bg-secondary-container text-primary border-primary-container/50",
    error: "bg-error-container text-error border-error/40",
    neutral: "bg-surface-variant text-on-surface-variant border-card-border",
  };
  return (
    <div
      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-[13px] font-bold tracking-wider ${tones[tone]}`}
    >
      {initials}
    </div>
  );
}
