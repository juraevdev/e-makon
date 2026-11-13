"use client";

import { UiText } from "./UiText";

const SIZE = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

export function Spinner({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full border-primary/20 border-t-primary ${SIZE[size]} ${className}`}
    />
  );
}

/** Sahifa / auth boot uchun markaziy loading. */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xl font-extrabold tracking-tight text-primary">E-MAKON</p>
        <Spinner size="lg" />
        <p className="text-sm text-ink-muted">
          {label ?? <UiText k="common.loading" fallback="Yuklanmoqda..." />}
        </p>
      </div>
    </div>
  );
}
