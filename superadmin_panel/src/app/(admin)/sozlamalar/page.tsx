"use client";

import { useState } from "react";
import { PrimaryButton, SecondaryButton, StatusPill } from "@/components/ui";

const tabs = [
  { id: "general", label: "Umumiy sozlamalar", icon: "tune" },
  { id: "security", label: "Xavfsizlik va Kirish", icon: "shield_person" },
  { id: "notifications", label: "Bildirishnomalar", icon: "notifications_active" },
  { id: "integrations", label: "Integratsiyalar", icon: "hub" },
] as const;

const admins = [
  { name: "Admin User", role: "SuperAdmin", email: "admin@e-makon.eco", status: "Faol" as const },
  { name: "Nodira Karimova", role: "Moderator", email: "nodira@e-makon.eco", status: "Faol" as const },
  { name: "Bekzod Aliyev", role: "Support", email: "bekzod@e-makon.eco", status: "Nofaol" as const },
];

export default function SozlamalarPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("general");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 p-4 md:p-8">
      <div className="mb-2 flex flex-col justify-between gap-4 border-b border-surface-container-highest/60 pb-0 sm:flex-row sm:items-center">
        <div className="-mb-px flex items-center gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 pt-1 pb-3.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:border-outline-variant/40 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3 pb-3 sm:pb-2.5">
          <SecondaryButton icon="history">Tarix</SecondaryButton>
          <button
            type="button"
            className="relative flex items-center gap-2.5 overflow-hidden rounded-full border border-primary/40 px-5 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:border-primary active:scale-95"
            style={{
              background:
                "linear-gradient(135deg, rgba(46, 125, 50, 0.95) 0%, rgba(20, 60, 24, 0.98) 100%)",
              boxShadow:
                "rgba(74, 222, 128, 0.25) 0px 0px 20px, rgba(255, 255, 255, 0.25) 0px 1px 1px inset",
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/20 text-primary">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                check
              </span>
            </span>
            <span className="tracking-wide text-on-primary-container">O&apos;zgarishlarni saqlash</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-6 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 shadow-lg lg:col-span-6">
          <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl">settings_suggest</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-on-surface">Umumiy sozlamalar</h3>
                <p className="text-xs text-on-surface-variant">
                  Tizimning asosiy profili va tashkiliy tafsilotlari
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Asosiy profil
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[
              { label: "Ilova nomi", icon: "badge", type: "text", value: "E-MAKON Ekologik Xizmatlar" },
              { label: "Aloqa telefoni", icon: "call", type: "tel", value: "+998 (71) 200-88-99" },
              { label: "Ish vaqti rejimi", icon: "schedule", type: "text", value: "Dushanba - Shanba, 08:30 - 20:00" },
              { label: "Qo'llab-quvvatlash emaili", icon: "mail", type: "email", value: "support@e-makon.eco" },
            ].map((field) => (
              <div key={field.label} className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant">
                  <span className="material-symbols-outlined text-base text-primary">{field.icon}</span>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  defaultValue={field.value}
                  className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest/80 px-4 py-3 text-base text-on-surface shadow-inner outline-none transition-all hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-primary">payments</span>
                Asosiy valyuta
              </label>
              <select className="cursor-pointer rounded-xl border border-outline-variant/40 bg-surface-container-lowest/80 px-4 py-3 text-base text-on-surface shadow-inner outline-none transition-all hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20">
                <option>UZS (O&apos;zbekiston so&apos;mi)</option>
                <option>USD (AQSh dollari)</option>
                <option>EUR (Yevro)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-primary">language</span>
                Standart tizim tili
              </label>
              <select className="cursor-pointer rounded-xl border border-outline-variant/40 bg-surface-container-lowest/80 px-4 py-3 text-base text-on-surface shadow-inner outline-none transition-all hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20">
                <option>O&apos;zbek tili (Lotin)</option>
                <option>Ingliz tili (AQSh)</option>
                <option>Rus tili</option>
              </select>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 shadow-lg lg:col-span-6">
          <div className="flex items-center gap-3 border-b border-surface-container-highest/60 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">shield</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-on-surface">Xavfsizlik va Kirish</h3>
              <p className="text-xs text-on-surface-variant">Autentifikatsiya va sessiya siyosati</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { title: "Ikki bosqichli autentifikatsiya (2FA)", desc: "Barcha adminlar uchun majburiy", on: true },
              { title: "Sessiya muddati", desc: "Nofaol holatda 30 daqiqadan so'ng chiqish", on: true },
              { title: "IP cheklovi", desc: "Faqat ruxsat etilgan ofis IP manzillari", on: false },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest/60 p-4"
              >
                <div>
                  <p className="font-semibold text-on-surface">{item.title}</p>
                  <p className="text-xs text-on-surface-variant">{item.desc}</p>
                </div>
                <button
                  type="button"
                  className={`relative h-7 w-12 rounded-full transition-colors ${item.on ? "bg-primary-container" : "bg-surface-container-highest"}`}
                  aria-pressed={item.on}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${item.on ? "left-5" : "left-0.5"}`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 shadow-lg lg:col-span-5">
          <div className="flex items-center gap-3 border-b border-surface-container-highest/60 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">notifications_active</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-on-surface">Bildirishnomalar</h3>
              <p className="text-xs text-on-surface-variant">Kanallar va ogohlantirishlar</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "Yangi buyurtma", channels: "Email, Push" },
              { label: "Hamkor arizasi", channels: "Email" },
              { label: "To'lov xatosi", channels: "Email, SMS" },
              { label: "Sharh moderatsiyasi", channels: "Push" },
            ].map((n) => (
              <div
                key={n.label}
                className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest/60 px-4 py-3"
              >
                <span className="font-medium text-on-surface">{n.label}</span>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                  {n.channels}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 shadow-lg lg:col-span-7">
          <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl">hub</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-on-surface">Tizim integratsiyalari</h3>
                <p className="text-xs text-on-surface-variant">Tashqi xizmatlar ulanishi</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { name: "Click / Payme", status: "Ulangan", icon: "payments" },
              { name: "SMS Gateway", status: "Ulangan", icon: "sms" },
              { name: "Firebase Push", status: "Ulangan", icon: "cloud" },
              { name: "Google Maps", status: "Sozlash kerak", icon: "map" },
            ].map((i) => (
              <div
                key={i.name}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest/60 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">{i.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-on-surface">{i.name}</p>
                  <StatusPill variant={i.status === "Ulangan" ? "success" : "warning"}>
                    {i.status}
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="col-span-1 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low shadow-lg lg:col-span-12">
          <div className="flex items-center justify-between border-b border-surface-container-highest/60 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-on-surface">Administratorlar ro&apos;yxati va rollari</h3>
                <p className="text-xs text-on-surface-variant">Kirish huquqlari va rollar</p>
              </div>
            </div>
            <PrimaryButton icon="person_add">Admin qo&apos;shish</PrimaryButton>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-variant/40 bg-surface-container-lowest text-xs tracking-wider text-on-surface-variant uppercase">
                  {["Ism", "Rol", "Email", "Holat", ""].map((h) => (
                    <th key={h || "a"} className="px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/20">
                {admins.map((a) => (
                  <tr key={a.email} className="hover:bg-surface-container-high/40">
                    <td className="px-6 py-4 font-medium text-on-surface">{a.name}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{a.role}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{a.email}</td>
                    <td className="px-6 py-4">
                      <StatusPill variant={a.status === "Faol" ? "success" : "neutral"} pulse={a.status === "Faol"}>
                        {a.status}
                      </StatusPill>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className="rounded-lg p-2 text-on-surface-variant hover:text-primary">
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
