"use client";

import { useEffect, useRef, useState } from "react";

/** Productionda kalit majburiy (Yandex shartlari); kalitsiz faqat lokal sinov uchun yetarli. */
const YANDEX_MAPS_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY ?? "";

export type MapPointKind = "firm" | "order" | "worker" | "care";

export const MAP_COLORS: Record<MapPointKind, string> = {
  firm: "#42a5f5",
  order: "#ffb300",
  worker: "#66bb6a",
  care: "#ab47bc",
};

/** Yandex vidjeti faqat o'zining tayyor rangli belgilarini qabul qiladi. */
const WIDGET_MARKER: Record<MapPointKind, string> = {
  firm: "pm2blm",
  order: "pm2orm",
  worker: "pm2gnm",
  care: "pm2vvm",
};

export type MapPoint = {
  key: string;
  kind: MapPointKind;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
};

type LatLng = { lat: number; lng: number };
type Coords = [number, number];

/* Faqat ishlatiladigan Yandex Maps JS API 2.1 qismlari. */
type YEvents = { add(event: string, fn: () => void): void };
type YPlacemark = { events: YEvents };
type YGeoObjects = {
  add(obj: YPlacemark): void;
  remove(obj: YPlacemark): void;
  getBounds(): [Coords, Coords] | null;
};
type YMap = {
  geoObjects: YGeoObjects;
  setCenter(center: Coords, zoom?: number): void;
  setBounds(bounds: [Coords, Coords], opts?: Record<string, unknown>): void;
  panTo(center: Coords): Promise<void>;
  getZoom(): number;
  setZoom(zoom: number): void;
  destroy(): void;
};
type YandexNS = {
  ready(fn: () => void): void;
  Map: new (el: HTMLElement, state: Record<string, unknown>, opts?: Record<string, unknown>) => YMap;
  Placemark: new (coords: Coords, props: Record<string, unknown>, opts: Record<string, unknown>) => YPlacemark;
};

declare global {
  interface Window {
    ymaps?: YandexNS;
    __emakonYmapsLoader?: Promise<YandexNS>;
  }
}

function loadYandexMaps(): Promise<YandexNS> {
  if (window.ymaps?.Map) return Promise.resolve(window.ymaps);
  if (!window.__emakonYmapsLoader) {
    window.__emakonYmapsLoader = new Promise<YandexNS>((resolve, reject) => {
      const fail = () => {
        window.__emakonYmapsLoader = undefined;
        reject(new Error("Yandex xarita yuklanmadi"));
      };
      const script = document.createElement("script");
      const key = YANDEX_MAPS_KEY ? `apikey=${encodeURIComponent(YANDEX_MAPS_KEY)}&` : "";
      script.src = `https://api-maps.yandex.ru/2.1/?${key}lang=ru_RU`;
      script.async = true;
      script.onload = () => {
        const ymaps = window.ymaps;
        if (!ymaps) return fail();
        ymaps.ready(() => resolve(ymaps));
      };
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }
  return window.__emakonYmapsLoader;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function YandexMap({
  points,
  focusKey,
  onSelect,
  fallbackCenter,
}: {
  points: MapPoint[];
  focusKey?: string | null;
  onSelect?: (key: string) => void;
  fallbackCenter: LatLng;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<YMap | null>(null);
  const placemarks = useRef<Map<string, YPlacemark>>(new Map());
  const fitted = useRef(false);
  const initialCenter = useRef(fallbackCenter);
  const [ymaps, setYmaps] = useState<YandexNS | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadYandexMaps()
      .then((y) => alive && setYmaps(y))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ymaps || !el.current || map.current) return;
    const { lat, lng } = initialCenter.current;
    map.current = new ymaps.Map(
      el.current,
      {
        center: [lat, lng],
        zoom: 12,
        controls: ["zoomControl", "fullscreenControl", "typeSelector"],
      },
      { suppressMapOpenBlock: true },
    );
    const current = placemarks.current;
    return () => {
      map.current?.destroy();
      map.current = null;
      current.clear();
      fitted.current = false;
    };
  }, [ymaps]);

  useEffect(() => {
    const y = ymaps;
    const m = map.current;
    if (!y || !m) return;
    const current = placemarks.current;
    current.forEach((pm) => m.geoObjects.remove(pm));
    current.clear();

    points.forEach((p) => {
      const pm = new y.Placemark(
        [p.lat, p.lng],
        {
          hintContent: p.title,
          balloonContentHeader: escapeHtml(p.title),
          balloonContentBody: p.subtitle ? escapeHtml(p.subtitle) : "",
        },
        {
          preset: p.kind === "firm" ? "islands#circleDotIcon" : "islands#circleIcon",
          iconColor: MAP_COLORS[p.kind],
        },
      );
      pm.events.add("click", () => onSelect?.(p.key));
      m.geoObjects.add(pm);
      current.set(p.key, pm);
    });

    if (!fitted.current && points.length) {
      const bounds = points.length > 1 ? m.geoObjects.getBounds() : null;
      if (bounds) {
        m.setBounds(bounds, { checkZoomRange: true, zoomMargin: 48 });
      } else {
        m.setCenter([points[0].lat, points[0].lng], 14);
      }
      fitted.current = true;
    }
  }, [ymaps, points, onSelect]);

  useEffect(() => {
    const m = map.current;
    if (!m || !focusKey) return;
    const p = points.find((x) => x.key === focusKey);
    if (!p) return;
    void m.panTo([p.lat, p.lng]).then(() => {
      if (m.getZoom() < 15) m.setZoom(15);
    });
  }, [focusKey, points]);

  if (failed) {
    return <YandexEmbedMap points={points} focusKey={focusKey} fallbackCenter={fallbackCenter} />;
  }

  return (
    <div className="emakon-ymap absolute inset-0">
      <div ref={el} className="h-full w-full" />
      {!ymaps ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-outline">Xarita yuklanmoqda…</div>
      ) : null}
    </div>
  );
}

/** JS API yuklanmasa: kalitsiz Yandex vidjeti (iframe). Nuqtalarni ko'rsatadi, lekin bosib bo'lmaydi. */
function YandexEmbedMap({
  points,
  focusKey,
  fallbackCenter,
}: {
  points: MapPoint[];
  focusKey?: string | null;
  fallbackCenter: LatLng;
}) {
  const params = new URLSearchParams({ lang: "ru_RU" });
  const markers = points.slice(0, 100).map((p) => `${p.lng},${p.lat},${WIDGET_MARKER[p.kind]}`);
  if (markers.length) params.set("pt", markers.join("~"));

  const focused = focusKey ? points.find((p) => p.key === focusKey) : null;
  if (focused) {
    params.set("ll", `${focused.lng},${focused.lat}`);
    params.set("z", "16");
  } else if (points.length > 1) {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    params.set("bbox", `${Math.min(...lngs)},${Math.min(...lats)}~${Math.max(...lngs)},${Math.max(...lats)}`);
  } else {
    const c = points[0] ?? fallbackCenter;
    params.set("ll", `${c.lng},${c.lat}`);
    params.set("z", "13");
  }

  const src = `https://yandex.uz/map-widget/v1/?${params.toString()}`;
  return (
    <iframe
      key={src}
      title="Xarita"
      src={src}
      className="absolute inset-0 h-full w-full border-0"
      loading="lazy"
      allowFullScreen
    />
  );
}
