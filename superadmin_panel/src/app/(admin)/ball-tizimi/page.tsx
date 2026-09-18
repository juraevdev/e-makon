"use client";

import { useState } from "react";
import {
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { LoyaltyReward, LoyaltySettings, PointTransaction } from "@/lib/api/types";
import { POINT_KIND_LABEL } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

export default function BallTizimiPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "redeem", points_cost: "100", is_active: true });
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const [settings, rewards, txs] = await Promise.all([
      api<LoyaltySettings>("/admin/loyalty/settings/"),
      api("/admin/loyalty-rewards/", { query: { page_size: 50 } }),
      api("/admin/loyalty-transactions/", { query: { page_size: 20 } }),
    ]);
    return {
      settings,
      rewards: asPage<LoyaltyReward>(rewards).results,
      txs: asPage<PointTransaction>(txs).results,
    };
  }, []);

  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const current = settings ?? data?.settings;

  async function saveSettings() {
    if (!current) return;
    setBusy(true);
    try {
      const saved = await api<LoyaltySettings>("/admin/loyalty/settings/", { method: "PATCH", body: current });
      setSettings(saved);
    } finally {
      setBusy(false);
    }
  }

  async function addReward() {
    setBusy(true);
    try {
      await api("/admin/loyalty-rewards/", {
        method: "POST",
        body: { ...form, points_cost: Number(form.points_cost) },
      });
      setOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleReward(r: LoyaltyReward) {
    await api(`/admin/loyalty-rewards/${r.id}/`, { method: "PATCH", body: { is_active: !r.is_active } });
    await reload();
  }

  if (loading) return <LoadingBlock />;
  if (error || !data) return <p className="p-8 text-error">{error}</p>;

  const s = current!;

  return (
    <div className="flex-1 p-4 pb-16 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Ball tizimi</h1>
          <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
            Bajarilgan buyurtma narxidan ball hisoblanadi va mobil mijoz balansiga tushadi.
          </p>
        </div>
        <PrimaryButton icon="save" disabled={busy} onClick={() => void saveSettings()}>
          Qoidalarni saqlash
        </PrimaryButton>
      </div>

      <div className="mb-6 rounded-2xl border border-[#26352c] bg-[#151917] p-6">
        <h2 className="mb-4 text-lg font-bold">Ball to&apos;plash qoidalari</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="1 ball = so'm">
            <input
              className={inputClass}
              type="number"
              value={s.uzs_per_point}
              onChange={(e) => setSettings({ ...s, uzs_per_point: Number(e.target.value) })}
            />
          </Field>
          <Field label="Minimal almashtirish">
            <input
              className={inputClass}
              type="number"
              value={s.min_redeem_points}
              onChange={(e) => setSettings({ ...s, min_redeem_points: Number(e.target.value) })}
            />
          </Field>
          <Field label="Amal qilish (oy)">
            <input
              className={inputClass}
              type="number"
              value={s.expire_months}
              onChange={(e) => setSettings({ ...s, expire_months: Number(e.target.value) })}
            />
          </Field>
        </div>
        <p className="mt-4 text-sm text-on-surface-variant">
          Har <strong className="text-primary">{s.uzs_per_point.toLocaleString("uz-UZ")} so&apos;m</strong> uchun 1 ball.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-[#26352c] bg-[#151917] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Mukofot kurslari</h2>
          <PrimaryButton icon="add_circle" onClick={() => setOpen(true)}>Qoida qo&apos;shish</PrimaryButton>
        </div>
        {!data.rewards.length ? (
          <EmptyState icon="redeem" title="Mukofotlar yo'q" />
        ) : (
          <div className="divide-y divide-[#26352c]/50">
            {data.rewards.map((r) => (
              <div key={r.id} className="flex items-center gap-4 py-3">
                <span className="material-symbols-outlined text-primary">{r.icon}</span>
                <span className="flex-1 font-medium">{r.name}</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{r.points_cost} ball</span>
                <StatusPill variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Faol" : "Nofaol"}</StatusPill>
                <button type="button" className="text-xs text-primary" onClick={() => void toggleReward(r)}>
                  Holat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#26352c] bg-[#151917]">
        <h2 className="border-b border-[#26352c] p-6 text-lg font-bold">Tranzaksiyalar</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#26352c] text-xs uppercase text-on-surface-variant">
              {["Foydalanuvchi", "Turi", "Ball", "Buyurtma", "Sana"].map((h) => (
                <th key={h} className="px-6 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#26352c]/40">
            {data.txs.map((t) => (
              <tr key={t.id}>
                <td className="px-6 py-4">{t.user_name}</td>
                <td className="px-6 py-4 text-on-surface-variant">{POINT_KIND_LABEL[t.kind]}</td>
                <td className={`px-6 py-4 font-semibold ${t.points >= 0 ? "text-primary" : "text-error"}`}>
                  {t.points > 0 ? `+${t.points}` : t.points}
                </td>
                <td className="px-6 py-4 font-mono text-primary">{t.order_id ? `#${t.order_id}` : "—"}</td>
                <td className="px-6 py-4 text-on-surface-variant">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Yangi mukofot" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Nomi">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Ball">
            <input className={inputClass} type="number" value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: e.target.value })} />
          </Field>
          <PrimaryButton disabled={busy || !form.name} onClick={() => void addReward()}>Saqlash</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
