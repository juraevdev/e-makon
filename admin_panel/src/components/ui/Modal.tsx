"use client";

import { useEffect, type ReactNode } from "react";
import { useLocale } from "@/providers/LocaleProvider";

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
} as const;

export type ModalSize = keyof typeof SIZES;

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
  size,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  size?: ModalSize;
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = SIZES[size ?? (wide ? "lg" : "md")];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/70">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`emakon-modal relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-2xl ${width}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-card-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-tight text-ink">{title}</h3>
            {description ? <div className="mt-1 text-sm text-ink-muted">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-surface-container-high hover:text-ink"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-ink sm:px-6">{children}</div>
        {footer ? (
          <div className="emakon-modal-footer flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
