// iOS device specs used to generate apple-touch-startup-image media queries.
// Each entry encodes [portrait px width, portrait px height, CSS width, CSS height, DPR].
// File names follow pwa-asset-generator's pattern: apple-splash-{pxW}-{pxH}.jpg
// (portrait) and apple-splash-{pxH}-{pxW}.jpg (landscape).

export type SplashDevice = {
  pxW: number;
  pxH: number;
  cssW: number;
  cssH: number;
  dpr: number;
};

export const SPLASH_DEVICES: SplashDevice[] = [
  // iPhones
  { pxW: 640, pxH: 1136, cssW: 320, cssH: 568, dpr: 2 }, // SE 1st
  { pxW: 750, pxH: 1334, cssW: 375, cssH: 667, dpr: 2 }, // 6/7/8/SE 2-3
  { pxW: 828, pxH: 1792, cssW: 414, cssH: 896, dpr: 2 }, // XR/11
  { pxW: 1125, pxH: 2436, cssW: 375, cssH: 812, dpr: 3 }, // X/XS/11 Pro
  { pxW: 1170, pxH: 2532, cssW: 390, cssH: 844, dpr: 3 }, // 12/13/14
  { pxW: 1179, pxH: 2556, cssW: 393, cssH: 852, dpr: 3 }, // 14 Pro/15/15 Pro
  { pxW: 1206, pxH: 2622, cssW: 402, cssH: 874, dpr: 3 }, // 15 Plus/16
  { pxW: 1242, pxH: 2208, cssW: 414, cssH: 736, dpr: 3 }, // 6+/7+/8+
  { pxW: 1242, pxH: 2688, cssW: 414, cssH: 896, dpr: 3 }, // XS Max/11 Pro Max
  { pxW: 1260, pxH: 2736, cssW: 420, cssH: 912, dpr: 3 }, // 16 Pro
  { pxW: 1284, pxH: 2778, cssW: 428, cssH: 926, dpr: 3 }, // 12/13 Pro Max/14 Plus
  { pxW: 1290, pxH: 2796, cssW: 430, cssH: 932, dpr: 3 }, // 14/15 Pro Max
  { pxW: 1320, pxH: 2868, cssW: 440, cssH: 956, dpr: 3 }, // 16 Pro Max
  // iPads
  { pxW: 1488, pxH: 2266, cssW: 744, cssH: 1133, dpr: 2 }, // mini 6
  { pxW: 1536, pxH: 2048, cssW: 768, cssH: 1024, dpr: 2 }, // 9.7"
  { pxW: 1620, pxH: 2160, cssW: 810, cssH: 1080, dpr: 2 }, // 10.2" (7-9)
  { pxW: 1640, pxH: 2360, cssW: 820, cssH: 1180, dpr: 2 }, // 10.9" (10)
  { pxW: 1668, pxH: 2224, cssW: 834, cssH: 1112, dpr: 2 }, // Pro 10.5/Air 10.5
  { pxW: 1668, pxH: 2388, cssW: 834, cssH: 1194, dpr: 2 }, // Pro 11"/Air 11"
  { pxW: 2048, pxH: 2732, cssW: 1024, cssH: 1366, dpr: 2 }, // Pro 12.9"
];

export type SplashLink = {
  href: string;
  media: string;
};

export function appleSplashLinks(): SplashLink[] {
  const out: SplashLink[] = [];
  for (const d of SPLASH_DEVICES) {
    out.push({
      href: `/apple-splash-${d.pxW}-${d.pxH}.jpg`,
      media: `(device-width: ${d.cssW}px) and (device-height: ${d.cssH}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)`,
    });
    out.push({
      href: `/apple-splash-${d.pxH}-${d.pxW}.jpg`,
      media: `(device-width: ${d.cssW}px) and (device-height: ${d.cssH}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: landscape)`,
    });
  }
  return out;
}
