"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast],
  );

  const showSuccess = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const showError = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, "info"), [showToast]);
  const showWarning = useCallback((message: string) => showToast(message, "warning"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex max-w-sm flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => {
          const styles = {
            success: "border-primary/50 bg-[#122216] text-[#bdf4ba]",
            error: "border-error/50 bg-[#291113] text-[#ffdad6]",
            warning: "border-amber-500/50 bg-[#261f12] text-[#fed7aa]",
            info: "border-sky-500/50 bg-[#10222a] text-[#bae6fd]",
          }[toast.type];

          const icon = {
            success: "check_circle",
            error: "error",
            warning: "warning",
            info: "info",
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${styles}`}
              role="alert"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">{icon}</span>
              <p className="flex-1 font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Yopish"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
