"use client";

import type { ReactNode } from "react";
import { StatCard } from "./StatCard";
import { StatusPill } from "./StatusPill";
import { PageHeader } from "./PageHeader";
import { DataTable, RowActions, Avatar } from "./DataTable";
import { Breadcrumbs } from "./Breadcrumbs";
import { ConfirmDialog } from "./ConfirmDialog";
import { Skeleton, StatRowSkeleton, TableSkeleton } from "./Skeleton";
import { ShelvedModule } from "./ShelvedModule";
import { ScheduleBoard } from "./ScheduleBoard";
import { Modal } from "./Modal";
import { UiText, useUiT } from "./UiText";

export {
  Modal,
  ScheduleBoard,
  StatCard,
  StatusPill,
  PageHeader,
  DataTable,
  RowActions,
  Avatar,
  Breadcrumbs,
  ConfirmDialog,
  Skeleton,
  StatRowSkeleton,
  TableSkeleton,
  ShelvedModule,
  UiText,
  useUiT,
};

export function FilterChip({
  label,
  count,
  active = false,
  icon,
  dot,
  onClick,
}: {
  label: string;
  count?: string | number;
  active?: boolean;
  icon?: string;
  dot?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-accent/40 bg-accent-soft font-semibold text-accent"
          : "border-card-border bg-card text-ink-muted hover:border-primary/30 hover:text-ink"
      }`}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      {dot ? <span className={`h-2 w-2 rounded-full ${dot}`} /> : null}
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active
              ? "bg-primary/20 text-primary-fixed"
              : "bg-surface-container-highest text-on-surface-variant"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function Card({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-card-border bg-card/95 shadow-md shadow-black/5 backdrop-blur-md transition-all hover:border-primary/25 dark:shadow-black/30 ${
        padding ? "p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  icon,
  title,
  action,
}: {
  icon?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between border-b border-surface-variant/40 pb-3">
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="material-symbols-outlined text-xl text-primary">
            {icon}
          </span>
        ) : null}
        <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Pagination({
  info,
  pages = [1],
  current = 1,
  onPageChange,
}: {
  info: ReactNode;
  pages?: number[];
  current?: number;
  onPageChange?: (page: number) => void;
}) {
  const last = pages[pages.length - 1] ?? 1;
  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-card-border/70 bg-card/90 px-6 py-4 backdrop-blur-sm md:flex-row">
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <span className="material-symbols-outlined text-[18px] text-primary">
          info
        </span>
        <span>{info}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPageChange?.(current - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border bg-card text-ink-muted disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange?.(page)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-all ${
              page === current
                ? "border-primary/60 bg-primary text-on-primary shadow-[0_0_12px_rgba(58,82,54,0.35)]"
                : "border-card-border bg-card text-ink-muted hover:border-primary/40 hover:bg-surface-container-low hover:text-primary"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={current >= last}
          onClick={() => onPageChange?.(current + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border bg-card text-ink-muted transition-all hover:border-primary/40 hover:text-ink disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  icon,
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  icon?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`btn-accent inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed ${className}`}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  icon,
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  icon?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-4 py-2.5 text-sm font-medium text-ink transition-all hover:border-primary/30 hover:bg-surface-container-low disabled:opacity-50 ${className}`}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </span>
      <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
      {description ? <p className="max-w-md text-sm text-on-surface-variant">{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-16 text-ink-muted">
      <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      {label ?? <UiText k="common.loading" fallback="…" />}
    </div>
  );
}

export function Field({
  label,
  children,
  required,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-error">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: string;
  count?: number | string;
};

/** Mobil ekranda gorizontal suriladigan, kichrayib qolmaydigan tab bar. */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] ${className}`}>
      <div role="tablist" className="emakon-tab-track inline-flex min-w-full gap-1 rounded-2xl border p-1 sm:min-w-0">
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`inline-flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all sm:flex-none ${
                active
                  ? "emakon-tab-active"
                  : "text-ink-muted hover:bg-surface-container-low hover:text-ink"
              }`}
            >
              {tab.icon ? <span className="material-symbols-outlined text-[18px]">{tab.icon}</span> : null}
              <span>{tab.label}</span>
              {tab.count !== undefined ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active ? "bg-primary/20 text-primary" : "bg-surface-container-highest text-ink-muted"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ExcelButton({
  onClick,
  disabled,
  label,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const t = useUiT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t("common.excelHint")}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-40 ${className}`}
      style={{
        color: "var(--excel-fg)",
        background: "var(--excel-bg)",
        borderColor: "var(--excel-border)",
      }}
    >
      <span className="material-symbols-outlined text-[18px]">table_view</span>
      {label ?? t("common.excel")}
    </button>
  );
}

/** "Jonli" ko'rsatkichi: ma'lumot fon rejimida avtomatik yangilanayotganini bildiradi. */
export function LiveBadge({ updatedAt, className = "" }: { updatedAt?: number; className?: string }) {
  const t = useUiT();
  const time = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ${className}`}
      title={t("common.liveHint")}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      {t("common.live")}
      {time ? ` · ${time}` : ""}
    </span>
  );
}

export const inputClass = "emakon-input";