export type LatLng = { lat: number; lng: number };

// Two-point similarity placement: topLeft and topRight define translation, rotation
// and uniform scale. bottomLeft is derived from the image's natural aspect ratio,
// so the artwork is never skewed.
export type Placement = {
  topLeft: LatLng;
  topRight: LatLng;
};

// Calibrated placement for Creta Maris Beach Resort, Hersonissos, Crete.
// Produced in /calibrate. Re-run the calibrator if the artwork changes.
export const DEFAULT_PLACEMENT: Placement = {
  topLeft: {
    lat: 35.324929713920554,
    lng: 25.38067102432251,
  },
  topRight: {
    lat: 35.32720997060588,
    lng: 25.38778424263001,
  },
};

export const RESORT_CENTER: LatLng = { lat: 35.3165, lng: 25.409 };

export const STORAGE_KEY = "workation-map:placement";

export function loadPlacement(): Placement {
  if (typeof window === "undefined") return DEFAULT_PLACEMENT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLACEMENT;
    const parsed = JSON.parse(raw) as Placement;
    if (parsed?.topLeft?.lat != null && parsed?.topRight?.lat != null) {
      return parsed;
    }
  } catch {}
  return DEFAULT_PLACEMENT;
}

export function savePlacement(p: Placement) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// Derive bottom-left corner so the image keeps its natural aspect ratio.
// aspect = naturalHeight / naturalWidth. Uses a local flat-earth approximation.
export function deriveBottomLeft(p: Placement, aspect: number): LatLng {
  const { topLeft: tl, topRight: tr } = p;
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111320 * Math.cos((tl.lat * Math.PI) / 180);
  const dxE = (tr.lng - tl.lng) * metersPerDegLng;
  const dyN = (tr.lat - tl.lat) * metersPerDegLat;
  // "Down" on the image is the top edge rotated -90° (clockwise): (x,y) -> (y,-x).
  const downE = dyN * aspect;
  const downN = -dxE * aspect;
  return {
    lat: tl.lat + downN / metersPerDegLat,
    lng: tl.lng + downE / metersPerDegLng,
  };
}

// Bearing (degrees clockwise from north) of the image's top edge: TL -> TR.
// Used to counter-rotate the map so the artwork appears axis-aligned on screen.
export function placementBearingDeg(p: Placement): number {
  const { topLeft: tl, topRight: tr } = p;
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111320 * Math.cos((tl.lat * Math.PI) / 180);
  const dxE = (tr.lng - tl.lng) * metersPerDegLng;
  const dyN = (tr.lat - tl.lat) * metersPerDegLat;
  return (Math.atan2(dxE, dyN) * 180) / Math.PI;
}

// Geometric centre of the rectangle, for the Move handle.
export function deriveCenter(p: Placement, aspect: number): LatLng {
  const { topLeft: tl, topRight: tr } = p;
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111320 * Math.cos((tl.lat * Math.PI) / 180);
  const dxE = (tr.lng - tl.lng) * metersPerDegLng;
  const dyN = (tr.lat - tl.lat) * metersPerDegLat;
  const cx = dxE / 2 + (dyN * aspect) / 2;
  const cy = dyN / 2 + (-dxE * aspect) / 2;
  return {
    lat: tl.lat + cy / metersPerDegLat,
    lng: tl.lng + cx / metersPerDegLng,
  };
}
