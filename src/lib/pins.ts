export type Pin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
};

const STORAGE_KEY = "workation-map:pins";

export function loadPins(): Pin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Pin =>
        p &&
        typeof p.id === "string" &&
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        typeof p.title === "string"
    );
  } catch {
    return [];
  }
}

export function savePins(pins: Pin[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
