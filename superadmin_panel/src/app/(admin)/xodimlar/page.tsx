"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Avatar,
  Breadcrumbs,
  DataTable,
  EmptyState,
  ExcelButton,
  LiveBadge,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
  TableSkeleton,
} from "@/components/ui";
import { downloadExcel } from "@/lib/excel";
import { SPECIALTY_LABEL } from "@/lib/domain";
import { formatDate, formatPhone, initials, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { fetchAllPages, useFirmOptions } from "@/components/people/api";
import { EmployeeFormModal } from "@/components/people/EmployeeFormModal";
import { EMPLOYMENT_META, EmployeeStatusDialog, employmentStatus } from "@/components/people/EmployeeStatusDialog";
import { ErrorPanel, MiniStat, SearchBox, SelectFilter, ViewToggle } from "@/components/people/form";
import type { EmployeeFull, EmploymentStatus } from "@/components/people/types";

const PAGE_SIZE = 15;
type StatusFilter = "all" | EmploymentStatus;

type RowProps = {
  emp: EmployeeFull;
  firm: string;
  onEdit: () => void;
  onStatus: () => void;
};

function specialtyOf(emp: EmployeeFull) {
  return emp.specialty_label || SPECIALTY_LABEL[emp.specialty] || emp.specialty;
}

function StatusBadge({ emp }: { emp: EmployeeFull }) {
  const s = employmentStatus(emp);
  return (
    <StatusPill variant={EMPLOYMENT_META[s].tone} pulse={s === "active"}>
      {EMPLOYMENT_META[s].label}
    </StatusPill>
  );
}

function FirmCell({ emp, firm }: { emp: EmployeeFull; firm: string }) {
  const id = emp.user.organization_id;
  if (id === null || id === undefined) return <span className="text-on-surface-variant">Biriktirilmagan</span>;
  return (
    <Link href={`/firmalar/${id}`} className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
      <span className="material-symbols-outlined text-[14px]">storefront</span>
      <span className="truncate">{firm}</span>
    </Link>
  );
}

function Actions({ onEdit, onStatus }: Pick<RowProps, "onEdit" | "onStatus">) {
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
        onClick={onStatus}
        className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] bg-[#121614] px-2.5 py-1.5 text-xs font-medium text-on-surface transition-all hover:border-amber-500/50 hover:text-amber-300"
      >
        <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
        Holat
      </button>
    </div>
  );
}

function EmployeeRow({ emp, firm, onEdit, onStatus }: RowProps) {
  return (
    <tr className="transition-colors hover:bg-[#18211b]/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <Avatar initials={initials(emp.user.full_name || emp.user.phone)} tone={emp.is_active ? "primary" : "neutral"} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{emp.user.full_name || "Ism kiritilmagan"}</p>
            <p className="font-mono text-xs text-on-surface-variant">{formatPhone(emp.user.phone)}</p>
          </div>
        </div>
      </td>
      <td className="max-w-[180px] px-4 py-3 text-xs">
        <FirmCell emp={emp} firm={firm} />
      </td>
      <td className="px-4 py-3 text-xs">
        <p className="font-medium text-on-surface">{emp.position || "—"}</p>
        <p className="text-on-surface-variant">{specialtyOf(emp)}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs">
        <span className="font-semibold text-sky-300">{emp.active_orders ?? 0}</span>
        <span className="text-on-surface-variant"> faol · </span>
        <span className="font-semibold text-primary">{emp.completed_orders ?? 0}</span>
        <span className="text-on-surface-variant"> bajarilgan</span>
      </td>
      <td className="px-4 py-3 text-xs font-semibold text-amber-300">★ {Number(emp.rating || 0).toFixed(1)}</td>
      <td className="px-4 py-3">
        <StatusBadge emp={emp} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">{formatDate(emp.hired_at || emp.created_at)}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <Actions onEdit={onEdit} onStatus={onStatus} />
      </td>
    </tr>
  );
}

function EmployeeCard({ emp, firm, onEdit, onStatus }: RowProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-gradient-to-b from-[#151a18] to-[#101412] p-5 transition hover:border-primary/50 ${
        emp.is_active ? "border-primary-container/35" : "border-[#3a2a2b]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Avatar initials={initials(emp.user.full_name || emp.user.phone)} tone={emp.is_active ? "primary" : "neutral"} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-on-surface">{emp.user.full_name || "Ism kiritilmagan"}</h3>
          <p className="truncate text-xs text-on-surface-variant">
            {emp.position ? `${emp.position} · ` : ""}
            {specialtyOf(emp)}
          </p>
        </div>
        <StatusBadge emp={emp} />
      </div>
      <div className="space-y-1.5 text-xs">
        <p className="flex items-center gap-2 font-mono text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-primary">call</span>
          {formatPhone(emp.user.phone)}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <FirmCell emp={emp} firm={firm} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-black/10 p-2 text-center text-xs">
        <div>
          <p className="text-on-surface-variant">Reyting</p>
          <p className="font-bold text-amber-300">★ {Number(emp.rating || 0).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Faol</p>
          <p className="font-bold text-sky-300">{emp.active_orders ?? 0}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Bajarilgan</p>
          <p className="font-bold text-primary">{emp.completed_orders ?? 0}</p>
        </div>
      </div>
      {emp.skills?.length ? (
        <div className="flex flex-wrap gap-1">
          {emp.skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-md border border-[#26352c] bg-[#0d100f] px-1.5 py-0.5 text-[10px] text-on-surface-variant">
              {s}
            </span>
          ))}
          {emp.skills.length > 4 ? <span className="text-[10px] text-on-surface-variant">+{emp.skills.length - 4}</span> : null}
        </div>
      ) : null}
      <div className="mt-auto border-t border-white/5 pt-3">
        <Actions onEdit={onEdit} onStatus={onStatus} />
      </div>
    </div>
  );
}

export default function XodimlarPage() {
  const { query } = useSearch();
  const { firms, firmName } = useFirmOptions();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [specialty, setSpecialty] = useState("all");
  const [firmFilter, setFirmFilter] = useState("all");
  const [view, setView] = useState<"grid" | "table">("table");

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<EmployeeFull | null>(null);
  const [statusTarget, setStatusTarget] = useState<EmployeeFull | null>(null);

  const { data, loading, error, reload, updatedAt } = useAsync(
    () =>
      fetchAllPages<EmployeeFull>("/admin/employees/", {
        search: query || undefined,
        specialty: specialty === "all" ? undefined : specialty,
      }),
    [query, specialty],
    { keepPrevious: true },
  );
  const all = useMemo(() => data ?? [], [data]);

  const firmScoped = useMemo(
    () => (firmFilter === "all" ? all : all.filter((e) => String(e.user.organization_id ?? "") === firmFilter)),
    [all, firmFilter],
  );

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: firmScoped.length, active: 0, on_leave: 0, dismissed: 0 };
    for (const e of firmScoped) c[employmentStatus(e)]++;
    return c;
  }, [firmScoped]);

  const filtered = useMemo(
    () => (status === "all" ? firmScoped : firmScoped.filter((e) => employmentStatus(e) === status)),
    [firmScoped, status],
  );

  const avgRating = useMemo(() => {
    const rated = firmScoped.filter((e) => Number(e.rating) > 0);
    if (!rated.length) return "—";
    return (rated.reduce((s, e) => s + Number(e.rating), 0) / rated.length).toFixed(1);
  }, [firmScoped]);

  const firmsWithStaff = useMemo(() => {
    const ids = new Map<number, number>();
    for (const e of all) {
      const id = e.user.organization_id;
      if (id !== null && id !== undefined) ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    return ids;
  }, [all]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = status !== "all" || specialty !== "all" || firmFilter !== "all" || !!query;

  function openCreate() {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(emp: EmployeeFull) {
    setEditing(emp);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function pickStatus(s: StatusFilter) {
    setStatus(s);
    setPage(1);
  }

  function exportExcel() {
    downloadExcel("xodimlar", {
      name: "Xodimlar",
      headers: [
        "ID",
        "F.I.Sh.",
        "Telefon",
        "Firma",
        "Lavozim",
        "Mutaxassislik",
        "Holat",
        "Reyting",
        "Faol buyurtma",
        "Bajarilgan",
        "Ishga olingan",
        "Tug'ilgan sana",
        "Manzil",
        "Favqulodda tel.",
        "Ko'nikmalar",
        "Izoh",
      ],
      rows: filtered.map((e) => [
        e.id,
        e.user.full_name || "",
        formatPhone(e.user.phone),
        firmName(e.user.organization_id),
        e.position || "",
        specialtyOf(e),
        EMPLOYMENT_META[employmentStatus(e)].label,
        Number(e.rating || 0),
        e.active_orders ?? 0,
        e.completed_orders ?? 0,
        e.hired_at ? formatDate(e.hired_at) : "",
        e.birth_date ? formatDate(e.birth_date) : "",
        e.address || "",
        e.emergency_phone ? formatPhone(e.emergency_phone) : "",
        (e.skills ?? []).join(", "),
        e.notes || "",
      ]),
    });
  }

  const rowProps = (e: EmployeeFull): RowProps => ({
    emp: e,
    firm: firmName(e.user.organization_id),
    onEdit: () => openEdit(e),
    onStatus: () => setStatusTarget(e),
  });

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[#26352c]/40 pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Xodimlar" }]} />
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">Xodimlar boshqaruvi</h2>
            <LiveBadge updatedAt={updatedAt || undefined} />
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant md:text-sm">
            Barcha firmalardagi mutaxassislar, ularning holati va ish yuklamasi
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ExcelButton onClick={exportExcel} disabled={!filtered.length} />
          <PrimaryButton icon="person_add" onClick={openCreate}>
            Yangi xodim
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon="groups" label="Jami xodimlar" value={counts.all} hint={`${firmsWithStaff.size} ta firmada`} active={status === "all"} onClick={() => pickStatus("all")} />
        <MiniStat icon="engineering" label="Ishda" value={counts.active} hint={`O'rtacha reyting ★ ${avgRating}`} active={status === "active"} onClick={() => pickStatus("active")} />
        <MiniStat icon="beach_access" label="Ta'tilda" value={counts.on_leave} tone="amber" active={status === "on_leave"} onClick={() => pickStatus("on_leave")} />
        <MiniStat icon="person_off" label="Ishdan bo'shagan" value={counts.dismissed} tone="error" active={status === "dismissed"} onClick={() => pickStatus("dismissed")} />
      </div>

      <div className="space-y-3 rounded-2xl border border-[#26352c] bg-[#121614]/80 p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchBox placeholder="Ism, telefon yoki lavozim..." className="lg:flex-1" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
            <SelectFilter
              label="Firma"
              icon="storefront"
              value={firmFilter}
              onChange={(v) => {
                setFirmFilter(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Barcha firmalar" },
                ...firms.map((f) => ({
                  value: String(f.id),
                  label: firmsWithStaff.get(f.id) ? `${f.name} (${firmsWithStaff.get(f.id)})` : f.name,
                })),
              ]}
              className="lg:w-60"
            />
            <SelectFilter
              label="Mutaxassislik"
              icon="category"
              value={specialty}
              onChange={(v) => {
                setSpecialty(v);
                setPage(1);
              }}
              options={[{ value: "all", label: "Barcha mutaxassisliklar" }, ...Object.entries(SPECIALTY_LABEL).map(([value, label]) => ({ value, label }))]}
              className="lg:w-56"
            />
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <TabBar
          value={status}
          onChange={pickStatus}
          tabs={[
            { id: "all", label: "Barchasi", icon: "list", count: counts.all },
            { id: "active", label: "Ishda", icon: "check_circle", count: counts.active },
            { id: "on_leave", label: "Ta'tilda", icon: "beach_access", count: counts.on_leave },
            { id: "dismissed", label: "Bo'shagan", icon: "person_off", count: counts.dismissed },
          ]}
        />
      </div>

      {loading && !data ? (
        <TableSkeleton rows={6} cols={7} />
      ) : error && !data ? (
        <ErrorPanel title="Xodimlarni yuklab bo'lmadi" message={error} onRetry={() => void reload()} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="engineering"
            title={hasFilters ? "Mos xodim topilmadi" : "Hali xodim yo'q"}
            description={hasFilters ? "Qidiruv yoki filtrlarni o'zgartirib ko'ring." : "Birinchi xodimni qo'shing."}
            action={
              hasFilters ? (
                <SecondaryButton
                  icon="filter_alt_off"
                  onClick={() => {
                    setStatus("all");
                    setSpecialty("all");
                    setFirmFilter("all");
                    setPage(1);
                  }}
                >
                  Filtrlarni tozalash
                </SecondaryButton>
              ) : (
                <PrimaryButton icon="person_add" onClick={openCreate}>
                  Yangi xodim qo&apos;shish
                </PrimaryButton>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className={view === "table" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden" : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
            {visible.map((e) => (
              <EmployeeCard key={e.id} {...rowProps(e)} />
            ))}
          </div>
          {view === "table" ? (
            <div className="hidden md:block">
              <DataTable headers={["Xodim", "Firma", "Lavozim", "Buyurtmalar", "Reyting", "Holat", "Ishga olingan", ""]}>
                {visible.map((e) => (
                  <EmployeeRow key={e.id} {...rowProps(e)} />
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
                  <strong className="text-primary">{filtered.length}</strong> ta xodim
                  {filtered.length !== all.length ? ` (yuklangan ${all.length})` : ""}
                </>
              }
            />
          </div>
        </>
      )}

      <EmployeeFormModal
        key={`form-${formKey}`}
        open={formOpen}
        employee={editing}
        firmName={firmName}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />
      <EmployeeStatusDialog
        key={`status-${statusTarget?.id ?? 0}`}
        employee={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSaved={reload}
      />
    </div>
  );
}
