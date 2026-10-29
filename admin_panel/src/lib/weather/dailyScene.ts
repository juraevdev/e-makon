/** Fasl + jonli ob-havo asosida tabiat manzarasi. */

import type { WeatherMood } from "@/lib/nav";
import { SEASON_BG, SEASON_FLORA } from "@/lib/weather/assets";
import { currentSeason, type Season } from "@/lib/weather/season";

export type DailyScene = {
  season: Season;
  photo: string;
  floraPhoto: string;
  labelKey: string;
  wind: number;
  rain: boolean;
  dew: boolean;
  mist: boolean;
  snow: boolean;
  /** Faqat kuzda (yoki kuchli shamolda kuz/yoz oxiri) barg tushadi. */
  leaves: boolean;
};

export function getDailyScene(date = new Date()): DailyScene {
  const season = currentSeason(date);
  return {
    season,
    photo: SEASON_BG[season],
    floraPhoto: SEASON_FLORA[season],
    labelKey: `season.${season}`,
    wind: season === "autumn" || season === "spring" ? 0.45 : 0.25,
    rain: false,
    dew: season === "spring",
    mist: season === "winter",
    snow: season === "winter",
    leaves: season === "autumn",
  };
}

/** Jonli ob-havo fasl fonini saqlab, effektlarni qo‘shadi. */
export function blendWithLiveMood(
  scene: DailyScene,
  liveMood?: WeatherMood | string,
): DailyScene {
  if (!liveMood) return scene;

  if (liveMood === "rain") {
    return {
      ...scene,
      rain: true,
      mist: true,
      snow: false,
      dew: false,
      leaves: scene.season === "autumn",
      wind: Math.max(scene.wind, 0.4),
    };
  }

  if (liveMood === "snow") {
    return {
      ...scene,
      snow: true,
      rain: false,
      leaves: false,
      mist: true,
      dew: false,
      photo: SEASON_BG.winter,
      floraPhoto: SEASON_FLORA.winter,
    };
  }

  if (liveMood === "dew") {
    return { ...scene, dew: true, mist: false };
  }

  if (liveMood === "wind") {
    return {
      ...scene,
      wind: Math.max(scene.wind, 0.8),
      // shamolda faqat kuzda barg
      leaves: scene.season === "autumn",
    };
  }

  if (liveMood === "dry") {
    return { ...scene, dew: false, mist: false, rain: false };
  }

  return scene;
}
