"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  ExcelButton,
  inputClass,
  LiveBadge,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { BannerFormModal, PLACEMENT_LABEL } from "@/components/catalog/BannerFormModal";
import { fetchAll, todayStamp } from "@/components/catalog/fetchAll";
import { api } from "@/lib/api/client";
import type { Banner, BannerStatus, Service } from "@/lib/api/types";
import { BANNER_STATUS_LABEL } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/providers/ToastProvider";

type StatusTab = "all" | BannerStatus;

const STATUS_TONE: Record<BannerStatus, "success" | "warning" | "neutral" | "info"> = {
  active: "success",
  scheduled: "info",
  draft: "warning",
  archived: "neutral",
};

function isLive(b: Banner, now: number) {
  if (b.status !== "active" && b.status !== "scheduled") return false;
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return false;
  return true;
}

function dateRange(b: Banner) {
  if (!b.starts_at && !b.ends_at) return "Muddatsiz";
  return `${b.starts_at ? formatDateTime(b.starts_at) : "Hozirdan"} → ${b.ends_at ? formatDateTime(b.ends_at) : "muddatsiz"}`;
}

export default function BannerlarPage() {
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<StatusTab>("all");
  const [placement, setPlacement] = useState<"" | Banner["placement"]>("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, loading, error, reload, updatedAt } = useAsync(
    async () => (await fetchAll<Banner>("/admin/banners/", { ordering: "sort_order" }, 5)).results,
    [],
    { keepPrevious: true },
  );

  const { data: services } = useAsync(
    async () =>
      (await fetchAll<Service>("/admin/services/", { roots: 1 }, 3)).results
        .filter((s) => s.is_catalog_type)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
    { live: false },
  );

  const all = useMemo(() => data ?? [], [data]);
  const now = updatedAt;
  const needle = search.trim().toLowerCase();
  const base = all.filter(
    (b) =>
      (!placement || b.placement === placement) &&
      (!needle || `${b.title} ${b.description} ${b.service_name ?? ""}`.toLowerCase().includes(needle)),
  );
  const list = tab === "all" ? base : base.filter((b) => b.status === tab);
  const countOf = (st: StatusTab) => (st === "all" ? base.length : base.filter((b) => b.status === st).length);
  const liveCount = all.filter((b) => isLive(b, now)).length;

  function openForm(b: Banner | null) {
    setEditing(b);
    setFormOpen(true);
  }

  async function toggle(b: Banner) {
    const next: BannerStatus = b.status === "active" || b.status === "scheduled" ? "draft" : "active";
    setBusyId(b.id);
    try {
      await api(`/admin/banners/${b.id}/`, { method: "PATCH", body: { status: next } });
      showSuccess(next === "active" ? `"${b.title}" faollashtirildi` : `"${b.title}" ilovadan olindi`);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api(`/admin/banners/${deleting.id}/`, { method: "DELETE" });
      showSuccess("Banner o'chirildi");
      setDeleting(null);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  }

  function exportExcel() {
    downloadExcel(`bannerlar-${todayStamp()}`, {
      name: "Bannerlar",
      headers: ["ID", "Sarlavha", "Matn", "Joylashuv", "Holat", "Hozir ilovada", "Boshlanish", "Tugash", "Bog'langan xizmat", "Tartib", "Rasm", "Yaratilgan"],
      rows: list.map((b) => [
        b.id,
        b.title,
        b.description,
        PLACEMENT_LABEL[b.placement] ?? b.placement,
        BANNER_STATUS_LABEL[b.status] ?? b.status,
        isLive(b, now) ? "Ha" : "Yo'q",
        b.starts_at ? formatDateTime(b.starts_at) : "",
        b.ends_at ? formatDateTime(b.ends_at) : "",
        b.service_name ?? "",
        b.sort_order,
        b.image_src || b.image_url,
        formatDateTime(b.created_at),
      ]),
    });
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <p className="max-w-2xl text-sm text-on-surface-variant">
          Mijoz ilovasidagi karusel va promo bannerlar. Hozir ilovada <b className="text-primary">{liveCount} ta</b> banner ko&apos;rinmoqda
          (faol yoki rejalashtirilgan va muddati ichida).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge updatedAt={updatedAt} />
          <ExcelButton onClick={exportExcel} disabled={!list.length} />
          <PrimaryButton icon="add" onClick={() => openForm(null)}>
            Banner qo&apos;shish
          </PrimaryButton>
        </div>
      </div>

      <TabBar<StatusTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "all", label: "Barchasi", icon: "view_carousel", count: countOf("all") },
          { id: "active", label: "Faol", icon: "play_circle", count: countOf("active") },
          { id: "scheduled", label: "Rejalashtirilgan", icon: "schedule", count: countOf("scheduled") },
          { id: "draft", label: "Qoralama", icon: "edit_note", count: countOf("draft") },
          { id: "archived", label: "Arxiv", icon: "inventory_2", count: countOf("archived") },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#26352c] bg-[#121614] p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            className={`${inputClass} pl-10`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sarlavha, matn yoki xizmat bo'yicha qidirish..."
          />
        </div>
        <select className={inputClass} value={placement} onChange={(e) => setPlacement(e.target.value as typeof placement)} aria-label="Joylashuv">
          <option value="">Barcha joylashuvlar</option>
          {Object.entries(PLACEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <LoadingBlock />
      ) : error && !data ? (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-6 text-center">
          <p className="mb-3 text-error">{error}</p>
          <SecondaryButton icon="refresh" onClick={() => void reload()}>
            Qayta urinish
          </SecondaryButton>
        </div>
      ) : !list.length ? (
        <div className="rounded-2xl border border-[#26352c] bg-[#151917]">
          <EmptyState
            icon="ad_units"
            title={all.length ? "Filtr bo'yicha banner topilmadi" : "Bannerlar hali yo'q"}
            description={all.length ? "Boshqa holat yoki joylashuvni tanlang." : "Birinchi bannerni qo'shing — u mijoz ilovasining bosh sahifasida chiqadi."}
            action={
              <PrimaryButton icon="add" onClick={() => openForm(null)}>
                Banner qo&apos;shish
              </PrimaryButton>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const src = b.image_src || b.image_url;
            const live = isLive(b, now);
            const expired = Boolean(b.ends_at && new Date(b.ends_at).getTime() <= now);
            return (
              <article key={b.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
                <div className="relative aspect-[16/9] bg-[#0d100f]">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={b.title} loading="lazy" className={`h-full w-full object-cover ${live ? "" : "opacity-60"}`} />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[36px]">hide_image</span>
                      <span className="text-xs">Rasm yo&apos;q</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <StatusPill variant={STATUS_TONE[b.status]}>{BANNER_STATUS_LABEL[b.status]}</StatusPill>
                    {live ? (
                      <StatusPill variant="success" pulse className="backdrop-blur-sm">
                        Ilovada
                      </StatusPill>
                    ) : expired ? (
                      <StatusPill variant="error" className="backdrop-blur-sm">
                        Muddati o&apos;tgan
                      </StatusPill>
                    ) : null}
                  </div>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                    #{b.sort_order} · {PLACEMENT_LABEL[b.placement] ?? b.placement}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{b.title}</h3>
                  {b.description ? <p className="line-clamp-2 text-sm text-on-surface-variant">{b.description}</p> : null}
                  <div className="mt-1 space-y-1 text-xs text-on-surface-variant">
                    <p className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">date_range</span>
                      {dateRange(b)}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                      {b.service_name || "Xizmatga bog'lanmagan"}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center gap-2 border-t border-[#26352c]/60 pt-3">
                    <SecondaryButton icon="edit" className="flex-1 justify-center" onClick={() => openForm(b)}>
                      Tahrirlash
                    </SecondaryButton>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      title={b.status === "active" || b.status === "scheduled" ? "Qoralamaga o'tkazish" : "Faollashtirish"}
                      onClick={() => void toggle(b)}
                      className={`rounded-full border p-2 transition disabled:opacity-50 ${
                        b.status === "active" || b.status === "scheduled"
                          ? "border-primary/40 text-primary hover:bg-primary/10"
                          : "border-[#26352c] text-on-surface-variant hover:text-primary"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {b.status === "active" || b.status === "scheduled" ? "toggle_on" : "toggle_off"}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="O'chirish"
                      onClick={() => setDeleting(b)}
                      className="rounded-full border border-[#26352c] p-2 text-on-surface-variant hover:border-error/40 hover:text-error"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {formOpen ? (
        <BannerFormModal
          key={editing?.id ?? "new"}
          editing={editing}
          services={services ?? []}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        variant="danger"
        busy={busyId !== null && busyId === deleting?.id}
        title="Bannerni o'chirish"
        confirmText="O'chirish"
        description={
          deleting ? (
            <>
              <b className="text-on-surface">{deleting.title}</b> butunlay o&apos;chiriladi. Vaqtincha yashirish uchun &quot;Qoralama&quot; yoki
              &quot;Arxiv&quot; holatidan foydalaning.
            </>
          ) : (
            ""
          )
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
