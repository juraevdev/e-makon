"use client";

import { useState, type ReactNode } from "react";
import {
  Avatar,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ExcelButton,
  Field,
  inputClass,
  LiveBadge,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatDateTime, formatMoney, formatPhone, initials, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage, fetchAllPages } from "@/components/people/api";
import { ErrorPanel, FieldError, SearchBox, errorRing, isValidUzPhone, normalizeUzPhone } from "@/components/people/form";
import type { UserWithOrg } from "@/components/people/types";

const PAGE_SIZE = 10;
type Tab = "all" | "active" | "blocked";
const emptyForm = { phone: "+998", first_name: "", last_name: "", home_address: "" };

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#26352c] bg-[#0d100f] px-3.5 py-2.5">
      <p className="text-[11px] text-on-surface-variant">{label}</p>
      <div className="mt-0.5 break-words text-sm font-medium text-on-surface">{children}</div>
    </div>
  );
}

export default function FoydalanuvchilarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<UserWithOrg | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [phoneError, setPhoneError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockTarget, setBlockTarget] = useState<UserWithOrg | null>(null);
  const [busyBlock, setBusyBlock] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filterQuery = {
    search: query || undefined,
    is_active: tab === "all" ? undefined : tab === "active",
  };

  const { data, loading, error, reload, updatedAt } = useAsync(
    async () => asPage<UserWithOrg>(await api("/admin/customers/", { query: { ...filterQuery, page, page_size: PAGE_SIZE } })),
    [page, query, tab],
    { keepPrevious: true },
  );

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  async function createUser() {
    if (!isValidUzPhone(form.phone)) {
      setPhoneError("Telefon +998 XX XXX XX XX formatida bo'lsin");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/customers/", {
        method: "POST",
        body: {
          phone: normalizeUzPhone(form.phone),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          home_address: form.home_address.trim(),
        },
      });
      showSuccess("Mijoz qo'shildi");
      setOpen(false);
      setForm(emptyForm);
      await reload();
    } catch (e) {
      showError(errorMessage(e, "Mijozni qo'shib bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!blockTarget) return;
    setBusyBlock(true);
    try {
      await api(`/admin/customers/${blockTarget.id}/${blockTarget.is_active ? "block" : "unblock"}/`, { method: "POST" });
      showSuccess(blockTarget.is_active ? "Mijoz bloklandi" : "Mijoz blokdan chiqarildi");
      setBlockTarget(null);
      await reload();
    } catch (e) {
      showError(errorMessage(e, "Amalni bajarib bo'lmadi"));
    } finally {
      setBusyBlock(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const rows = await fetchAllPages<UserWithOrg>("/admin/customers/", filterQuery);
      downloadExcel("mijozlar", {
        name: "Mijozlar",
        headers: ["ID", "F.I.Sh.", "Telefon", "Email", "Manzil", "Hudud", "Ball", "Buyurtmalar", "Jami xarid", "Oxirgi buyurtma", "Ro'yxatdan o'tgan", "Holat"],
        rows: rows.map((u) => [
          u.id,
          u.full_name || "",
          formatPhone(u.phone),
          u.email || "",
          u.formatted_address || u.home_address || "",
          [u.region, u.district].filter(Boolean).join(", "),
          u.loyalty_points ?? 0,
          u.orders_count ?? 0,
          u.total_spent ?? "",
          u.last_order_at ? formatDateTime(u.last_order_at) : "",
          formatDate(u.date_joined),
          u.is_active ? "Faol" : "Bloklangan",
        ]),
      });
    } catch (e) {
      showError(errorMessage(e, "Excel faylni tayyorlab bo'lmadi"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <PageHeader
        title="Mijozlar"
        description="Mobil ilova va Telegram orqali ro'yxatdan o'tgan foydalanuvchilar"
        actions={
          <>
            <LiveBadge updatedAt={updatedAt || undefined} />
            <ExcelButton onClick={() => void exportExcel()} disabled={exporting || !data?.count} label={exporting ? "Tayyorlanmoqda..." : "Excel"} />
            <PrimaryButton
              icon="person_add"
              onClick={() => {
                setForm(emptyForm);
                setPhoneError("");
                setOpen(true);
              }}
            >
              Mijoz qo&apos;shish
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#26352c] bg-[#121614]/80 p-3 sm:p-4 lg:flex-row lg:items-center">
        <TabBar
          className="lg:shrink-0"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setPage(1);
          }}
          tabs={[
            { id: "all", label: "Barchasi", icon: "groups", count: tab === "all" ? data?.count : undefined },
            { id: "active", label: "Faol", icon: "check_circle", count: tab === "active" ? data?.count : undefined },
            { id: "blocked", label: "Bloklangan", icon: "block", count: tab === "blocked" ? data?.count : undefined },
          ]}
        />
        <SearchBox placeholder="Ism yoki telefon..." className="lg:flex-1" />
      </div>

      {loading && !data ? (
        <LoadingBlock />
      ) : error && !data ? (
        <ErrorPanel title="Mijozlarni yuklab bo'lmadi" message={error} onRetry={() => void reload()} />
      ) : !data?.results.length ? (
        <EmptyState icon="group" title="Mijozlar yo'q" description="Mobil ilovadan OTP orqali kirgan foydalanuvchilar shu yerda ko'rinadi." />
      ) : (
        <DataTable
          headers={["", "Ism", "Telefon", "Manzil", "Buyurtma", "Ball", "Ro'yxatdan o'tgan", "Holat", ""]}
          footer={
            <Pagination
              current={page}
              pages={pageNumbers(page, totalPages)}
              onPageChange={setPage}
              info={
                <>
                  Jami <strong className="text-primary">{data.count}</strong> ta mijoz
                </>
              }
            />
          }
        >
          {data.results.map((u) => (
            <tr key={u.id} className={`transition-colors hover:bg-[#18211b]/50 ${u.is_active ? "" : "bg-[#1c1415]/40"}`}>
              <td className="px-4 py-3">
                <Avatar initials={initials(u.full_name || u.phone)} tone={u.is_active ? "primary" : "error"} />
              </td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap text-white">{u.full_name || "Ism kiritilmagan"}</td>
              <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap text-on-surface-variant">{formatPhone(u.phone)}</td>
              <td className="max-w-[260px] truncate px-4 py-3 text-[13px] text-on-surface-variant">
                {u.formatted_address || u.home_address || "—"}
              </td>
              <td className="px-4 py-3 text-[13px] font-semibold text-on-surface">{u.orders_count ?? 0}</td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-primary/25 bg-[#173822]/80 px-3 py-1 text-[12px] font-semibold whitespace-nowrap text-primary">
                  {u.loyalty_points} ball
                </span>
              </td>
              <td className="px-4 py-3 text-[13px] whitespace-nowrap text-on-surface-variant">{formatDate(u.date_joined)}</td>
              <td className="px-4 py-3">
                <StatusPill variant={u.is_active ? "success" : "error"} pulse={u.is_active}>
                  {u.is_active ? "Faol" : "Bloklangan"}
                </StatusPill>
              </td>
              <td className="px-4 py-3 text-right">
                <RowActions
                  actions={u.is_active ? ["visibility", "block"] : ["visibility", "lock_open"]}
                  onAction={(a) => {
                    if (a === "visibility") setDetail(u);
                    if (a === "block" || a === "lock_open") setBlockTarget(u);
                  }}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal
        open={open}
        size="md"
        title="Yangi mijoz"
        description="Mijoz keyin mobil ilovaga shu telefon raqami bilan kira oladi"
        onClose={() => setOpen(false)}
        footer={
          <>
            <SecondaryButton onClick={() => setOpen(false)} className="justify-center">
              Bekor qilish
            </SecondaryButton>
            <PrimaryButton icon="person_add" disabled={busy} onClick={() => void createUser()} className="justify-center">
              {busy ? "Saqlanmoqda..." : "Saqlash"}
            </PrimaryButton>
          </>
        }
      >
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void createUser();
          }}
        >
          <Field label="Telefon" required className="sm:col-span-2" hint={<FieldError message={phoneError} />}>
            <input
              type="tel"
              inputMode="tel"
              autoFocus
              className={inputClass + errorRing(phoneError)}
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                setPhoneError("");
              }}
            />
          </Field>
          <Field label="Ism">
            <input className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Familiya">
            <input className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Manzil" className="sm:col-span-2">
            <input className={inputClass} value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
          </Field>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        open={!!detail}
        size="md"
        title={detail?.full_name || "Mijoz"}
        description={detail ? formatPhone(detail.phone) : undefined}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DetailItem label="Holat">
              <StatusPill variant={detail.is_active ? "success" : "error"}>{detail.is_active ? "Faol" : "Bloklangan"}</StatusPill>
            </DetailItem>
            <DetailItem label="Ball">{detail.loyalty_points}</DetailItem>
            <DetailItem label="Buyurtmalar">{detail.orders_count ?? 0}</DetailItem>
            <DetailItem label="Jami xarid">{detail.total_spent != null ? formatMoney(detail.total_spent) : "—"}</DetailItem>
            <DetailItem label="Oxirgi buyurtma">{detail.last_order_at ? formatDateTime(detail.last_order_at) : "—"}</DetailItem>
            <DetailItem label="Ro'yxatdan o'tgan">{formatDate(detail.date_joined)}</DetailItem>
            <DetailItem label="Email">{detail.email || "—"}</DetailItem>
            <DetailItem label="Telegram">{detail.telegram_username ? `@${detail.telegram_username}` : "—"}</DetailItem>
            <div className="sm:col-span-2">
              <DetailItem label="Manzil">{detail.formatted_address || detail.home_address || "—"}</DetailItem>
            </div>
            <div className="sm:col-span-2">
              <DetailItem label="Hudud">{[detail.region, detail.district].filter(Boolean).join(", ") || "—"}</DetailItem>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!blockTarget}
        variant={blockTarget?.is_active ? "danger" : "primary"}
        title={blockTarget?.is_active ? "Mijozni bloklash" : "Blokdan chiqarish"}
        description={
          blockTarget ? (
            <>
              <strong>{blockTarget.full_name || formatPhone(blockTarget.phone)}</strong>{" "}
              {blockTarget.is_active ? "ilovaga kira olmaydi va buyurtma bera olmaydi." : "qayta ilovadan foydalana oladi."}
            </>
          ) : null
        }
        confirmText={blockTarget?.is_active ? "Bloklash" : "Blokdan chiqarish"}
        busy={busyBlock}
        onConfirm={() => void toggleBlock()}
        onCancel={() => setBlockTarget(null)}
      />
    </div>
  );
}
