/** Quyosh / oy pozitsiyasi — lokal vaqt bo‘yicha silliq harakat. */

export type SkyBody = {
  /** 0 = tong, 0.5 = tush, 1 = tun */
  dayProgress: number;
  /** Quyosh ko‘rinadi */
  sunVisible: boolean;
  /** Oy ko‘rinadi */
  moonVisible: boolean;
  /** Foiz: left */
  sunX: number;
  /** Foiz: top (pastga qarab o‘sadi) */
  sunY: number;
  moonX: number;
  moonY: number;
  /** Osmon rangi intensivi */
  warmth: number;
  isNight: boolean;
  isDusk: boolean;
  isDawn: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** 24 soatlik yoy: 6:00 chiqish, 12:00 zenit, 18:00 botish. */
export function getSkyBody(now = new Date()): SkyBody {
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const dayProgress = h / 24;

  // Quyosh 5:30–19:30 oralig‘ida
  const sunStart = 5.5;
  const sunEnd = 19.5;
  const sunSpan = sunEnd - sunStart;
  const sunT = clamp((h - sunStart) / sunSpan, 0, 1);
  const sunVisible = h >= sunStart && h <= sunEnd;
  // Parabola: yuqorida tushda
  const sunX = 8 + sunT * 84;
  const sunY = 8 + Math.pow(2 * sunT - 1, 2) * 42;

  // Oy: tunda (18:00–6:00)
  const night = h < 6 || h >= 18.2;
  let moonT = 0;
  if (h >= 18.2) moonT = (h - 18.2) / (6 + (24 - 18.2));
  else if (h < 6) moonT = (h + (24 - 18.2)) / (6 + (24 - 18.2));
  moonT = clamp(moonT, 0, 1);
  const moonX = 10 + moonT * 80;
  const moonY = 12 + Math.pow(2 * moonT - 1, 2) * 36;

  const isDawn = h >= 5 && h < 7.5;
  const isDusk = h >= 17.5 && h < 20;
  const isNight = h < 5.5 || h >= 20;
  const warmth = isDawn || isDusk ? 0.85 : sunVisible ? 0.55 : 0.15;

  return {
    dayProgress,
    sunVisible,
    moonVisible: night || isDusk,
    sunX,
    sunY,
    moonX,
    moonY,
    warmth,
    isNight,
    isDusk,
    isDawn,
  };
}
