const pad2 = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ro'yxat uchun qisqa vaqt: bugun — soat, shu hafta — "2 kun", aks holda sana. */
export function listTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (sameDay(d, now)) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Kecha";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}${d.getFullYear() !== now.getFullYear() ? `.${d.getFullYear()}` : ""}`;
}

export function clockTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function dayKey(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(value: string) {
  const d = new Date(value);
  const now = new Date();
  if (sameDay(d, now)) return "Bugun";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Kecha";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

/** Oxirgi xabardan beri o'tgan daqiqalar. */
export function minutesSince(value: string | null | undefined) {
  if (!value) return 0;
  return Math.floor((new Date().getTime() - new Date(value).getTime()) / 60000);
}
