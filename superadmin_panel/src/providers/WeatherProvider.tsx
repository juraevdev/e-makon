"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { WeatherMood } from "@/lib/nav";
import {
  DEFAULT_COORDS,
  fetchLiveWeather,
  readCoords,
  type LiveWeather,
} from "@/lib/weather/client";

type WeatherContextValue = {
  mood: WeatherMood;
  live: LiveWeather | null;
  loading: boolean;
  refresh: () => void;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

const FALLBACK: LiveWeather = {
  mood: "sunny",
  code: 0,
  tempC: 24,
  windKmh: 8,
  isDay: true,
  lat: DEFAULT_COORDS.lat,
  lng: DEFAULT_COORDS.lng,
  place: DEFAULT_COORDS.place,
  updatedAt: 0,
};

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<LiveWeather | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const coords = await readCoords();
      const data = await fetchLiveWeather(coords.lat, coords.lng, coords.place);
      setLive(data);
    } catch {
      setLive((prev) => prev ?? FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20 * 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const value = useMemo(
    () => ({
      mood: live?.mood ?? "sunny",
      live,
      loading,
      refresh: () => void load(),
    }),
    [live, loading, load],
  );

  return (
    <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
  );
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be used within WeatherProvider");
  return ctx;
}
