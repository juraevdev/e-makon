import type { ReactNode } from "react";

export type StatusVariant = "success" | "warning" | "error" | "neutral" | "info";

const statusStyles: Record<StatusVariant, string> = {
  success: "bg-primary/15 text-primary border-primary/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  error: "bg-error/15 text-error border-error/30",
  neutral: "bg-surface-container-high text-on-surface-variant border-white/10",
  info: "bg-tertiary/15 text-tertiary-fixed-dim border-tertiary/30",
};

const statusDots: Record<StatusVariant, string> = {
  success: "bg-primary",
  warning: "bg-amber-400",
  error: "bg-error",
  neutral: "bg-on-surface-variant",
  info: "bg-tertiary",
};

type StatusPillProps = {
  children: ReactNode;
  variant?: StatusVariant;
  pulse?: boolean;
  className?: string;
};

export function StatusPill({
  children,
  variant = "success",
  pulse = false,
  className = "",
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[variant]} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${statusDots[variant]} ${pulse ? "animate-pulse" : ""}`}
      />
      {children}
    </span>
  );
}
