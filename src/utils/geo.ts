// utils/geo.ts
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export type LatLng = { lat: number; lng: number };

export async function geocodeAddress(address: string, apiKey: string): Promise<LatLng> {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&language=ja&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

// ハバーサイン（球面三角法）
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // 地球半径(km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 住所→住所の直線距離（km）
export async function distanceBetweenAddressesKm(addr1: string, addr2: string, apiKey: string) {
  const [p1, p2] = await Promise.all([geocodeAddress(addr1, apiKey), geocodeAddress(addr2, apiKey)]);
  return haversineKm(p1, p2);
}
