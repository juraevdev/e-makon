import type { WeatherMood } from "@/lib/nav";

/** Toshkent — geolocation rad etilsa default (O‘zbekiston). */
export const DEFAULT_COORDS = { lat: 41.2995, lng: 69.2401, label: "tashkent" as const };

export type PlaceKey = "you" | "tashkent";

export type LiveWeather = {
  mood: WeatherMood;
  code: number;
  tempC: number;
  windKmh: number;
  isDay: boolean;
  lat: number;
  lng: number;
  place: PlaceKey;
  updatedAt: number;
};

type OpenMeteoResponse = {
  current?: {
    weather_code?: number;
    temperature_2m?: number;
    wind_speed_10m?: number;
    is_day?: number;
  };
};

/** WMO weather code → E-MAKON nature mood. */
export function mapWeatherCode(code: number, windKmh: number, tempC: number): WeatherMood {
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 95 && code <= 99) return "rain";
  if (code === 45 || code === 48) return "dew";
  if (windKmh >= 28) return "wind";
  if (code === 0 && tempC >= 32) return "dry";
  if (code === 0 || code === 1) return "sunny";
  if (code === 2 || code === 3) return windKmh >= 18 ? "wind" : "sunny";
  if (tempC >= 34 && windKmh < 18) return "dry";
  return "forest";
}

export async function fetchLiveWeather(
  lat: number,
  lng: number,
  place: PlaceKey = DEFAULT_COORDS.label,
): Promise<LiveWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=weather_code,temperature_2m,wind_speed_10m,is_day&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;
  const cur = data.current ?? {};
  const code = Number(cur.weather_code ?? 0);
  const tempC = Number(cur.temperature_2m ?? 20);
  const windKmh = Number(cur.wind_speed_10m ?? 0);
  const isDay = Number(cur.is_day ?? 1) === 1;
  return {
    mood: mapWeatherCode(code, windKmh, tempC),
    code,
    tempC,
    windKmh,
    isDay,
    lat,
    lng,
    place,
    updatedAt: Date.now(),
  };
}

export function readCoords(): Promise<{ lat: number; lng: number; place: PlaceKey }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ...DEFAULT_COORDS });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          place: "you",
        });
      },
      () => resolve({ ...DEFAULT_COORDS }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 15 * 60_000 },
    );
  });
}
