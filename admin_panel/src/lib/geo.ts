type Coord = string | number | null | undefined;

const toNum = (v: Coord) => (v === null || v === undefined || v === "" ? null : Number(v));

export function distanceKm(lat1: Coord, lng1: Coord, lat2: Coord, lng2: Coord): number | null {
  const [a, b, c, d] = [toNum(lat1), toNum(lng1), toNum(lat2), toNum(lng2)];
  if (a === null || b === null || c === null || d === null) return null;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(c - a);
  const dLng = rad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** To'g'ri chiziqli masofani yo'l masofasiga (×1.3) va shahar tezligiga (~30 km/soat) aylantiradi. */
export function suggestRoute(straightKm: number | null) {
  if (straightKm === null) return null;
  const roadKm = Math.max(0.5, straightKm * 1.3);
  const minutes = Math.round((roadKm / 30) * 60 + 10);
  return { km: Math.round(roadKm * 10) / 10, minutes };
}

export function mapsLink(lat: Coord, lng: Coord, address?: string) {
  const [a, b] = [toNum(lat), toNum(lng)];
  if (a !== null && b !== null) return `https://www.google.com/maps/search/?api=1&query=${a},${b}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
}

export function directionsLink(fromLat: Coord, fromLng: Coord, toLat: Coord, toLng: Coord, toAddress?: string) {
  const dest =
    toNum(toLat) !== null && toNum(toLng) !== null ? `${toNum(toLat)},${toNum(toLng)}` : toAddress || "";
  if (!dest) return null;
  const origin =
    toNum(fromLat) !== null && toNum(fromLng) !== null ? `&origin=${toNum(fromLat)},${toNum(fromLng)}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}
