"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  ExcelButton,
  Field,
  FilterChip,
  inputClass,
  LiveBadge,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { CatalogTypeFormModal } from "@/components/catalog/CatalogTypeFormModal";
import { fetchAll, todayStamp } from "@/components/catalog/fetchAll";
import { priceOf, RejectServiceModal, ServicePreviewModal } from "@/components/catalog/ModerationModals";
import { ServiceThumb } from "@/components/catalog/ServiceThumb";
import { api } from "@/lib/api/client";
import type { ModerationStatus, Service } from "@/lib/api/types";
import { MODERATION_LABEL, MODERATION_TONE } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type Tab = "queue" | "offers" | "catalog";

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[`'‘’ʻʼ´]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function similarityScore(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (x === y) return 3;
  if (x.includes(y) || y.includes(x)) return 2;
  const stems = (s: string) => s.split(" ").filter((w) => w.length >= 4).map((w) => w.slice(0, 5));
  const ys = stems(y);
  return stems(x).some((w) => ys.includes(w)) ? 1 : 0;
}

const time = (v?: string | null) => (v ? new Date(v).getTime() : 0);

export default function XizmatlarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("queue");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [firm, setFirm] = useState("");
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [offerFilter, setOfferFilter] = useState<"all" | ModerationStatus>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Service | null>(null);
  const [rejecting, setRejecting] = useState<Service | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Record<number, string>>({});

  const { data, loading, error, reload, updatedAt } = useAsync(
    () => fetchAll<Service>("/admin/services/"),
    [],
    { keepPrevious: true },
  );

  const all = useMemo(() => data?.results ?? [], [data]);
  const catalog = useMemo(
    () => all.filter((s) => s.is_catalog_type).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id),
    [all],
  );
  const offers = useMemo(() => all.filter((s) => !s.is_catalog_type), [all]);
  const queue = useMemo(
    () => offers.filter((s) => s.moderation_status === "pending").sort((a, b) => time(a.updated_at) - time(b.updated_at)),
    [offers],
  );
  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const categoryOf = (s: Service) => s.category || (s.base_service ? catalogById.get(s.base_service)?.category : "") || "";
  const categories = useMemo(
    () => [...new Set(all.map((s) => s.category || "").filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const firms = useMemo(() => {
    const map = new Map<string, string>();
    offers.forEach((s) => {
      if (s.organization_id) map.set(String(s.organization_id), s.organization_name || `Firma #${s.organization_id}`);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [offers]);

  const needle = normalizeName(search);
  const globalNeedle = normalizeName(query || "");
  const matches = (s: Service) => {
    const hay = normalizeName(
      [s.name, s.slug, s.organization_name, s.base_service_name, categoryOf(s), s.short_description].filter(Boolean).join(" "),
    );
    return (!needle || hay.includes(needle)) && (!globalNeedle || hay.includes(globalNeedle));
  };
  const commonFilter = (s: Service) =>
    matches(s) &&
    (!category || categoryOf(s) === category) &&
    (!firm || String(s.organization_id ?? "") === firm) &&
    (typeFilter === null || s.base_service === typeFilter);

  const visibleQueue = queue.filter(commonFilter);
  const offersBase = offers.filter(commonFilter);
  const visibleOffers = offerFilter === "all" ? offersBase : offersBase.filter((s) => s.moderation_status === offerFilter);
  const catalogBase = catalog.filter((s) => matches(s) && (!category || categoryOf(s) === category));
  const visibleCatalog =
    activeFilter === "all" ? catalogBase : catalogBase.filter((s) => (activeFilter === "active" ? s.is_active : !s.is_active));

  const siblings = (s: Service) =>
    offers.filter((o) => o.id !== s.id && o.base_service && o.base_service === s.base_service && o.moderation_status === "approved");
  const peerPrices = (s: Service) => siblings(s).map(priceOf).filter(Boolean);
  const similarTypes = (s: Service) =>
    catalog
      .map((c) => ({ c, score: similarityScore(c.name, s.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  const samePending = (s: Service) =>
    queue.filter((o) => o.id !== s.id && o.is_type_proposal && similarityScore(o.name, s.name) >= 2);

  const filtersActive = Boolean(search || category || firm || typeFilter !== null);
  function clearFilters() {
    setSearch("");
    setCategory("");
    setFirm("");
    setTypeFilter(null);
  }

  async function moderate(s: Service, action: "approve" | "reject", note = "") {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { note };
      const target =
        mergeTarget[s.id] ??
        (s.is_type_proposal ? similarTypes(s).find((c) => similarityScore(c.name, s.name) === 3)?.id : undefined);
      if (action === "approve" && s.is_type_proposal && target) body.base_service = Number(target);
      const saved = await api<Service>(`/admin/services/${s.id}/${action}/`, { method: "POST", body });
      showSuccess(
        action === "approve"
          ? `"${s.name}" tasdiqlandi — ilovada "${saved?.base_service_name || s.name}" ichida ko'rinadi`
          : "Rad etildi, firmaga sabab bilan xabar yuborildi",
      );
      setRejecting(null);
      setPreview(null);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await api(`/admin/services/${s.id}/`, { method: "PATCH", body: { is_active: !s.is_active } });
      showSuccess(s.is_active ? `"${s.name}" ilovadan yashirildi` : `"${s.name}" ilovada ko'rinadi`);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/services/${deleting.id}/`, { method: "DELETE" });
      showSuccess(`"${deleting.name}" katalogdan o'chirildi`);
      setDeleting(null);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  function openForm(s: Service | null) {
    setEditing(s);
    setFormOpen(true);
  }

  function exportExcel() {
    if (tab === "catalog") {
      downloadExcel(`katalog-turlari-${todayStamp()}`, {
        name: "Katalog turlari",
        headers: ["ID", "Nomi", "Slug", "Toifa", "Firma takliflari", "Min narx (UZS)", "Max narx (UZS)", "Faol", "Tartib", "Yangilangan"],
        rows: visibleCatalog.map((s) => [
          s.id,
          s.name,
          s.slug,
          categoryOf(s),
          s.offers_count ?? 0,
          s.offers_count ? s.price_min ?? 0 : "",
          s.offers_count ? s.price_max ?? 0 : "",
          s.is_active ? "Ha" : "Yo'q",
          s.sort_order ?? 0,
          formatDateTime(s.updated_at),
        ]),
      });
      return;
    }
    const rows = tab === "queue" ? visibleQueue : visibleOffers;
    downloadExcel(`${tab === "queue" ? "tekshiruv-navbati" : "firma-xizmatlari"}-${todayStamp()}`, {
      name: tab === "queue" ? "Tekshiruv navbati" : "Firma takliflari",
      headers: ["ID", "Firma", "Xizmat", "Katalog turi", "Toifa", "Narx (UZS)", "Holat", "Izoh", "Ilovada", "Yuborilgan", "Yangilangan"],
      rows: rows.map((s) => [
        s.id,
        s.organization_name || "",
        s.name,
        s.base_service_name || "Yangi tur taklifi",
        categoryOf(s),
        priceOf(s),
        s.moderation_status ? MODERATION_LABEL[s.moderation_status] : "",
        s.moderation_note || "",
        s.is_active ? "Ha" : "Yo'q",
        formatDateTime(s.created_at),
        formatDateTime(s.updated_at),
      ]),
    });
  }

  const exportCount = tab === "catalog" ? visibleCatalog.length : tab === "queue" ? visibleQueue.length : visibleOffers.length;
  const offerCount = (f: "all" | ModerationStatus) => (f === "all" ? offersBase.length : offersBase.filter((s) => s.moderation_status === f).length);

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Firmalar o&apos;z xizmatlarini <b className="text-on-surface">aniq, o&apos;zgarmas narx</b> bilan qo&apos;shadi. Har bir yangi xizmat
          yoki narx o&apos;zgarishi shu yerda tekshiriladi; tasdiqlangach mijoz ilovasida firma narxlari yonma-yon chiqadi.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge updatedAt={updatedAt} />
          <ExcelButton onClick={exportExcel} disabled={!exportCount} />
          {tab === "catalog" ? (
            <PrimaryButton icon="add" onClick={() => openForm(null)}>
              Katalog turi
            </PrimaryButton>
          ) : null}
        </div>
      </div>

      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "queue", label: "Tekshiruv navbati", icon: "fact_check", count: queue.length },
          { id: "offers", label: "Firma takliflari", icon: "storefront", count: offers.length },
          { id: "catalog", label: "Katalog turlari", icon: "category", count: catalog.length },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#26352c] bg-[#121614] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            className={`${inputClass} pl-10`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "catalog" ? "Katalog turi nomi..." : "Xizmat, firma yoki tur bo'yicha qidirish..."}
          />
        </div>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Toifa">
          <option value="">Barcha toifalar</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {tab === "catalog" ? (
          <select
            className={inputClass}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
            aria-label="Holat"
          >
            <option value="all">Barcha holatlar</option>
            <option value="active">Faol</option>
            <option value="inactive">To&apos;xtatilgan</option>
          </select>
        ) : (
          <select className={inputClass} value={firm} onChange={(e) => setFirm(e.target.value)} aria-label="Firma">
            <option value="">Barcha firmalar</option>
            {firms.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <SecondaryButton icon="filter_alt_off" disabled={!filtersActive} onClick={clearFilters} className="justify-center">
          Tozalash
        </SecondaryButton>
        {typeFilter !== null && tab !== "catalog" ? (
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Tur: {catalogById.get(typeFilter)?.name ?? `#${typeFilter}`}
              <button type="button" onClick={() => setTypeFilter(null)} aria-label="Tur filtrini olib tashlash">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </span>
          </div>
        ) : null}
      </div>

      {data?.truncated ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Jami {data.count} ta xizmatdan {data.results.length} tasi yuklandi. Aniqroq natija uchun qidiruvdan foydalaning.
        </p>
      ) : null}

      {loading && !data ? (
        <LoadingBlock />
      ) : error && !data ? (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-6 text-center">
          <p className="mb-3 text-error">{error}</p>
          <SecondaryButton icon="refresh" onClick={() => void reload()}>
            Qayta urinish
          </SecondaryButton>
        </div>
      ) : tab === "queue" ? (
        !visibleQueue.length ? (
          <div className="rounded-2xl border border-[#26352c] bg-[#151917]">
            {queue.length ? (
              <EmptyState
                icon="search_off"
                title="Filtr bo'yicha topilmadi"
                description="Navbatda xizmatlar bor, lekin tanlangan filtrga mos kelmaydi."
                action={<SecondaryButton onClick={clearFilters}>Filtrni tozalash</SecondaryButton>}
              />
            ) : (
              <EmptyState icon="task_alt" title="Navbat bo'sh" description="Tekshiruvni kutayotgan firma xizmati yo'q. Yangi xizmat kelsa shu yerda avtomatik paydo bo'ladi." />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visibleQueue.map((s) => {
              const prices = peerPrices(s);
              const similar = s.is_type_proposal ? similarTypes(s) : [];
              const exact = similar.find((c) => similarityScore(c.name, s.name) === 3);
              const twins = s.is_type_proposal ? samePending(s) : [];
              const target = mergeTarget[s.id] ?? (exact ? String(exact.id) : "");
              const resubmitted = Boolean(s.moderated_at);
              return (
                <article key={s.id} className="flex flex-col rounded-2xl border border-amber-500/30 bg-[#151917] p-4 sm:p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <button type="button" onClick={() => setPreview(s)} className="shrink-0" aria-label="Ko'rish">
                      <ServiceThumb service={s} className="h-16 w-20" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs text-on-surface-variant">{s.organization_name || "Firma"}</p>
                        <StatusPill variant={resubmitted ? "info" : "warning"} pulse>
                          {resubmitted ? "Qayta yuborilgan" : "Yangi"}
                        </StatusPill>
                      </div>
                      <button type="button" onClick={() => setPreview(s)} className="mt-0.5 block text-left text-lg font-bold leading-snug hover:text-primary">
                        {s.emoji} {s.name}
                      </button>
                      <p className="text-xs text-on-surface-variant">
                        Katalog turi: {s.base_service_name || <span className="text-amber-300">yangi tur taklifi</span>}
                        {categoryOf(s) ? ` · ${categoryOf(s)}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-lg font-bold text-primary sm:text-xl">{formatMoney(priceOf(s))}</p>
                  </div>
                  <p className="mb-2 line-clamp-3 text-sm text-on-surface-variant">{s.short_description || s.description || "Tavsif yo'q"}</p>
                  <p className="mb-3 text-xs text-on-surface-variant">
                    {s.duration ? `${s.duration} · ` : ""}Yuborilgan: {formatDateTime(s.updated_at || s.created_at)}
                  </p>
                  {s.is_type_proposal ? (
                    <div className="mb-3 rounded-xl border border-[#26352c] bg-[#0e1210] p-3 text-xs">
                      <Field label="Tasdiqlanganda ilovada qayerda chiqadi">
                        <select
                          className={inputClass}
                          value={target}
                          onChange={(e) => setMergeTarget((m) => ({ ...m, [s.id]: e.target.value }))}
                        >
                          <option value="">Yangi katalog turi: &quot;{s.name}&quot;</option>
                          {similar.map((c) => (
                            <option key={c.id} value={c.id}>
                              O&apos;xshash turga qo&apos;shish: {c.emoji} {c.name} ({c.offers_count ?? 0} ta firma)
                            </option>
                          ))}
                          {catalog
                            .filter((c) => !similar.includes(c))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                Mavjud turga qo&apos;shish: {c.emoji} {c.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      {similar.length ? (
                        <p className="mt-2 text-amber-200">
                          Katalogda o&apos;xshash tur bor: {similar.map((c) => c.name).join(", ")}. Takror xizmat chiqmasligi uchun
                          mavjud turga qo&apos;shing.
                        </p>
                      ) : null}
                      {twins.length ? (
                        <p className="mt-2 text-on-surface-variant">
                          Shu nomdagi boshqa takliflar navbatda: {twins.map((o) => o.organization_name).join(", ")} — bittasi
                          tasdiqlangach qolganlari shu turga avtomatik qo&apos;shiladi.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {prices.length ? (
                    <p className="mb-3 rounded-xl bg-[#0e1210] px-3 py-2 text-xs text-on-surface-variant">
                      Shu turdagi {prices.length} ta firma narxi: {formatMoney(Math.min(...prices))} – {formatMoney(Math.max(...prices))}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-[#26352c]/60 pt-3">
                    <PrimaryButton icon="check" disabled={busy} onClick={() => void moderate(s, "approve")}>
                      Tasdiqlash
                    </PrimaryButton>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRejecting(s)}
                      className="inline-flex items-center gap-2 rounded-full border border-error/40 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                      Rad etish
                    </button>
                    <SecondaryButton icon="visibility" onClick={() => setPreview(s)} className="sm:ml-auto">
                      Ko&apos;rish
                    </SecondaryButton>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : tab === "offers" ? (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {(["all", "approved", "pending", "rejected"] as const).map((f) => (
              <FilterChip
                key={f}
                label={f === "all" ? "Barchasi" : MODERATION_LABEL[f]}
                count={offerCount(f)}
                active={offerFilter === f}
                onClick={() => setOfferFilter(f)}
              />
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
            {!visibleOffers.length ? (
              <EmptyState
                icon="storefront"
                title={offers.length ? "Filtr bo'yicha takliflar topilmadi" : "Firma takliflari yo'q"}
                description={offers.length ? "Qidiruv yoki filtrlarni o'zgartirib ko'ring." : "Firmalar xizmat qo'shganda shu yerda ko'rinadi."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#26352c] text-xs uppercase text-on-surface-variant">
                      {["Xizmat", "Firma", "Katalog turi", "Narx", "Holat", "Ilovada", ""].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26352c]/50">
                    {visibleOffers.map((s) => (
                      <tr key={s.id} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setPreview(s)} className="flex items-center gap-3 text-left">
                            <ServiceThumb service={s} className="h-10 w-12" />
                            <span className="min-w-0">
                              <span className="block font-semibold hover:text-primary">{s.name}</span>
                              <span className="block text-xs text-on-surface-variant">{categoryOf(s) || "—"}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 font-semibold">{s.organization_name || "—"}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{s.base_service_name || <span className="text-amber-300">Yangi tur</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold">{formatMoney(priceOf(s))}</td>
                        <td className="px-4 py-3">
                          {s.moderation_status ? (
                            <StatusPill variant={MODERATION_TONE[s.moderation_status]}>{MODERATION_LABEL[s.moderation_status]}</StatusPill>
                          ) : null}
                          {s.moderation_note ? <p className="mt-1 line-clamp-2 max-w-[220px] text-xs text-on-surface-variant">{s.moderation_note}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void toggleActive(s)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              s.is_active ? "border-primary/40 text-primary" : "border-[#26352c] text-on-surface-variant"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">{s.is_active ? "visibility" : "visibility_off"}</span>
                            {s.is_active ? "Faol" : "O'chiq"}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {s.moderation_status !== "approved" ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="mr-3 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                              onClick={() => void moderate(s, "approve")}
                            >
                              Tasdiqlash
                            </button>
                          ) : null}
                          {s.moderation_status !== "rejected" ? (
                            <button type="button" className="mr-3 text-xs font-semibold text-error hover:underline" onClick={() => setRejecting(s)}>
                              Rad etish
                            </button>
                          ) : null}
                          <button type="button" className="text-xs text-on-surface-variant hover:text-on-surface" onClick={() => setPreview(s)}>
                            Ko&apos;rish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : !visibleCatalog.length ? (
        <div className="rounded-2xl border border-[#26352c] bg-[#151917]">
          <EmptyState
            icon="category"
            title={catalog.length ? "Filtr bo'yicha tur topilmadi" : "Katalog bo'sh"}
            description={catalog.length ? "Qidiruv yoki toifani o'zgartiring." : "Birinchi katalog turini qo'shing — firmalar narxlarini shu turga taklif qiladi."}
            action={
              <PrimaryButton icon="add" onClick={() => openForm(null)}>
                Katalog turi
              </PrimaryButton>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleCatalog.map((s) => (
            <article key={s.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#26352c] bg-[#111414]">
              <div className="relative aspect-[16/9] bg-[#0d100f]">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt={s.name} loading="lazy" className={`h-full w-full object-cover ${s.is_active ? "" : "opacity-50 grayscale"}`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[44px]">{s.icon || "eco"}</span>
                  </div>
                )}
                <div className="absolute right-3 top-3">
                  <StatusPill variant={s.is_active ? "success" : "neutral"}>{s.is_active ? "Faol" : "To'xtatilgan"}</StatusPill>
                </div>
                {categoryOf(s) ? (
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
                    {categoryOf(s)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-bold">
                  {s.emoji} {s.name}
                </p>
                <p className="mb-3 line-clamp-2 text-xs text-on-surface-variant">{s.short_description || "Tavsif yo'q"}</p>
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    setTypeFilter(s.id);
                    setOfferFilter("all");
                    setTab("offers");
                  }}
                  className="mt-auto flex items-center justify-between rounded-xl bg-[#0e1210] px-3 py-2 text-left text-xs text-on-surface-variant hover:text-on-surface"
                >
                  <span>
                    <b className="text-on-surface">{s.offers_count ?? 0}</b> ta firma taklifi
                    {s.offers_count ? ` · ${formatMoney(s.price_min)} – ${formatMoney(s.price_max)}` : ""}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
                <div className="mt-3 flex gap-2 border-t border-[#26352c]/50 pt-3">
                  <SecondaryButton icon="edit" className="flex-1 justify-center" onClick={() => openForm(s)}>
                    Tahrirlash
                  </SecondaryButton>
                  <button
                    type="button"
                    title={s.is_active ? "Ilovadan yashirish" : "Ilovada ko'rsatish"}
                    onClick={() => void toggleActive(s)}
                    className="rounded-full border border-[#26352c] p-2 text-on-surface-variant hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">{s.is_active ? "visibility_off" : "visibility"}</span>
                  </button>
                  <button
                    type="button"
                    title="O'chirish"
                    onClick={() => setDeleting(s)}
                    className="rounded-full border border-[#26352c] p-2 text-on-surface-variant hover:border-error/40 hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ServicePreviewModal
        service={preview}
        peerPrices={preview ? peerPrices(preview) : []}
        busy={busy}
        onClose={() => setPreview(null)}
        onApprove={(s) => void moderate(s, "approve")}
        onReject={(s) => {
          setPreview(null);
          setRejecting(s);
        }}
      />

      <RejectServiceModal
        key={rejecting?.id ?? "none"}
        service={rejecting}
        busy={busy}
        onClose={() => setRejecting(null)}
        onConfirm={(s, note) => void moderate(s, "reject", note)}
      />

      {formOpen ? (
        <CatalogTypeFormModal
          key={editing?.id ?? "new"}
          editing={editing}
          categories={categories}
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
        busy={busy}
        title="Katalog turini o'chirish"
        confirmText="O'chirish"
        description={
          deleting ? (
            <>
              <b className="text-on-surface">{deleting.name}</b> katalogdan o&apos;chiriladi.
              {deleting.offers_count ? ` Unga bog'langan ${deleting.offers_count} ta firma taklifi turdan ajraladi.` : ""} Bu amalni
              qaytarib bo&apos;lmaydi — vaqtincha yashirish uchun &quot;To&apos;xtatish&quot;dan foydalaning.
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
