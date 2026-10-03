"use client";

import { useState } from "react";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ROLE_LABEL } from "@/lib/domain";
import { useAuth } from "@/providers/AuthProvider";
import { useFirm } from "@/providers/FirmProvider";
import { useToast } from "@/providers/ToastProvider";

const RULES: { icon: string; title: string; text: string }[] = [
  {
    icon: "payments",
    title: "To'lov tizim hisobiga tushadi",
    text: "Mijoz Click yoki Payme orqali to'laydi, pul avval E-Makon hisobida ushlanadi. To'lov tasdiqlanmaguncha buyurtmani ishga olib bo'lmaydi.",
  },
  {
    icon: "verified",
    title: "Ish yakunlangach pul firmaga o'tadi",
    text: "Siz \"Ish yakunlandi\" deb belgilaganingizdan so'ng tizim ma'muriyati tasdiqlaydi va pul (platforma ulushi ayirilib) firmangiz hisobiga o'tkaziladi.",
  },
  {
    icon: "undo",
    title: "Bekor qilinsa pul mijozga qaytadi",
    text: "Ish bajarilmasa yoki buyurtma bekor qilinsa, ushlangan pul to'liq mijozga qaytariladi. Asossiz talablar jarima va sotuv taqiqiga olib keladi.",
  },
  {
    icon: "lock",
    title: "Narx to'lovdan keyin qulflanadi",
    text: "Narxni faqat yangi buyurtmada, mijoz to'lov qilishidan oldin belgilash mumkin. Keyingi o'zgarishlar faqat ma'muriyat orqali.",
  },
];

export default function SozlamalarPage() {
  const { user, refreshMe } = useAuth();
  const { firm } = useFirm();
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
  });

  async function saveProfile() {
    setBusy(true);
    try {
      await api("/auth/me/", { method: "PATCH", body: profile });
      await refreshMe();
      showSuccess("Profil saqlandi");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6">
        <h3 className="mb-1 text-xl font-semibold">Mening profilim</h3>
        <p className="mb-4 text-xs text-on-surface-variant">
          {ROLE_LABEL[user?.role || "admin"]}
          {firm ? ` · ${firm.name}` : ""}
        </p>
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

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6">
        <h3 className="mb-1 text-xl font-semibold">Platforma qoidalari</h3>
        <p className="mb-5 text-xs text-on-surface-variant">
          Mijoz bilan xavfsiz va ishonchli aloqa uchun hisob-kitob tizim orqali amalga oshiriladi.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {RULES.map((r) => (
            <div key={r.title} className="flex gap-3 rounded-xl border border-[#263b2a] bg-[#131b15] p-4">
              <span className="material-symbols-outlined text-primary">{r.icon}</span>
              <div>
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-on-surface-variant">
          Parolni tiklash yoki yangi firma admini qo&apos;shish uchun tizim ma&apos;muriyatiga murojaat qiling.
        </p>
      </section>
    </div>
  );
}
