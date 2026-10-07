"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { AdminProfile } from "@/lib/api/types";
import { ROLE_LABEL } from "@/lib/domain";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";

export default function SozlamalarPage() {
  const { user, refreshMe } = useAuth();
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
  });

  const { data, loading, error } = useAsync(async () => {
    const raw = await api("/admin/admins/", { query: { page_size: 50 } });
    return asPage<AdminProfile>(raw).results;
  }, []);

  async function saveProfile() {
    setBusy(true);
    try {
      await api("/auth/me/", { method: "PATCH", body: profile });
      await refreshMe();
      showSuccess("Profil saqlandi");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Profil saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6">
        <h3 className="mb-4 text-xl font-semibold">Mening profilim</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Ism">
            <input className={inputClass} value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
          </Field>
          <Field label="Familiya">
            <input className={inputClass} value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className={inputClass} value={user?.phone || ""} disabled />
          </Field>
        </div>
        <div className="mt-4">
          <PrimaryButton disabled={busy} onClick={() => void saveProfile()}>Saqlash</PrimaryButton>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low">
        <div className="flex items-center justify-between border-b border-surface-container-highest/60 p-6">
          <div>
            <h3 className="text-xl font-semibold">Administratorlar</h3>
            <p className="text-xs text-on-surface-variant">Panelga telefon + parol bilan kiradigan adminlar</p>
          </div>
          <Link
            href="/administratorlar"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black"
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            Boshqarish
          </Link>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <p className="p-6 text-error">{error}</p>
        ) : !data?.length ? (
          <EmptyState icon="admin_panel_settings" title="Adminlar ro'yxati bo'sh" />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-surface-variant/40 text-xs uppercase text-on-surface-variant">
                {["Ism", "Rol", "Telefon", "Lavozim", "Holat"].map((h) => (
                  <th key={h} className="px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/20">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-4 font-medium">{a.user.full_name || a.user.phone}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{ROLE_LABEL[a.user.role]}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.user.phone}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.title}</td>
                  <td className="px-6 py-4">
                    <StatusPill variant={a.is_active ? "success" : "neutral"} pulse={a.is_active}>
                      {a.is_active ? "Faol" : "Nofaol"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
