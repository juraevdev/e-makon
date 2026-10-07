"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage, fetchAll } from "@/lib/api/client";
import type { Order, User } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/domain";
import { formatDate, formatMoney, formatPhone, initials, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

const PAGE_SIZE = 15;
const emptyForm = { phone: "+998", first_name: "", last_name: "", home_address: "" };

type Segment = "all" | "new" | "returning" | "active" | "inactive";

const SEGMENTS: { id: Segment; label: string; icon: string; hint: string }[] = [
  { id: "all", label: "Barcha mijozlar", icon: "groups", hint: "Eng yangi qo'shilganlar birinchi" },
  { id: "new", label: "Yangi", icon: "fiber_new", hint: "So'nggi 30 kunda kelgan" },
  { id: "returning", label: "Doimiy", icon: "autorenew", hint: "2 va undan ko'p buyurtma" },
  { id: "active", label: "Eng faol", icon: "local_fire_department", hint: "Buyurtma soni va summasi bo'yicha" },
  { id: "inactive", label: "Uzoq kelmagan", icon: "bedtime", hint: "90 kundan beri buyurtma yo'q" },
];

const SORTS = [
  { id: "", label: "Segment tartibi" },
  { id: "-orders_count_anno", label: "Buyurtma soni ↓" },
  { id: "-total_spent_anno", label: "Sarflagan summa ↓" },
  { id: "-last_order_at_anno", label: "Oxirgi buyurtma ↓" },
  { id: "-date_joined", label: "Ro'yxatdan o'tgan ↓" },
];

export default function MijozlarPage() {
  const router = useRouter();
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState<Segment>("all");
  const [ordering, setOrdering] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const params = {
    segment: segment === "all" ? undefined : segment,
    search: query || undefined,
    ordering: ordering || undefined,
  };

  const { data, loading, error, reload } = useAsync(
    async () => asPage<User>(await api("/admin/customers/", { query: { ...params, page, page_size: PAGE_SIZE } })),
    [page, query, segment, ordering],
    { keepPrevious: true },
  );

  const { data: counts, reload: reloadCounts } = useAsync(
    () => api<Record<Segment, number>>("/admin/customers/segments/", { query: { search: query || undefined } }),
    [query],
  );

  const { data: history, loading: historyLoading } = useAsync(async () => {
    if (!detail) return [];
    return asPage<Order>(await api("/admin/orders/", { query: { customer: detail.id, page_size: 20 } })).results;
  }, [detail?.id]);

  async function createUser() {
    setBusy(true);
    try {
      await api("/admin/customers/", { method: "POST", body: form });
      setOpen(false);
      setForm(emptyForm);
      showSuccess("Mijoz qo'shildi");
      await Promise.all([reload(), reloadCounts()]);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function openChat(u: User) {
    try {
      const room = await api<{ id: number }>("/admin/chats/open/", { method: "POST", body: { customer_id: u.id } });
      router.push(`/aloqa?room=${room.id}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Suhbat ochilmadi");
    }
  }

  async function exportTable() {
    try {
      const list = await fetchAll<User>("/admin/customers/", params);
      downloadCsv(
        `mijozlar-${segment}-${new Date().toISOString().slice(0, 10)}`,
        ["ID", "F.I.Sh", "Telefon", "Manzil", "Buyurtmalar", "Sarflagan (UZS)", "Birinchi buyurtma", "Oxirgi buyurtma", "Ro'yxatdan o'tgan"],
        list.map((u) => [
          u.id,
          u.full_name,
          u.phone,
          u.formatted_address || u.home_address,
          u.orders_count ?? 0,
          Number(u.total_spent ?? 0),
          u.first_order_at ? formatDate(u.first_order_at) : "",
          u.last_order_at ? formatDate(u.last_order_at) : "",
          formatDate(u.date_joined),
        ]),
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Eksport bo'lmadi");
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const current = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Firmangiz mijozlar bazasi: yangi va oldingi mijozlar, doimiylar va eng faollar. Har bir mijoz bilan alohida suhbat
          xonasi orqali yozishishingiz mumkin.
        </p>
        <div className="flex gap-2">
          <SecondaryButton icon="download" onClick={() => void exportTable()}>
            CSV
          </SecondaryButton>
          <PrimaryButton icon="person_add" onClick={() => setOpen(true)}>
            Mijoz qo&apos;shish
          </PrimaryButton>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSegment(s.id);
              setPage(1);
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              segment === s.id ? "border-primary bg-primary/10" : "border-[#26352c] bg-[#141816] hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`material-symbols-outlined ${segment === s.id ? "text-primary" : "text-on-surface-variant"}`}>
                {s.icon}
              </span>
              <span className="text-xl font-bold">{counts?.[s.id] ?? "—"}</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{s.label}</p>
            <p className="text-[11px] text-on-surface-variant">{s.hint}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          <b className="text-on-surface">{current.label}</b> · {data?.count ?? 0} ta
        </p>
        <select
          className="rounded-xl border border-[#26352c] bg-[#121614] px-3 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none"
          value={ordering}
          onChange={(e) => {
            setOrdering(e.target.value);
            setPage(1);
          }}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !data?.results.length ? (
        <EmptyState icon="group" title="Mijozlar yo'q" description="Bu segmentda hozircha mijoz yo'q." />
      ) : (
        <DataTable
          headers={["", "Mijoz", "Telefon", "Buyurtmalar", "Sarflagan", "Birinchi / oxirgi", "Holat", ""]}
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
          {data.results.map((u, idx) => {
            const rank = segment === "active" && page === 1 ? idx + 1 : null;
            return (
              <tr key={u.id} className="cursor-pointer border-b border-[#26352c]/30 hover:bg-white/5" onClick={() => setDetail(u)}>
                <td className="px-4 py-3 text-center">
                  <div className="relative inline-block">
                    <Avatar initials={initials(u.full_name || u.phone)} tone={u.is_active ? "primary" : "error"} />
                    {rank && rank <= 3 ? (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-black">
                        {rank}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{u.full_name || "Ism kiritilmagan"}</p>
                  <p className="max-w-[240px] truncate text-xs text-on-surface-variant">{u.formatted_address || u.home_address || "—"}</p>
                </td>
                <td className="px-4 py-3 font-mono text-[13px] text-on-surface-variant">{formatPhone(u.phone)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-primary/25 bg-[#173822]/80 px-3 py-1 text-[12px] font-semibold text-primary">
                    {u.orders_count ?? 0} ta
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold">{formatMoney(u.total_spent ?? 0)}</td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant xl:table-cell">
                  {formatDate(u.first_order_at)} / {formatDate(u.last_order_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill variant={u.is_active ? "success" : "error"}>{u.is_active ? "Faol" : "Bloklangan"}</StatusPill>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openChat(u);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    Yozish
                  </button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal open={open} title="Yangi mijoz" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Telefon" required>
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
          <PrimaryButton disabled={busy || form.phone.length < 9} onClick={() => void createUser()}>
            Saqlash
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={!!detail} title={detail?.full_name || "Mijoz kartasi"} onClose={() => setDetail(null)} wide>
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {[
                ["Buyurtmalar", `${detail.orders_count ?? 0} ta`],
                ["Sarflagan", formatMoney(detail.total_spent ?? 0)],
                ["Birinchi buyurtma", formatDate(detail.first_order_at)],
                ["Oxirgi buyurtma", formatDate(detail.last_order_at)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#26352c] bg-[#0e1210] p-3">
                  <p className="text-[11px] text-on-surface-variant">{label}</p>
                  <p className="font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              <p>
                Telefon:{" "}
                <a className="text-primary hover:underline" href={`tel:${detail.phone}`}>
                  {formatPhone(detail.phone)}
                </a>
              </p>
              <p>Manzil: {detail.formatted_address || detail.home_address || "—"}</p>
              <p>Hudud: {[detail.region, detail.district].filter(Boolean).join(", ") || "—"}</p>
              <p>Ro&apos;yxatdan o&apos;tgan: {formatDate(detail.date_joined)}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Firmangizdagi buyurtmalari</p>
              {historyLoading ? (
                <LoadingBlock />
              ) : history?.length ? (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {history.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2 text-xs">
                      <div>
                        <p className="font-semibold">#{o.id} · {o.service_name}</p>
                        <p className="text-on-surface-variant">{formatDate(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <StatusPill variant={ORDER_STATUS_TONE[o.status]}>{o.work_stage_label || ORDER_STATUS_LABEL[o.status]}</StatusPill>
                        <p className="mt-1 font-semibold">{formatMoney(o.quoted_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">Hali buyurtma bermagan.</p>
              )}
            </div>
            <div className="flex justify-end">
              <PrimaryButton icon="chat" onClick={() => void openChat(detail)}>
                Suhbat xonasini ochish
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
