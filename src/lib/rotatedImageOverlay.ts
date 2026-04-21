import L from "@/lib/leafletGlobal";

// Minimal type shim for the plugin (no upstream types published).
type RotatedCtor = new (
  image: string | HTMLImageElement,
  topleft: L.LatLng,
  topright: L.LatLng,
  bottomleft: L.LatLng,
  options?: L.ImageOverlayOptions
) => L.ImageOverlay & {
  reposition(topleft: L.LatLng, topright: L.LatLng, bottomleft: L.LatLng): void;
};

// Attach the plugin once on the client. Importing its module mutates L.ImageOverlay.
let attached = false;
export async function ensureRotatedPlugin(): Promise<{ Rotated: RotatedCtor }> {
  if (!attached) {
    await import("leaflet-imageoverlay-rotated");
    attached = true;
  }
  const Rotated = (L.ImageOverlay as unknown as { Rotated: RotatedCtor }).Rotated;
  return { Rotated };
}
