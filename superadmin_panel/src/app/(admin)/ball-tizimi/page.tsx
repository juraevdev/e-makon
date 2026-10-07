"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  FilterChip,
  LiveBadge,
  LoadingBlock,
  PrimaryButton,
  StatCard,
  StatusPill,
} from "@/components/ui";
import { fetchAllPages } from "@/components/care/fetchAllPages";
import { LoyaltySettingsCard } from "@/components/loyalty/LoyaltySettingsCard";
import { RewardFormModal, type RewardInput } from "@/components/loyalty/RewardFormModal";
import { TransactionsTable } from "@/components/loyalty/TransactionsTable";
import { api, asPage } from "@/lib/api/client";
import type { LoyaltyReward, LoyaltySettings, PointTransaction } from "@/lib/api/types";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/providers/ToastProvider";

type RewardFilter = "all" | "active" | "inactive";

function errText(err: unknown) {
  return err instanceof Error ? err.message : "Xatolik yuz berdi";
}

const fmt = (n: number) => n.toLocaleString("uz-UZ");

export default function BallTizimiPage() {
  const { showSuccess, showError } = useToast();
  const [savingSettings, setSavingSettings] = useState(false);
  const [editing, setEditing] = useState<LoyaltyReward | "new" | null>(null);
  const [deleting, setDeleting] = useState<LoyaltyReward | null>(null);
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [rewardFilter, setRewardFilter] = useState<RewardFilter>("all");

  const settings = useAsync(() => api<LoyaltySettings>("/admin/loyalty/settings/"), []);
  const rewards = useAsync(
    async () =>
      asPage<LoyaltyReward>(await api("/admin/loyalty-rewards/", { query: { page_size: 100, ordering: "sort_order" } })).results,
    [],
    { keepPrevious: true },
  );
  const txs = useAsync(() => fetchAllPages<PointTransaction>("/admin/loyalty-transactions/", { ordering: "-created_at" }, 10), [], {
    keepPrevious: true,
    live: 10000,
  });

  const rewardList = useMemo(() => rewards.data ?? [], [rewards.data]);
  const txList = useMemo(() => txs.data?.results ?? [], [txs.data]);

  const stats = useMemo(() => {
    let issued = 0;
    let redeemed = 0;
    let expired = 0;
    let adjusted = 0;
    const users = new Set<number>();
    const redeemCount = new Map<string, number>();
    for (const t of txList) {
      users.add(t.user);
      if (t.kind === "earn") issued += t.points;
      else if (t.kind === "redeem") {
        redeemed += Math.abs(t.points);
        redeemCount.set(t.note, (redeemCount.get(t.note) ?? 0) + 1);
      } else if (t.kind === "expire") expired += Math.abs(t.points);
      else adjusted += t.points;
    }
    return { issued, redeemed, expired, adjusted, users: users.size, redeemCount, outstanding: issued - redeemed - expired + adjusted };
  }, [txList]);

  const activeRewards = rewardList.filter((r) => r.is_active).length;
  const shownRewards = rewardList.filter((r) =>
    rewardFilter === "all" ? true : rewardFilter === "active" ? r.is_active : !r.is_active,
  );
  const nextSortOrder = rewardList.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;

  async function saveSettings(patch: Partial<LoyaltySettings>) {
    setSavingSettings(true);
    try {
      const saved = await api<LoyaltySettings>("/admin/loyalty/settings/", { method: "PATCH", body: patch });
      settings.setData(saved);
      showSuccess("Ball qoidalari saqlandi");
      return true;
    } catch (err) {
      showError(errText(err));
      return false;
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveReward(input: RewardInput) {
    const target = editing;
    setBusy(true);
    try {
      if (target && target !== "new") {
        const saved = await api<LoyaltyReward>(`/admin/loyalty-rewards/${target.id}/`, { method: "PATCH", body: input });
        rewards.setData((prev) => (prev ? prev.map((r) => (r.id === saved.id ? saved : r)) : prev));
        showSuccess("Mukofot yangilandi");
      } else {
        const created = await api<LoyaltyReward>("/admin/loyalty-rewards/", { method: "POST", body: input });
        rewards.setData((prev) => [...(prev ?? []), created].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
        showSuccess("Mukofot qo'shildi");
      }
      setEditing(null);
    } catch (err) {
      showError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleReward(r: LoyaltyReward) {
    setTogglingId(r.id);
    try {
      const saved = await api<LoyaltyReward>(`/admin/loyalty-rewards/${r.id}/`, { method: "PATCH", body: { is_active: !r.is_active } });
      rewards.setData((prev) => (prev ? prev.map((x) => (x.id === saved.id ? saved : x)) : prev));
      showSuccess(saved.is_active ? `"${saved.name}" faollashtirildi` : `"${saved.name}" o'chirib qo'yildi`);
    } catch (err) {
      showError(errText(err));
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteReward() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/loyalty-rewards/${deleting.id}/`, { method: "DELETE" });
      const id = deleting.id;
      rewards.setData((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      showSuccess("Mukofot o'chirildi");
      setDeleting(null);
    } catch (err) {
      showError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 pb-16 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl text-sm text-on-surface-variant md:text-base">
          Bajarilgan buyurtmalar uchun mijozlarga ball beriladi, ular mobil ilovada ballarni mukofotlarga almashtiradi.
        </p>
        <LiveBadge updatedAt={txs.updatedAt} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Berilgan ballar" value={fmt(stats.issued)} icon="add_circle" hint="Buyurtmalar uchun hisoblangan" />
        <StatCard label="Almashtirilgan" value={fmt(stats.redeemed)} icon="redeem" hint={`${stats.issued ? Math.round((stats.redeemed / stats.issued) * 100) : 0}% berilganidan`} />
        <StatCard label="Muomaladagi ballar" value={fmt(Math.max(0, stats.outstanding))} icon="account_balance_wallet" hint="Berilgan − sarflangan ± tuzatish" />
        <StatCard label="Tuzatish / jarima" value={`${stats.adjusted > 0 ? "+" : ""}${fmt(stats.adjusted)}`} icon="tune" hint={stats.expired ? `Muddati o'tgan: ${fmt(stats.expired)}` : undefined} />
        <StatCard label="Faol mukofotlar" value={`${activeRewards}`} suffix={`/ ${rewardList.length}`} icon="card_giftcard" />
        <StatCard label="Ishtirokchi mijozlar" value={fmt(stats.users)} icon="group" />
      </div>
      {txs.data?.truncated ? (
        <p className="-mt-3 text-xs text-amber-300">
          Statistika oxirgi {fmt(txList.length)} ta tranzaksiya bo&apos;yicha (jami {fmt(txs.data.count)}).
        </p>
      ) : null}

      <LoyaltySettingsCard settings={settings.data} error={settings.error} saving={savingSettings} onSave={saveSettings} />

      <section className="rounded-2xl border border-card-border bg-card/90 p-4 shadow-lg shadow-black/20 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="material-symbols-outlined text-primary">card_giftcard</span>
            Mukofotlar katalogi
          </h2>
          <PrimaryButton icon="add_circle" onClick={() => setEditing("new")}>
            Yangi mukofot
          </PrimaryButton>
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <FilterChip label="Barchasi" count={rewardList.length} active={rewardFilter === "all"} onClick={() => setRewardFilter("all")} />
          <FilterChip label="Faol" count={activeRewards} dot="bg-primary" active={rewardFilter === "active"} onClick={() => setRewardFilter("active")} />
          <FilterChip
            label="Nofaol"
            count={rewardList.length - activeRewards}
            dot="bg-on-surface-variant"
            active={rewardFilter === "inactive"}
            onClick={() => setRewardFilter("inactive")}
          />
        </div>

        {rewards.loading ? (
          <LoadingBlock />
        ) : rewards.error && !rewards.data ? (
          <p className="text-sm text-error">{rewards.error}</p>
        ) : !shownRewards.length ? (
          <EmptyState
            icon="redeem"
            title={rewardList.length ? "Bu filtrda mukofot yo'q" : "Mukofotlar hali yo'q"}
            description="Mijozlar ballarni almashtirishi uchun kamida bitta faol mukofot qo'shing."
            action={
              !rewardList.length ? (
                <PrimaryButton icon="add_circle" onClick={() => setEditing("new")}>
                  Birinchi mukofotni qo&apos;shish
                </PrimaryButton>
              ) : null
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shownRewards.map((r) => {
              const used = stats.redeemCount.get(r.name) ?? 0;
              const affordableFrom = settings.data ? Math.max(r.points_cost, settings.data.min_redeem_points) : r.points_cost;
              return (
                <div
                  key={r.id}
                  className={`flex flex-col rounded-2xl border p-4 transition ${
                    r.is_active ? "border-[#2b3f31] bg-gradient-to-b from-[#16211a] to-[#101512]" : "border-[#26352c] bg-[#0f1311] opacity-75"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                        r.is_active ? "border-primary/30 bg-primary/10 text-primary" : "border-[#26352c] text-on-surface-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[26px]">{r.icon || "redeem"}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold leading-snug">{r.name}</p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">Tartib: {r.sort_order}</p>
                    </div>
                    <StatusPill variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Faol" : "Nofaol"}</StatusPill>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {fmt(r.points_cost)} <span className="text-sm font-medium text-on-surface-variant">ball</span>
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {used ? `${used} marta almashtirilgan` : "Hali almashtirilmagan"}
                        {settings.data && affordableFrom > r.points_cost ? ` · min ${fmt(affordableFrom)} ball balans` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 border-t border-[#26352c] pt-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.is_active}
                      disabled={togglingId === r.id}
                      onClick={() => void toggleReward(r)}
                      className="mr-auto inline-flex items-center gap-2 text-xs text-on-surface-variant disabled:opacity-50"
                    >
                      <span className={`relative h-5 w-9 rounded-full transition ${r.is_active ? "bg-primary" : "bg-[#2a352e]"}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${r.is_active ? "left-[18px]" : "left-0.5"}`} />
                      </span>
                      {r.is_active ? "Faol" : "O'chiq"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      title="Tahrirlash"
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(r)}
                      title="O'chirish"
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <TransactionsTable
        items={txList}
        loading={txs.loading}
        error={txs.error}
        truncated={Boolean(txs.data?.truncated)}
        total={txs.data?.count ?? 0}
      />

      {editing ? (
        <RewardFormModal
          key={editing === "new" ? "new" : editing.id}
          reward={editing === "new" ? null : editing}
          nextSortOrder={nextSortOrder}
          minRedeem={settings.data?.min_redeem_points}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(input) => void saveReward(input)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title="Mukofotni o'chirish"
        description={
          <>
            <b>{deleting?.name}</b> katalogdan butunlay o&apos;chiriladi. Avval almashtirilgan ballar tarixi saqlanib qoladi. Vaqtincha
            yashirish uchun &quot;Nofaol&quot; qilish kifoya.
          </>
        }
        confirmText="O'chirish"
        variant="danger"
        busy={busy}
        onConfirm={() => void deleteReward()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
