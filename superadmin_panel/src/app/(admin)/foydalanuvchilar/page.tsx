"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  DataTable,
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  Modal,
  Pagination,
  PrimaryButton,
  RowActions,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { formatDate, formatPhone, initials, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

export default function FoydalanuvchilarPage() {
  const { query } = useSearch();
  const [tab, setTab] = useState<"all" | "active" | "blocked">("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<User | null>(null);
  const [form, setForm] = useState({ phone: "", first_name: "", last_name: "", home_address: "" });
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/customers/", {
      query: {
        page,
        page_size: 10,
        search: query || undefined,
        is_active: tab === "all" ? undefined : tab === "active",
      },
    });
    return asPage<User>(raw);
  }, [page, query, tab]);

  const counts = useMemo(() => ({
    all: data?.count ?? 0,
  }), [data]);

  async function createUser() {
    setBusy(true);
    try {
      await api("/admin/customers/", { method: "POST", body: form });
      setOpen(false);
      setForm({ phone: "", first_name: "", last_name: "", home_address: "" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock(user: User) {
    await api(`/admin/customers/${user.id}/${user.is_active ? "block" : "unblock"}/`, { method: "POST" });
    await reload();
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / 10));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="relative inline-flex items-center gap-1.5 rounded-xl border border-[#26352c] bg-[#0e1211] p-1.5">
          {([
            { id: "all" as const, label: "Barchasi" },
            { id: "active" as const, label: "Faol" },
            { id: "blocked" as const, label: "Bloklangan" },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setPage(1); }}
              className={`rounded-lg px-4 py-2.5 text-[13px] font-medium ${
                tab === t.id ? "bg-[#173822] font-bold text-primary" : "text-on-surface-variant"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <PrimaryButton icon="person_add" onClick={() => setOpen(true)}>
          Mijoz qo&apos;shish
        </PrimaryButton>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !data?.results.length ? (
        <EmptyState icon="group" title="Mijozlar yo'q" description="Mobil ilovadan OTP orqali kirgan foydalanuvchilar shu yerda." />
      ) : (
        <DataTable
          headers={["Avatar", "Ism", "Telefon", "Manzil", "Ball", "Ro'yxatdan o'tgan", "Holat", "Amallar"]}
          footer={
            <Pagination
              current={page}
              pages={pageNumbers(page, totalPages)}
              onPageChange={setPage}
              info={
                <>
                  Jami <strong className="text-primary">{counts.all}</strong> ta mijoz
                </>
              }
            />
          }
        >
          {data.results.map((u) => (
            <tr key={u.id} className={`border-b border-[#26352c]/30 ${u.is_active ? "" : "bg-[#1c1415]/40"}`}>
              <td className="px-4 py-4 text-center">
                <Avatar initials={initials(u.full_name || u.phone)} tone={u.is_active ? "primary" : "error"} />
              </td>
              <td className="px-4 py-4 font-semibold text-white">{u.full_name || "Ism kiritilmagan"}</td>
              <td className="px-4 py-4 font-mono text-[13px] text-on-surface-variant">{formatPhone(u.phone)}</td>
              <td className="hidden px-4 py-4 text-[13px] text-on-surface-variant md:table-cell">
                {u.formatted_address || u.home_address || "—"}
              </td>
              <td className="px-4 py-4">
                <span className="rounded-full border border-primary/25 bg-[#173822]/80 px-3 py-1 text-[12px] font-semibold text-primary">
                  {u.loyalty_points} ball
                </span>
              </td>
              <td className="hidden px-4 py-4 text-[13px] text-on-surface-variant xl:table-cell">{formatDate(u.date_joined)}</td>
              <td className="px-4 py-4 text-center">
                <StatusPill variant={u.is_active ? "success" : "error"} pulse={u.is_active}>
                  {u.is_active ? "FAOL" : "BLOKLANGAN"}
                </StatusPill>
              </td>
              <td className="px-4 py-4 text-right">
                <RowActions
                  actions={u.is_active ? ["visibility", "block"] : ["visibility", "lock_open"]}
                  onAction={(a) => {
                    if (a === "visibility") setDetail(u);
                    if (a === "block" || a === "lock_open") void toggleBlock(u);
                  }}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={open} title="Yangi mijoz" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Telefon">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Ism">
            <input className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Familiya">
            <input className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Manzil">
            <input className={inputClass} value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
          </Field>
          <PrimaryButton disabled={busy || !form.phone} onClick={() => void createUser()}>
            Saqlash
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={!!detail} title={detail?.full_name || "Mijoz"} onClose={() => setDetail(null)}>
        {detail ? (
          <div className="space-y-2 text-sm">
            <p>Telefon: {formatPhone(detail.phone)}</p>
            <p>Manzil: {detail.formatted_address || detail.home_address || "—"}</p>
            <p>Ball: {detail.loyalty_points}</p>
            <p>Buyurtmalar: {detail.orders_count ?? 0}</p>
            <p>Hudud: {[detail.region, detail.district].filter(Boolean).join(", ") || "—"}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
