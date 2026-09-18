"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { inputClass } from "@/components/ui";

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const [phone, setPhone] = useState("+998901000000");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Faqat sessiyani tekshirayotganda yoki muvaffaqiyatli kirib yo'naltirilayotganda spinner
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kirish muvaffaqiyatsiz";
      setError(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "API ishlamayapti. Backendni ishga tushiring: python manage.py runserver"
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px] rounded-3xl border border-[#26352c] bg-[#151917] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-3xl font-bold text-primary">E-MAKON</p>
          <p className="mt-2 text-sm text-on-surface-variant">SuperAdmin paneli</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-on-surface-variant">Telefon</span>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-on-surface-variant">Parol</span>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition hover:bg-primary disabled:opacity-60"
          >
            {busy ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">login</span>
            )}
            Kirish
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-on-surface-variant">
          Mobil ilova bilan bir xil foydalanuvchi, buyurtma va xizmatlar katalogi.
        </p>
      </div>
    </div>
  );
}
