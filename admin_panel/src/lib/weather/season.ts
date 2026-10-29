import type { WeatherMood } from "@/lib/nav";

export type Season = "spring" | "summer" | "autumn" | "winter";

/** O‘zbekiston iqlimiga yaqin fasl (shimoliy yarimshar). */
export function currentSeason(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

export function seasonLabelKey(season: Season): string {
  return `season.${season}`;
}

/** Fasl + jonli ob-havo birga: kuzda barglar + yomg‘ir/quyosh. */
export function weatherScene(mood: WeatherMood, season: Season = currentSeason()) {
  return { mood, season };
}
