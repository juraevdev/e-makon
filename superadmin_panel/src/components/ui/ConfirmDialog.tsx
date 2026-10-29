"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/providers/LocaleProvider";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "warning";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  variant = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  if (!open) return null;

  const confirmBtnStyles = {
    danger: "bg-error text-on-error hover:opacity-90",
    primary: "btn-accent",
    warning: "bg-amber-500 text-ink hover:bg-amber-600",
  }[variant];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 backdrop-blur-xs sm:items-center dark:bg-black/70">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        aria-label={t("common.close")}
        disabled={busy}
      />
      <div
        className="emakon-modal relative z-10 w-full max-w-md overflow-hidden rounded-2xl border p-6 shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              variant === "danger"
                ? "border-error/30 bg-error/10 text-error"
                : variant === "warning"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {variant === "danger" ? "warning" : variant === "warning" ? "error" : "help"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-bold text-ink">
              {title}
            </h3>
            <div className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-card-border pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-card-border bg-card px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-container-low hover:text-ink disabled:opacity-50"
          >
            {cancelText ?? t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${confirmBtnStyles}`}
          >
            {busy ? t("common.loading") : confirmText ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
