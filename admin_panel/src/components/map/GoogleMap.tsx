"use client";

import { useEffect, useRef, useState } from "react";

/** Kalit bo'lmasa sahifalar kalitsiz `EmbedMap` (iframe) dan foydalanadi. */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export type MapPoint = {
  key: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  color: string;
};

type LatLng = { lat: number; lng: number };

/* Faqat ishlatiladigan Google Maps JS API qismlari. */
type GMap = {
  fitBounds(bounds: GBounds, padding?: number): void;
  panTo(pos: LatLng): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
  setCenter(pos: LatLng): void;
};
type GBounds = { extend(pos: LatLng): void };
type GMarker = {
  setMap(map: GMap | null): void;
  addListener(event: string, fn: () => void): void;
  getPosition(): LatLng;
};
type GInfoWindow = { setContent(html: string): void; open(opts: { map: GMap; anchor: GMarker }): void; close(): void };
type GoogleNS = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMarker;
    InfoWindow: new () => GInfoWindow;
    LatLngBounds: new () => GBounds;
    SymbolPath: { CIRCLE: number };
  };
};

declare global {
  interface Window {
    google?: GoogleNS;
    __emakonMapsLoader?: Promise<GoogleNS>;
  }
}

function loadGoogleMaps(): Promise<GoogleNS> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (!window.__emakonMapsLoader) {
    window.__emakonMapsLoader = new Promise<GoogleNS>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&language=uz`;
      script.async = true;
      script.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google Maps yuklanmadi")));
      script.onerror = () => {
        window.__emakonMapsLoader = undefined;
        reject(new Error("Google Maps yuklanmadi"));
      };
      document.head.appendChild(script);
    });
  }
  return window.__emakonMapsLoader;
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1f1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9485" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#121414" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b332e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a20" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function GoogleMap({
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
  const map = useRef<GMap | null>(null);
  const info = useRef<GInfoWindow | null>(null);
  const markers = useRef<Map<string, GMarker>>(new Map());
  const fitted = useRef(false);
  const [google, setGoogle] = useState<GoogleNS | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then((g) => alive && setGoogle(g))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!google || !el.current || map.current) return;
    map.current = new google.maps.Map(el.current, {
      center: fallbackCenter,
      zoom: 12,
      styles: DARK_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
    });
    info.current = new google.maps.InfoWindow();
  }, [google, fallbackCenter]);

  useEffect(() => {
    const g = google;
    const m = map.current;
    if (!g || !m) return;
    const current = markers.current;
    const keys = new Set(points.map((p) => p.key));
    current.forEach((marker, key) => {
      if (!keys.has(key)) {
        marker.setMap(null);
        current.delete(key);
      }
    });
    points.forEach((p) => {
      current.get(p.key)?.setMap(null);
      const marker = new g.maps.Marker({
        map: m,
        position: { lat: p.lat, lng: p.lng },
        title: p.title,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: p.key === "firm" ? 10 : 8,
          fillColor: p.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        onSelect?.(p.key);
        info.current?.setContent(
          `<div style="color:#111;font:13px sans-serif"><b>${escapeHtml(p.title)}</b>${
            p.subtitle ? `<br/>${escapeHtml(p.subtitle)}` : ""
          }</div>`,
        );
        info.current?.open({ map: m, anchor: marker });
      });
      current.set(p.key, marker);
    });

    if (!fitted.current && points.length) {
      if (points.length === 1) {
        m.setCenter({ lat: points[0].lat, lng: points[0].lng });
        m.setZoom(14);
      } else {
        const bounds = new g.maps.LatLngBounds();
        points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        m.fitBounds(bounds, 48);
      }
      fitted.current = true;
    }
  }, [google, points, onSelect]);

  useEffect(() => {
    const m = map.current;
    if (!m || !focusKey) return;
    const p = points.find((x) => x.key === focusKey);
    if (!p) return;
    m.panTo({ lat: p.lat, lng: p.lng });
    if ((m.getZoom() ?? 0) < 15) m.setZoom(15);
  }, [focusKey, points]);

  if (failed) {
    return <EmbedMap lat={fallbackCenter.lat} lng={fallbackCenter.lng} zoom={13} />;
  }

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
      {!google ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-outline">Xarita yuklanmoqda…</div>
      ) : null}
    </div>
  );
}

/** API kalitisiz ishlaydigan Google xarita (iframe). Bir vaqtda bitta nuqtani ko'rsatadi. */
export function EmbedMap({ lat, lng, zoom = 13 }: { lat: number; lng: number; zoom?: number }) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=uz&output=embed`;
  return (
    <iframe
      key={src}
      title="Xarita"
      src={src}
      className="absolute inset-0 h-full w-full border-0 [filter:invert(0.9)_hue-rotate(180deg)_saturate(0.6)]"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
