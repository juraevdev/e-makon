"use client";

import React, { ReactNode } from "react";

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
  confirmText = "Tasdiqlash",
  cancelText = "Bekor qilish",
  variant = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmBtnStyles = {
    danger: "bg-error-container text-on-error-container border-error/50 hover:bg-error-container/80",
    primary: "bg-[#1b2a1e] text-primary border-primary/50 hover:bg-[#233827]",
    warning: "bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900",
  }[variant];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 backdrop-blur-xs sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        aria-label="Yopish"
        disabled={busy}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-card-border bg-[#141816] p-6 shadow-2xl transition-all"
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
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {variant === "danger" ? "warning" : variant === "warning" ? "error" : "help"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-bold text-on-surface">
              {title}
            </h3>
            <div className="mt-2 text-sm text-on-surface-variant leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#26352c]/40">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[#26352c] bg-[#121614] px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-[#1b221d] hover:text-on-surface disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold shadow-sm transition-all disabled:opacity-50 ${confirmBtnStyles}`}
          >
            {busy ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                Bajarilmoqda...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
