import type { ReactNode } from "react";
import { StatCard } from "./StatCard";
import { StatusPill } from "./StatusPill";
import { PageHeader } from "./PageHeader";
import { DataTable, RowActions, Avatar } from "./DataTable";
import { Breadcrumbs } from "./Breadcrumbs";
import { ConfirmDialog } from "./ConfirmDialog";
import { Skeleton, StatRowSkeleton, TableSkeleton } from "./Skeleton";
import { ShelvedModule } from "./ShelvedModule";

export {
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
          ? "border-primary/40 bg-[#203326]/50 font-semibold text-primary shadow-[0_0_15px_rgba(46,125,50,0.25)]"
          : "border-[#26352c] bg-[#111614] text-on-surface-variant hover:border-[#384f40] hover:text-on-surface"
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
      className={`rounded-2xl border border-card-border bg-card/90 shadow-lg shadow-black/20 backdrop-blur-md transition-all hover:border-[#384c3e] ${
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
    <div className="flex flex-col items-center justify-between gap-4 border-t border-[#26352c]/50 bg-[#0e1211]/90 px-6 py-4 backdrop-blur-sm md:flex-row">
      <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#26352c] text-on-surface-variant disabled:opacity-30"
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
                ? "border-primary/60 bg-gradient-to-r from-primary-container to-[#3e9843] text-white shadow-[0_0_12px_rgba(46,125,50,0.6)]"
                : "border-[#26352c] text-on-surface-variant hover:border-primary/40 hover:bg-[#1a231d] hover:text-primary"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={current >= last}
          onClick={() => onPageChange?.(current + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#26352c] text-on-surface-variant transition-all hover:border-primary/40 hover:text-white disabled:opacity-30"
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
      className={`inline-flex items-center gap-2 rounded-full border border-primary/40 bg-[#1b2a1e] px-5 py-2.5 text-sm font-semibold text-primary shadow-[0_0_15px_rgba(46,125,50,0.25)] transition-all hover:border-primary hover:bg-[#233827] hover:text-white disabled:opacity-50 ${className}`}
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
      className={`inline-flex items-center gap-2 rounded-full border border-[#26352c] bg-[#151c18] px-4 py-2.5 text-sm font-medium text-on-surface transition-all hover:bg-[#1f2922] disabled:opacity-50 ${className}`}
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

export function LoadingBlock({ label = "Yuklanmoqda..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-16 text-on-surface-variant">
      <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      {label}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Yopish" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[#26352c] bg-[#151917] p-6 shadow-2xl ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[#26352c] bg-[#0d100f] px-3.5 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary";
