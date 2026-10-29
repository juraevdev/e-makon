import type { ReactNode } from "react";
import { LiveBadge } from "@/components/ui";

/** Firma sahifalari uchun yagona sarlavha qatori: tavsif, jonli belgi va amallar. */
export function PageBar({
  title,
  description,
  actions,
  updatedAt,
  children,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  updatedAt?: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 max-w-3xl space-y-1.5">
        {title || updatedAt !== undefined ? (
          <div className="flex flex-wrap items-center gap-2">
            {title ? <h2 className="text-lg font-semibold text-ink md:text-xl">{title}</h2> : null}
            {updatedAt !== undefined ? <LiveBadge updatedAt={updatedAt} /> : null}
          </div>
        ) : null}
        {description ? <p className="text-sm leading-relaxed text-ink-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Ma'lumot yoki ogohlantirish satri. */
export function InfoNote({
  icon = "info",
  tone = "info",
  children,
  className = "",
}: {
  icon?: string;
  tone?: "info" | "warning" | "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-sky-600/30 bg-sky-500/10 text-sky-900 dark:border-sky-500/30 dark:text-sky-100",
    warning:
      "border-amber-600/35 bg-amber-500/12 text-amber-950 dark:border-amber-500/40 dark:text-amber-100",
    error: "border-error/40 bg-error/10 text-error",
    success: "border-primary/30 bg-primary/10 text-ink",
  }[tone];
  const iconTone = {
    info: "text-sky-700 dark:text-sky-300",
    warning: "text-amber-700 dark:text-amber-300",
    error: "text-error",
    success: "text-primary",
  }[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles} ${className}`}>
      <span className={`material-symbols-outlined mt-px shrink-0 text-[18px] ${iconTone}`}>{icon}</span>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

/** Kichik ko'rsatkich kartasi (sahifa yuqorisidagi statistikalar uchun). */
export function MiniStat({
  label,
  value,
  icon,
  hint,
  tone = "default",
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon: string;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "error";
  active?: boolean;
  onClick?: () => void;
}) {
  const iconTone = {
    default: "text-ink-muted",
    primary: "text-primary",
    warning: "text-amber-700 dark:text-amber-300",
    error: "text-error",
  }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-muted">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-secondary-container/80 ${iconTone}`}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </span>
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 truncate text-xs text-ink-muted">{hint}</p> : null}
    </>
  );
  const cls = `min-w-0 rounded-2xl border p-4 text-left shadow-sm transition ${
    active
      ? "border-primary/50 bg-secondary-container"
      : "border-card-border bg-card hover:border-primary/35"
  }`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} hover:border-primary/40`}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
