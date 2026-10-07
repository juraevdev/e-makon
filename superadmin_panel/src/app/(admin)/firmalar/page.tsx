"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EmptyState,
  ExcelButton,
  Field,
  inputClass,
  LiveBadge,
  LoadingBlock,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import type { PartnerFirm } from "@/lib/api/types";
import { SPECIALTY_LABEL } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatMoney, formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { fetchAllPages } from "@/components/people/api";
import { SearchBox } from "@/components/people/form";

const SPECIALTIES = Object.keys(SPECIALTY_LABEL);

const emptyForm = {
  name: "",
  legal_name: "",
  phone: "",
  email: "",
  region: "",
  district: "",
  address: "",
  description: "",
  specialty: "general",
  commission_rate: "0.3",
  trial_days: "30",
  subscription_plan: "monthly" as "none" | "monthly" | "yearly",
  subscription_units: "1",
  debt_amount: "0",
  location_lat: "",
  location_lng: "",
};

type TabId = "asosiy" | "moliya" | "obuna" | "joy";

function Stars({ rating }: { rating: string | number }) {
  const n = Math.round(Number(rating) || 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-300" title={`${rating}★`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: i <= n ? "'FILL' 1" : undefined }}>
          star
        </span>
      ))}
      <span className="ml-1 text-[11px] text-on-surface-variant">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

const STATUS_LABEL: Record<PartnerFirm["status"], string> = {
  active: "Faol",
  pending: "Sinov",
  suspended: "Blok",
  ended: "Tugatilgan",
};

const TAB_ORDER: TabId[] = ["asosiy", "moliya", "obuna", "joy"];

function subFee(plan: string, units: number) {
  const u = Math.max(units || 1, 1);
  if (plan === "monthly") return u * 9;
  if (plan === "yearly") return u * 90;
  return 0;
}

export default function FirmalarPage() {
  const { query } = useSearch();
  const [filter, setFilter] = useState<"all" | "active" | "ended" | "pending" | "suspended">("all");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("asosiy");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setSetForm] = useState(emptyForm);
  const setForm = (patch: Partial<typeof emptyForm>) => setSetForm((f) => ({ ...f, ...patch }));

  const { data, loading, error, reload, updatedAt } = useAsync(
    () => fetchAllPages<PartnerFirm>("/admin/firms/", { search: query || undefined }),
    [query],
    { keepPrevious: true },
  );

  const firms = useMemo(() => {
    const list = data ?? [];
    return filter === "all" ? list : list.filter((f) => f.status === filter);
  }, [data, filter]);

  function exportExcel() {
    downloadExcel("firmalar", {
      name: "Firmalar",
      headers: [
        "ID",
        "Nomi",
        "Yuridik nomi",
        "Telefon",
        "Email",
        "Mutaxassislik",
        "Viloyat",
        "Tuman",
        "Manzil",
        "Holat",
        "Reyting",
        "Baholar",
        "Buyurtmalar",
        "Aylanma (UZS)",
        "Stavka (%)",
        "Kampaniya ulushi (UZS)",
        "Qarz (UZS)",
        "To'lanmagan jarima (UZS)",
        "Ogohlantirishlar",
        "Savdo taqiqi",
        "Obuna",
        "O'rinlar",
        "Obuna narxi ($)",
        "Sinov tugashi",
        "Qo'shilgan",
      ],
      rows: firms.map((f) => [
        f.id,
        f.name,
        f.legal_name,
        formatPhone(f.phone),
        f.email,
        f.specialty_label || SPECIALTY_LABEL[f.specialty] || f.specialty,
        f.region,
        f.district,
        f.address,
        STATUS_LABEL[f.status] ?? f.status,
        Number(f.rating) || 0,
        f.ratings_count || 0,
        f.orders_count ?? 0,
        Number(f.revenue) || 0,
        Number(f.commission_rate) || 0,
        Number(f.platform_share) || 0,
        Number(f.debt_amount) || 0,
        Number(f.unpaid_fines) || 0,
        f.warnings_count || 0,
        f.is_sales_banned ? "Ha" : "Yo'q",
        f.subscription_plan === "monthly" ? "Oylik" : f.subscription_plan === "yearly" ? "Yillik" : "Yo'q",
        f.subscription_units,
        Number(f.subscription_fee_usd) || 0,
        f.trial_ends_at ? formatDate(f.trial_ends_at) : "",
        formatDate(f.created_at),
      ]),
    });
  }

  const units = Number(form.subscription_units) || 1;
  const fee = subFee(form.subscription_plan, units);
  const yearlyIfMonthly = units * 108;

  async function createFirm() {
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Firma nomi majburiy.");
      setTab("asosiy");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("Telefon majburiy.");
      setTab("asosiy");
      return;
    }
    const rate = Number(form.commission_rate);
    if (rate < 0.1 || rate > 3) {
      setFormError("Kampaniya ulushi 0.1%–3% oralig'ida.");
      setTab("moliya");
      return;
    }
    setBusy(true);
    try {
      const days = Number(form.trial_days) || 0;
      const created = await api<PartnerFirm>("/admin/firms/", {
        method: "POST",
        body: {
          name: form.name.trim(),
          legal_name: form.legal_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          region: form.region.trim(),
          district: form.district.trim(),
          address: form.address.trim(),
          description: form.description.trim(),
          specialty: form.specialty,
          commission_rate: rate,
          subscription_plan: form.subscription_plan,
          subscription_units: units,
          debt_amount: Number(form.debt_amount) || 0,
          location_lat: form.location_lat ? Number(form.location_lat) : null,
          location_lng: form.location_lng ? Number(form.location_lng) : null,
          status: days > 0 ? "pending" : "active",
        },
      });
      if (days > 0 && created?.id) {
        await api(`/admin/firms/${created.id}/set_trial/`, {
          method: "POST",
          body: { days },
        });
      }
      setOpen(false);
      setTab("asosiy");
      setSetForm(emptyForm);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Saqlashda xato");
    } finally {
      setBusy(false);
    }
  }

  const all = data ?? [];
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "asosiy", label: "Asosiy", icon: "badge" },
    { id: "moliya", label: "Moliya", icon: "payments" },
    { id: "obuna", label: "Obuna", icon: "card_membership" },
    { id: "joy", label: "Joylashuv", icon: "location_on" },
  ];
  const tabIndex = TAB_ORDER.indexOf(tab);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
      <PageHeader
        title="Xizmat ko'rsatuvchi firmalar"
        description="Reyting, qarz/daromad, obuna ($9/oy · $90/yil), blok, jarima va savdo taqiqi."
        actions={
          <>
            <LiveBadge updatedAt={updatedAt || undefined} />
            <ExcelButton onClick={exportExcel} disabled={!firms.length} />
            <PrimaryButton
              icon="add_business"
              onClick={() => {
                setTab("asosiy");
                setFormError("");
                setOpen(true);
              }}
            >
              Yangi firma
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#26352c] bg-[#121614]/80 p-3 sm:p-4 xl:flex-row xl:items-center">
        <TabBar
          className="xl:shrink-0"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: "all", label: "Barchasi", count: all.length },
            { id: "active", label: "Faol", count: all.filter((f) => f.status === "active").length },
            { id: "pending", label: "Sinov", count: all.filter((f) => f.status === "pending").length },
            { id: "suspended", label: "Blok", count: all.filter((f) => f.status === "suspended").length },
            { id: "ended", label: "Tugatilgan", count: all.filter((f) => f.status === "ended").length },
          ]}
        />
        <SearchBox placeholder="Nomi, telefon, hudud..." className="xl:flex-1" />
      </div>

      {loading && !data ? (
        <LoadingBlock />
      ) : error && !data ? (
        <p className="text-error">{error}</p>
      ) : !firms.length ? (
        <EmptyState icon="storefront" title="Firmalar yo'q" action={<PrimaryButton onClick={() => setOpen(true)}>Qo&apos;shish</PrimaryButton>} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {firms.map((f) => (
            <Link
              key={f.id}
              href={`/firmalar/${f.id}`}
              className="flex flex-col justify-between rounded-2xl border border-primary-container/35 bg-gradient-to-b from-[#151a18] to-[#101412] p-5 transition hover:border-primary/60"
            >
              <div>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-on-surface">{f.name}</h3>
                  <StatusPill
                    variant={
                      f.status === "active"
                        ? "success"
                        : f.status === "ended" || f.status === "suspended"
                          ? "error"
                          : "warning"
                    }
                    pulse={f.status === "active"}
                  >
                    {STATUS_LABEL[f.status] ?? "Sinov"}
                  </StatusPill>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Stars rating={f.rating} />
                  <span className="text-[11px] text-on-surface-variant">({f.ratings_count || 0} baho)</span>
                  {f.is_sales_banned ? (
                    <span className="rounded-md bg-error/15 px-1.5 py-0.5 text-[10px] font-semibold text-error">Savdo taqiq</span>
                  ) : null}
                  {(f.warnings_count || 0) > 0 ? (
                    <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {f.warnings_count} ogohlantirish
                    </span>
                  ) : null}
                </div>
                <p className="mb-2 text-xs text-on-surface-variant">
                  {f.specialty_label || SPECIALTY_LABEL[f.specialty] || f.specialty}
                </p>
                <p className="text-xs text-on-surface-variant">{formatPhone(f.phone)}</p>
                <p className="mt-1 truncate text-xs text-on-surface-variant">{f.address || f.region || "—"}</p>
                {f.subscription_plan !== "none" ? (
                  <p className="mt-1 text-[11px] text-primary/90">
                    Obuna: {f.subscription_plan === "monthly" ? "oylik" : "yillik"} · ${f.subscription_fee_usd}
                    {f.subscription_plan === "yearly" ? ` (oylik bo‘lsa $${f.subscription_yearly_if_monthly_usd})` : ""}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs">
                <div>
                  <p className="text-on-surface-variant">Daromad (aylanma)</p>
                  <p className="font-semibold">{formatMoney(f.revenue)}</p>
                </div>
                <div>
                  <p className="text-on-surface-variant">Kampaniya ulushi</p>
                  <p className="font-semibold text-primary">
                    {f.commission_rate}% · {formatMoney(f.platform_share)}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-variant">Qarz</p>
                  <p className={`font-semibold ${Number(f.debt_amount) > 0 ? "text-error" : ""}`}>
                    {formatMoney(f.debt_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-on-surface-variant">To&apos;lanmagan jarima</p>
                  <p className="font-semibold">{formatMoney(f.unpaid_fines || "0")}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={open}
        size="lg"
        title="Yangi firma"
        description="Kampaniya ma'lumotlari, moliya, obuna va joylashuv"
        onClose={() => setOpen(false)}
        footer={
          <>
            <div className="flex gap-2 sm:mr-auto">
              <SecondaryButton
                icon="arrow_back"
                disabled={tabIndex === 0}
                onClick={() => setTab(TAB_ORDER[Math.max(0, tabIndex - 1)])}
                className="flex-1 justify-center sm:flex-none"
              >
                Orqaga
              </SecondaryButton>
              <SecondaryButton
                disabled={tabIndex === TAB_ORDER.length - 1}
                onClick={() => setTab(TAB_ORDER[Math.min(TAB_ORDER.length - 1, tabIndex + 1)])}
                className="flex-1 justify-center sm:flex-none"
              >
                Oldinga
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </SecondaryButton>
            </div>
            <SecondaryButton onClick={() => setOpen(false)} className="justify-center">
              Bekor qilish
            </SecondaryButton>
            <PrimaryButton icon="add_business" disabled={busy} onClick={() => void createFirm()} className="justify-center">
              {busy ? "Saqlanmoqda..." : "Firmani saqlash"}
            </PrimaryButton>
          </>
        }
      >
        <TabBar className="mb-5" value={tab} onChange={setTab} tabs={tabs} />

        {formError ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {formError}
          </p>
        ) : null}

        {tab === "asosiy" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Firma nomi *">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
            </Field>
            <Field label="Yuridik nomi">
              <input className={inputClass} value={form.legal_name} onChange={(e) => setForm({ legal_name: e.target.value })} />
            </Field>
            <Field label="Telefon *">
              <input className={inputClass} placeholder="+998..." value={form.phone} onChange={(e) => setForm({ phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ email: e.target.value })} />
            </Field>
            <Field label="Mutaxassislik">
              <select className={inputClass} value={form.specialty} onChange={(e) => setForm({ specialty: e.target.value })}>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>{SPECIALTY_LABEL[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Sinov muddati (kun, 0 = doimiy)">
              <input className={inputClass} type="number" min="0" value={form.trial_days} onChange={(e) => setForm({ trial_days: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Tavsif / xizmatlar">
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={form.description}
                  onChange={(e) => setForm({ description: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {tab === "moliya" ? (
          <div className="space-y-3">
            <Field label="Kampaniya ulushi (%) 0.1 – 3.0">
              <input
                className={inputClass}
                type="number"
                step="0.1"
                min="0.1"
                max="3"
                value={form.commission_rate}
                onChange={(e) => setForm({ commission_rate: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-on-surface-variant">
              Ogohlantirish va hisobotlardan so‘ng foiz 2–3% gacha oshirilishi mumkin.
            </p>
            <Field label="Boshlang'ich qarz (UZS)">
              <input
                className={inputClass}
                type="number"
                min="0"
                value={form.debt_amount}
                onChange={(e) => setForm({ debt_amount: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {tab === "obuna" ? (
          <div className="space-y-4">
            <Field label="Obuna turi">
              <select
                className={inputClass}
                value={form.subscription_plan}
                onChange={(e) => setForm({ subscription_plan: e.target.value as typeof form.subscription_plan })}
              >
                <option value="none">Obuna yo&apos;q</option>
                <option value="monthly">Oylik — $9 / o&apos;rin</option>
                <option value="yearly">Yillik — $90 / o&apos;rin</option>
              </select>
            </Field>
            <Field label="O'rinlar soni">
              <input
                className={inputClass}
                type="number"
                min="1"
                value={form.subscription_units}
                onChange={(e) => setForm({ subscription_units: e.target.value })}
              />
            </Field>
            <div className="rounded-xl border border-primary/25 bg-primary-container/10 p-4 text-sm">
              <p className="font-semibold text-primary">Hisob-kitob</p>
              <ul className="mt-2 space-y-1 text-on-surface-variant">
                <li>Tanlangan: <strong className="text-on-surface">${fee}</strong>
                  {form.subscription_plan === "monthly" ? " / oy" : form.subscription_plan === "yearly" ? " / yil" : ""}
                </li>
                {form.subscription_plan === "yearly" ? (
                  <li>
                    Agar oylik olsangiz: <strong className="text-on-surface">${yearlyIfMonthly}/yil</strong> — yillikda{" "}
                    <strong className="text-primary">${yearlyIfMonthly - fee}</strong> tejash
                  </li>
                ) : form.subscription_plan === "monthly" ? (
                  <li>
                    12 oy oylik = <strong className="text-on-surface">${yearlyIfMonthly}</strong>; yillik paket ={" "}
                    <strong className="text-primary">${units * 90}</strong>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}

        {tab === "joy" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Viloyat / shahar">
              <input className={inputClass} value={form.region} onChange={(e) => setForm({ region: e.target.value })} />
            </Field>
            <Field label="Tuman">
              <input className={inputClass} value={form.district} onChange={(e) => setForm({ district: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Manzil">
                <input className={inputClass} value={form.address} onChange={(e) => setForm({ address: e.target.value })} />
              </Field>
            </div>
            <Field label="Latitude">
              <input className={inputClass} value={form.location_lat} onChange={(e) => setForm({ location_lat: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <input className={inputClass} value={form.location_lng} onChange={(e) => setForm({ location_lng: e.target.value })} />
            </Field>
          </div>
        ) : null}

      </Modal>
    </div>
  );
}
