"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Avatar,
  Breadcrumbs,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ExcelButton,
  Field,
  FilterChip,
  inputClass,
  LiveBadge,
  Modal,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TableSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatPhone, initials, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/providers/AuthProvider";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage, fetchAllPages, useFirmOptions } from "@/components/people/api";
import {
  ErrorPanel,
  FieldError,
  FormSection,
  MiniStat,
  PasswordInput,
  SearchBox,
  SelectFilter,
  StrengthMeter,
  Toggle,
  ViewToggle,
  errorRing,
  isValidUzPhone,
  normalizeUzPhone,
  onlyDigits,
} from "@/components/people/form";
import type { AdminProfileFull } from "@/components/people/types";

type CapKey = "can_manage_orders" | "can_manage_staff" | "can_view_analytics";

const CHIP_TONE = {
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-300",
} as const;

const CAP_GROUPS: {
  id: string;
  title: string;
  icon: string;
  caps: { key: CapKey; label: string; description: string; icon: string; tone: keyof typeof CHIP_TONE }[];
}[] = [
  {
    id: "ops",
    title: "Operatsion boshqaruv",
    icon: "settings_suggest",
    caps: [
      {
        key: "can_manage_orders",
        label: "Buyurtmalar",
        description: "Buyurtmalar, mijozlar va murojaatlarni boshqarish",
        icon: "receipt_long",
        tone: "sky",
      },
      {
        key: "can_manage_staff",
        label: "Xodimlar",
        description: "Xodimlarni qo'shish, tayinlash va holatini o'zgartirish",
        icon: "engineering",
        tone: "emerald",
      },
    ],
  },
  {
    id: "insight",
    title: "Tahlil va hisobotlar",
    icon: "insights",
    caps: [
      {
        key: "can_view_analytics",
        label: "Analitika",
        description: "Dashboard, moliya va hisobotlarni ko'rish",
        icon: "monitoring",
        tone: "purple",
      },
    ],
  },
];

const ALL_CAPS = CAP_GROUPS.flatMap((g) => g.caps);
const TITLE_PRESETS = ["Admin", "Katta menejer", "Operator", "Dispetcher", "Buxgalter", "Firma rahbari"];
const PAGE_SIZE = 12;

type FormState = {
  full_name: string;
  phone: string;
  password: string;
  title: string;
  organization_id: string;
  is_active: boolean;
} & Record<CapKey, boolean>;

type FormErrors = Partial<Record<"full_name" | "phone" | "password" | "title", string>>;

const emptyForm: FormState = {
  full_name: "",
  phone: "+998",
  password: "",
  title: "Admin",
  organization_id: "",
  is_active: true,
  can_manage_orders: true,
  can_manage_staff: true,
  can_view_analytics: true,
};

function orgOf(admin: AdminProfileFull) {
  return admin.organization_id ?? admin.user.organization_id ?? null;
}

function adminName(admin: AdminProfileFull) {
  return admin.user.full_name || formatPhone(admin.user.phone);
}

function CapChips({ admin, compact = false }: { admin: AdminProfileFull; compact?: boolean }) {
  const caps = ALL_CAPS.filter((c) => admin[c.key]);
  if (!caps.length) return <span className="text-[11px] text-on-surface-variant">Vakolat yo&apos;q</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {caps.map((c) => (
        <span
          key={c.key}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${CHIP_TONE[c.tone]}`}
        >
          {compact ? null : <span className="material-symbols-outlined text-[12px]">{c.icon}</span>}
          {c.label}
        </span>
      ))}
    </div>
  );
}

type RowProps = {
  admin: AdminProfileFull;
  self: boolean;
  firm: string;
  onEdit: () => void;
  onToggle: () => void;
};

function ActionButtons({ admin, self, onEdit, onToggle }: RowProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] bg-[#121614] px-2.5 py-1.5 text-xs font-medium text-on-surface transition-all hover:border-primary/50 hover:text-primary"
      >
        <span className="material-symbols-outlined text-[15px]">edit</span>
        Tahrirlash
      </button>
      <button
        type="button"
        disabled={self}
        onClick={onToggle}
        title={self ? "O'zingizni deaktiv qila olmaysiz" : admin.is_active ? "Deaktiv qilish" : "Faollashtirish"}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
          admin.is_active
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        <span className="material-symbols-outlined text-[15px]">{admin.is_active ? "block" : "check_circle"}</span>
        {admin.is_active ? "Deaktiv" : "Faollashtirish"}
      </button>
    </div>
  );
}

function FirmLink({ admin, firm }: { admin: AdminProfileFull; firm: string }) {
  const id = orgOf(admin);
  if (id === null) return <span className="text-on-surface-variant">Biriktirilmagan</span>;
  return (
    <Link href={`/firmalar/${id}`} className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
      <span className="material-symbols-outlined text-[14px]">storefront</span>
      <span className="truncate">{firm}</span>
    </Link>
  );
}

function SelfBadge() {
  return <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">SIZ</span>;
}

function AdminCard(props: RowProps) {
  const { admin, self, firm } = props;
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-gradient-to-b from-[#151a18] to-[#101412] p-5 transition hover:border-primary/50 ${
        admin.is_active ? "border-primary-container/35" : "border-[#3a2a2b]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Avatar initials={initials(admin.user.full_name || admin.user.phone)} tone={admin.is_active ? "primary" : "neutral"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-on-surface">{admin.user.full_name || "Ism ko'rsatilmagan"}</h3>
            {self ? <SelfBadge /> : null}
          </div>
          <p className="truncate text-xs text-on-surface-variant">{admin.title || "Admin"}</p>
        </div>
        <StatusPill variant={admin.is_active ? "success" : "neutral"} pulse={admin.is_active}>
          {admin.is_active ? "Faol" : "Nofaol"}
        </StatusPill>
      </div>
      <div className="space-y-1.5 text-xs">
        <p className="flex items-center gap-2 font-mono text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-primary">call</span>
          {formatPhone(admin.user.phone)}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <FirmLink admin={admin} firm={firm} />
        </div>
        <p className="flex items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-primary">event</span>
          Qo&apos;shilgan: {formatDate(admin.created_at)}
        </p>
      </div>
      <CapChips admin={admin} />
      <div className="mt-auto border-t border-white/5 pt-3">
        <ActionButtons {...props} />
      </div>
    </div>
  );
}

function AdminRow(props: RowProps) {
  const { admin: a, self, firm } = props;
  return (
    <tr className="transition-colors hover:bg-[#18211b]/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <Avatar initials={initials(a.user.full_name || a.user.phone)} tone={a.is_active ? "primary" : "neutral"} />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
              {a.user.full_name || "Ism ko'rsatilmagan"}
              {self ? <SelfBadge /> : null}
            </p>
            <p className="font-mono text-xs text-on-surface-variant">{formatPhone(a.user.phone)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-on-surface">{a.title || "Admin"}</td>
      <td className="max-w-[200px] px-4 py-3 text-xs">
        <FirmLink admin={a} firm={firm} />
      </td>
      <td className="px-4 py-3">
        <CapChips admin={a} compact />
      </td>
      <td className="px-4 py-3">
        <StatusPill variant={a.is_active ? "success" : "neutral"} pulse={a.is_active}>
          {a.is_active ? "Faol" : "Nofaol"}
        </StatusPill>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">{formatDate(a.created_at)}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <ActionButtons {...props} />
      </td>
    </tr>
  );
}

function validate(form: FormState, editing: boolean): FormErrors {
  const errors: FormErrors = {};
  if (form.full_name.trim().length < 2) errors.full_name = "To'liq ismni kiriting";
  if (!isValidUzPhone(form.phone)) errors.phone = "Telefon +998 XX XXX XX XX formatida bo'lsin";
  const pwd = form.password.trim();
  if (!editing && !pwd) errors.password = "Parol majburiy";
  else if (pwd && pwd.length < 8) errors.password = "Kamida 8 ta belgi";
  if (form.title.trim().length > 120) errors.title = "Lavozim juda uzun";
  return errors;
}

export default function AdministratorlarPage() {
  const { user } = useAuth();
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const { firms, firmName } = useFirmOptions();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [firmFilter, setFirmFilter] = useState("all");
  const [capFilter, setCapFilter] = useState<"all" | "full" | "none" | CapKey>("all");
  const [titleFilter, setTitleFilter] = useState("all");
  const [view, setView] = useState<"grid" | "table">("table");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProfileFull | null>(null);
  const [form, setFormState] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<AdminProfileFull | null>(null);
  const [busyToggle, setBusyToggle] = useState(false);

  const { data, loading, error, reload, updatedAt } = useAsync(
    () => fetchAllPages<AdminProfileFull>("/admin/admins/"),
    [],
  );
  const all = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const active = all.filter((a) => a.is_active).length;
    const full = all.filter((a) => ALL_CAPS.every((c) => a[c.key])).length;
    const titles = new Map<string, number>();
    for (const a of all) {
      const t = a.title?.trim() || "Admin";
      titles.set(t, (titles.get(t) ?? 0) + 1);
    }
    const firmIds = new Set(all.map(orgOf).filter((id): id is number => id !== null));
    return {
      total: all.length,
      active,
      inactive: all.length - active,
      full,
      firms: firmIds.size,
      titles: [...titles.entries()].sort((a, b) => b[1] - a[1]),
      caps: ALL_CAPS.map((c) => ({ ...c, count: all.filter((a) => a[c.key]).length })),
    };
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = onlyDigits(q);
    return all.filter((a) => {
      if (status === "active" && !a.is_active) return false;
      if (status === "inactive" && a.is_active) return false;
      if (firmFilter !== "all" && String(orgOf(a) ?? "") !== firmFilter) return false;
      if (titleFilter !== "all" && (a.title?.trim() || "Admin") !== titleFilter) return false;
      if (capFilter === "full" && !ALL_CAPS.every((c) => a[c.key])) return false;
      if (capFilter === "none" && ALL_CAPS.some((c) => a[c.key])) return false;
      if (capFilter !== "all" && capFilter !== "full" && capFilter !== "none" && !a[capFilter]) return false;
      if (!q) return true;
      const hay = `${a.user.full_name} ${a.title} ${firmName(orgOf(a))}`.toLowerCase();
      return hay.includes(q) || (qDigits.length >= 3 && onlyDigits(a.user.phone).includes(qDigits));
    });
  }, [all, status, firmFilter, titleFilter, capFilter, query, firmName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = status !== "all" || firmFilter !== "all" || capFilter !== "all" || titleFilter !== "all" || !!query;

  function resetFilters() {
    setStatus("all");
    setFirmFilter("all");
    setCapFilter("all");
    setTitleFilter("all");
    setPage(1);
  }

  function setForm(patch: Partial<FormState>) {
    setFormState((f) => ({ ...f, ...patch }));
    const keys = Object.keys(patch) as (keyof FormErrors)[];
    if (keys.some((k) => errors[k])) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k as keyof FormErrors))));
  }

  function openCreate() {
    setEditing(null);
    setFormState(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(admin: AdminProfileFull) {
    setEditing(admin);
    setFormState({
      full_name: admin.user.full_name || "",
      phone: admin.user.phone,
      password: "",
      title: admin.title || "Admin",
      organization_id: orgOf(admin) === null ? "" : String(orgOf(admin)),
      is_active: admin.is_active,
      can_manage_orders: admin.can_manage_orders,
      can_manage_staff: admin.can_manage_staff,
      can_view_analytics: admin.can_view_analytics,
    });
    setErrors({});
    setModalOpen(true);
  }

  function setCaps(keys: CapKey[], value: boolean) {
    setFormState((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, value])) }));
  }

  async function handleSave() {
    const next = validate(form, !!editing);
    setErrors(next);
    if (Object.keys(next).length) {
      showError("Formadagi xatolarni tuzating");
      return;
    }
    if (!form.organization_id) {
      showError("Admin qaysi firmaga tegishli ekanini tanlang");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        phone: normalizeUzPhone(form.phone),
        full_name: form.full_name.trim(),
        organization_id: Number(form.organization_id),
        title: form.title.trim() || "Admin",
        can_manage_orders: form.can_manage_orders,
        can_manage_staff: form.can_manage_staff,
        can_view_analytics: form.can_view_analytics,
        is_active: form.is_active,
      };
      if (form.password.trim()) payload.password = form.password.trim();

      if (editing) {
        await api(`/admin/admins/${editing.id}/`, { method: "PATCH", body: payload });
        showSuccess(`"${form.full_name.trim()}" ma'lumotlari yangilandi`);
      } else {
        await api("/admin/admins/", { method: "POST", body: payload });
        showSuccess(`"${form.full_name.trim()}" administrator sifatida qo'shildi`);
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      showError(errorMessage(e, "Saqlashda xatolik yuz berdi"));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus() {
    if (!toggleTarget) return;
    setBusyToggle(true);
    const nextStatus = !toggleTarget.is_active;
    try {
      await api(`/admin/admins/${toggleTarget.id}/`, { method: "PATCH", body: { is_active: nextStatus } });
      showSuccess(`"${adminName(toggleTarget)}" ${nextStatus ? "faollashtirildi" : "deaktiv qilindi"}`);
      setToggleTarget(null);
      await reload();
    } catch (e) {
      showError(errorMessage(e, "Holatni o'zgartirib bo'lmadi"));
    } finally {
      setBusyToggle(false);
    }
  }

  function exportExcel() {
    downloadExcel("administratorlar", {
      name: "Administratorlar",
      headers: ["ID", "F.I.Sh.", "Telefon", "Lavozim", "Firma", "Buyurtmalar", "Xodimlar", "Analitika", "Holat", "Qo'shilgan"],
      rows: filtered.map((a) => [
        a.id,
        a.user.full_name || "",
        formatPhone(a.user.phone),
        a.title || "Admin",
        firmName(orgOf(a)),
        a.can_manage_orders ? "Ha" : "Yo'q",
        a.can_manage_staff ? "Ha" : "Yo'q",
        a.can_view_analytics ? "Ha" : "Yo'q",
        a.is_active ? "Faol" : "Nofaol",
        formatDate(a.created_at),
      ]),
    });
  }

  const isSelf = (a: AdminProfileFull) => a.user.id === user?.id;
  const rowProps = (a: AdminProfileFull) => ({
    admin: a,
    self: isSelf(a),
    firm: firmName(orgOf(a)),
    onEdit: () => openEdit(a),
    onToggle: () => setToggleTarget(a),
  });

  const allCapsOn = ALL_CAPS.every((c) => form[c.key]);
  const someCapsOn = ALL_CAPS.some((c) => form[c.key]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[#26352c]/40 pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Administratorlar" }]} />
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">Administratorlar nazorati</h2>
            <LiveBadge updatedAt={updatedAt || undefined} />
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant md:text-sm">
            Panelga kirish huquqiga ega adminlar, ularning firmasi va vakolatlari
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ExcelButton onClick={exportExcel} disabled={!filtered.length} />
          <PrimaryButton icon="person_add" onClick={openCreate}>
            Yangi admin
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          icon="admin_panel_settings"
          label="Jami adminlar"
          value={stats.total}
          hint={`${stats.firms} ta firmada`}
          active={status === "all" && capFilter === "all"}
          onClick={() => {
            setStatus("all");
            setCapFilter("all");
            setPage(1);
          }}
        />
        <MiniStat
          icon="verified_user"
          label="Faol"
          value={stats.active}
          hint={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% jami adminlardan` : undefined}
          active={status === "active"}
          onClick={() => {
            setStatus("active");
            setPage(1);
          }}
        />
        <MiniStat
          icon="person_off"
          label="Nofaol"
          value={stats.inactive}
          tone="amber"
          hint="Tizimga kira olmaydi"
          active={status === "inactive"}
          onClick={() => {
            setStatus("inactive");
            setPage(1);
          }}
        />
        <MiniStat
          icon="workspace_premium"
          label="To'liq vakolatli"
          value={stats.full}
          tone="sky"
          hint="Barcha vakolatlar yoqilgan"
          active={capFilter === "full"}
          onClick={() => {
            setCapFilter(capFilter === "full" ? "all" : "full");
            setPage(1);
          }}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-[#26352c] bg-[#121614]/80 p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchBox placeholder="Ism, telefon, lavozim yoki firma..." className="lg:flex-1" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <SelectFilter
              label="Firma"
              icon="storefront"
              value={firmFilter}
              onChange={(v) => {
                setFirmFilter(v);
                setPage(1);
              }}
              options={[{ value: "all", label: "Barcha firmalar" }, ...firms.map((f) => ({ value: String(f.id), label: f.name }))]}
              className="lg:w-56"
            />
            <SelectFilter
              label="Vakolat"
              icon="key"
              value={capFilter}
              onChange={(v) => {
                setCapFilter(v as typeof capFilter);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Barcha vakolatlar" },
                { value: "full", label: "To'liq vakolatli" },
                ...stats.caps.map((c) => ({ value: c.key, label: `${c.label} (${c.count})` })),
                { value: "none", label: "Vakolatsiz" },
              ]}
              className="lg:w-52"
            />
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
        {stats.titles.length ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <FilterChip
              label="Barcha lavozimlar"
              icon="badge"
              count={stats.total}
              active={titleFilter === "all"}
              onClick={() => {
                setTitleFilter("all");
                setPage(1);
              }}
            />
            {stats.titles.map(([title, count]) => (
              <FilterChip
                key={title}
                label={title}
                count={count}
                active={titleFilter === title}
                onClick={() => {
                  setTitleFilter(titleFilter === title ? "all" : title);
                  setPage(1);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {loading && !data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error && !data ? (
        <ErrorPanel title="Administratorlarni yuklab bo'lmadi" message={error} onRetry={() => void reload()} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="admin_panel_settings"
            title={all.length ? "Mos administrator topilmadi" : "Hali administrator yo'q"}
            description={all.length ? "Qidiruv yoki filtrlarni o'zgartirib ko'ring." : "Birinchi administratorni qo'shing."}
            action={
              hasFilters && all.length ? (
                <SecondaryButton icon="filter_alt_off" onClick={resetFilters}>
                  Filtrlarni tozalash
                </SecondaryButton>
              ) : (
                <PrimaryButton icon="person_add" onClick={openCreate}>
                  Admin qo&apos;shish
                </PrimaryButton>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className={view === "table" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden" : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
            {visible.map((a) => (
              <AdminCard key={a.id} {...rowProps(a)} />
            ))}
          </div>
          {view === "table" ? (
            <div className="hidden md:block">
              <DataTable headers={["Administrator", "Lavozim", "Firma", "Vakolatlar", "Holat", "Qo'shilgan", ""]}>
                {visible.map((a) => (
                  <AdminRow key={a.id} {...rowProps(a)} />
                ))}
              </DataTable>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-[#26352c]">
            <Pagination
              current={current}
              pages={pageNumbers(current, totalPages)}
              onPageChange={setPage}
              info={
                <>
                  <strong className="text-primary">{filtered.length}</strong> ta administrator
                  {filtered.length !== all.length ? ` (jami ${all.length})` : ""}
                </>
              }
            />
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        size="lg"
        title={editing ? "Administratorni tahrirlash" : "Yangi administrator"}
        description={
          editing
            ? `${adminName(editing)} · ${formatPhone(editing.user.phone)}`
            : "Panelga telefon raqam va parol bilan kiradigan admin yarating"
        }
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <SecondaryButton onClick={() => setModalOpen(false)} className="justify-center">
              Bekor qilish
            </SecondaryButton>
            <PrimaryButton icon={editing ? "save" : "person_add"} disabled={busy} onClick={() => void handleSave()} className="justify-center">
              {busy ? "Saqlanmoqda..." : editing ? "O'zgarishlarni saqlash" : "Admin yaratish"}
            </PrimaryButton>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <FormSection icon="person" title="Shaxsiy ma'lumotlar" description="Telefon raqam — panelga kirish logini">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="To'liq ismi" required hint={<FieldError message={errors.full_name} />}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Masalan: Sardor Aliyev"
                  className={inputClass + errorRing(errors.full_name)}
                  value={form.full_name}
                  onChange={(e) => setForm({ full_name: e.target.value })}
                />
              </Field>
              <Field label="Telefon raqami" required hint={<FieldError message={errors.phone} />}>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+998 90 123 45 67"
                  className={inputClass + errorRing(errors.phone)}
                  value={form.phone}
                  onChange={(e) => setForm({ phone: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection icon="lock" title="Kirish va lavozim">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={editing ? "Yangi parol" : "Parol"}
                required={!editing}
                className="sm:col-span-2"
                hint={
                  errors.password ? (
                    <FieldError message={errors.password} />
                  ) : form.password ? (
                    <StrengthMeter value={form.password} />
                  ) : editing ? (
                    "O'zgartirmasangiz bo'sh qoldiring"
                  ) : (
                    "Kamida 8 ta belgi. \"Yaratish\" tugmasi xavfsiz parol taklif qiladi"
                  )
                }
              >
                <PasswordInput value={form.password} onChange={(v) => setForm({ password: v })} invalid={!!errors.password} />
              </Field>
              <Field label="Lavozim / unvon" hint={<FieldError message={errors.title} />}>
                <input
                  type="text"
                  list="admin-title-presets"
                  placeholder="Admin"
                  className={inputClass + errorRing(errors.title)}
                  value={form.title}
                  onChange={(e) => setForm({ title: e.target.value })}
                />
                <datalist id="admin-title-presets">
                  {TITLE_PRESETS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <Field label="Firma (tashkilot)" required hint="Admin faqat shu firma ma'lumotlarini ko'radi">
                <select className={inputClass} value={form.organization_id} onChange={(e) => setForm({ organization_id: e.target.value })}>
                  {form.organization_id ? null : <option value="">— Firmani tanlang —</option>}
                  {firms.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                      {f.status !== "active" ? " (nofaol)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon="key"
            title="Vakolatlar"
            description="Admin panelning qaysi bo'limlarini boshqara olishini belgilang"
            action={
              <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-[#26352c] bg-[#0d100f] px-3 py-1.5 text-xs font-semibold text-on-surface">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#2e7d32]"
                  checked={allCapsOn}
                  ref={(el) => {
                    if (el) el.indeterminate = someCapsOn && !allCapsOn;
                  }}
                  onChange={(e) => setCaps(ALL_CAPS.map((c) => c.key), e.target.checked)}
                />
                Hammasini tanlash
              </label>
            }
          >
            <div className="space-y-4">
              {CAP_GROUPS.map((group) => {
                const keys = group.caps.map((c) => c.key);
                const groupAll = keys.every((k) => form[k]);
                const groupSome = keys.some((k) => form[k]);
                return (
                  <div key={group.id}>
                    <label className="mb-2 flex cursor-pointer select-none items-center gap-2 text-xs font-bold tracking-wider text-primary uppercase">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#2e7d32]"
                        checked={groupAll}
                        ref={(el) => {
                          if (el) el.indeterminate = groupSome && !groupAll;
                        }}
                        onChange={(e) => setCaps(keys, e.target.checked)}
                      />
                      <span className="material-symbols-outlined text-[16px]">{group.icon}</span>
                      {group.title}
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.caps.map((c) => (
                        <label
                          key={c.key}
                          className={`flex cursor-pointer select-none items-start gap-3 rounded-xl border p-3 transition-all ${
                            form[c.key] ? "border-primary/40 bg-primary/5" : "border-[#26352c] bg-[#0d100f] hover:border-[#384f40]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#2e7d32]"
                            checked={form[c.key]}
                            onChange={(e) => setCaps([c.key], e.target.checked)}
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                              <span className="material-symbols-outlined text-[17px] text-primary">{c.icon}</span>
                              {c.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-on-surface-variant">{c.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!someCapsOn ? (
                <p className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Vakolatsiz admin panelga kira oladi, lekin hech bir bo&apos;limni boshqara olmaydi.
                </p>
              ) : null}
            </div>
          </FormSection>

          {editing && isSelf(editing) ? null : (
            <Toggle
              checked={form.is_active}
              onChange={(v) => setForm({ is_active: v })}
              label="Hisob faol"
              description={form.is_active ? "Admin tizimga kira oladi" : "Admin tizimga kira olmaydi"}
            />
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        variant={toggleTarget?.is_active ? "danger" : "primary"}
        title={toggleTarget?.is_active ? "Adminni deaktiv qilish" : "Adminni faollashtirish"}
        description={
          toggleTarget ? (
            toggleTarget.is_active ? (
              <>
                <strong>{adminName(toggleTarget)}</strong> tizimga kira olmaydi va admin amallarini bajara olmaydi.
              </>
            ) : (
              <>
                <strong>{adminName(toggleTarget)}</strong> qayta faollashtiriladi va tizimga kirish huquqini oladi.
              </>
            )
          ) : null
        }
        confirmText={toggleTarget?.is_active ? "Deaktiv qilish" : "Faollashtirish"}
        busy={busyToggle}
        onConfirm={() => void handleToggleStatus()}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}
