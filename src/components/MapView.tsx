"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "@/lib/leafletGlobal";
import "leaflet/dist/leaflet.css";
import "leaflet-rotate";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  Placement,
  deriveBottomLeft,
  deriveCenter,
  loadPlacement,
  placementBearingDeg,
} from "@/lib/georeference";
import { loadImageAspect } from "@/lib/imageAspect";
import { ensureRotatedPlugin } from "@/lib/rotatedImageOverlay";
import {
  needsOrientationPermission,
  requestOrientationPermission,
  subscribeHeading,
} from "@/lib/heading";
import PinsLayer from "@/components/PinsLayer";

const MAP_IMAGE = "/map.png";

function cornersBounds(p: Placement, aspect: number) {
  const tl = p.topLeft;
  const tr = p.topRight;
  const bl = deriveBottomLeft(p, aspect);
  const br = {
    lat: tr.lat + (bl.lat - tl.lat),
    lng: tr.lng + (bl.lng - tl.lng),
  };
  return L.latLngBounds([
    [tl.lat, tl.lng],
    [tr.lat, tr.lng],
    [br.lat, br.lng],
    [bl.lat, bl.lng],
  ]);
}

function RotatedImage({
  p,
  aspect,
  opacity,
}: {
  p: Placement;
  aspect: number;
  opacity: number;
}) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tl = L.latLng(p.topLeft.lat, p.topLeft.lng);
    const tr = L.latLng(p.topRight.lat, p.topRight.lng);
    const bl = deriveBottomLeft(p, aspect);
    const blLL = L.latLng(bl.lat, bl.lng);
    (async () => {
      const { Rotated } = await ensureRotatedPlugin();
      if (cancelled) return;
      const overlay = new Rotated(MAP_IMAGE, tl, tr, blLL, {
        opacity,
        interactive: false,
      });
      overlay.addTo(map);
      overlayRef.current = overlay;
    })();
    return () => {
      cancelled = true;
      overlayRef.current?.remove();
      overlayRef.current = null;
    };
    // Opacity handled separately to avoid re-creating the overlay on slider changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, p, aspect]);

  useEffect(() => {
    overlayRef.current?.setOpacity(opacity);
  }, [opacity]);

  return null;
}

function makeDotIcon(heading: number | null, mapBearing: number) {
  // Heading is compass degrees (CW from north). leaflet-rotate rotates the map
  // clockwise by mapBearing, so on-screen angle = heading + mapBearing.
  const cone =
    heading == null
      ? ""
      : `
        <div style="
          position:absolute;left:50%;top:50%;
          width:100px;height:100px;
          transform:translate(-50%,-50%) rotate(${heading + mapBearing}deg);
          pointer-events:none;">
          <svg viewBox="-50 -50 100 100" width="100" height="100" style="overflow:visible">
            <defs>
              <radialGradient id="cone-g" cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#2563eb" stop-opacity="0.9"/>
                <stop offset="0.6" stop-color="#2563eb" stop-opacity="0.45"/>
                <stop offset="1" stop-color="#2563eb" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <path d="M0,0 L-30,-44 A54,54 0 0 1 30,-44 Z" fill="url(#cone-g)"/>
          </svg>
        </div>`;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:18px;height:18px;">
        ${cone}
        <div style="
          position:absolute;left:0;top:0;
          width:18px;height:18px;border-radius:50%;
          background:#2563eb;border:3px solid #fff;
          box-shadow:0 0 0 2px rgba(37,99,235,.35),0 2px 6px rgba(0,0,0,.4);"></div>
      </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

type GeoStatus =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; code: number; message: string };

// Chrome / Edge / Android surface this event when the PWA becomes installable.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function UserLocation({
  heading,
  mapBearing,
  onStatus,
}: {
  heading: number | null;
  mapBearing: number;
  onStatus: (s: GeoStatus) => void;
}) {
  const map = useMap();
  const posRef = useRef<GeolocationCoordinates | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const arrowRef = useRef<L.Marker | null>(null);
  const renderRef = useRef<() => void>(() => {});

  // Latest render logic — kept in a ref so the geo-subscription effect below
  // (which runs once per map) always calls the newest closure without needing
  // to resubscribe when heading / mapBearing change. Ref is reassigned inside
  // an effect to avoid mutating during render.
  const render = () => {
    const pos = posRef.current;
    if (!pos) return;
    const ll = L.latLng(pos.latitude, pos.longitude);
    const cp = map.latLngToContainerPoint(ll);
    const size = map.getSize();
    const m = 30;
    const inside =
      cp.x >= m && cp.y >= m && cp.x <= size.x - m && cp.y <= size.y - m;

    const arrowIcon = (deg: number) =>
      L.divIcon({
        className: "",
        html: `<div style="transform:rotate(${deg}deg);width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="4,14 4,26 22,26 22,34 36,20 22,6 22,14"
              fill="#2563eb" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
          </svg></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

    arrowRef.current?.remove();
    arrowRef.current = null;

    if (inside) {
      const icon = makeDotIcon(heading, mapBearing);
      if (!markerRef.current) {
        markerRef.current = L.marker(ll, { icon, interactive: false }).addTo(
          map,
        );
      } else {
        markerRef.current.setLatLng(ll);
        markerRef.current.setIcon(icon);
      }
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
      const center = L.point(size.x / 2, size.y / 2);
      const vec = cp.subtract(center);
      const halfX = size.x / 2 - m;
      const halfY = size.y / 2 - m;
      const sx = halfX / Math.max(Math.abs(vec.x), 0.001);
      const sy = halfY / Math.max(Math.abs(vec.y), 0.001);
      const clamped = center.add(vec.multiplyBy(Math.min(sx, sy)));
      const edgeLL = map.containerPointToLatLng(clamped);
      const angle = (Math.atan2(vec.y, vec.x) * 180) / Math.PI;
      arrowRef.current = L.marker(edgeLL, {
        icon: arrowIcon(angle),
        interactive: false,
      }).addTo(map);
    }
  };

  // Keep the ref pointed at the latest render closure without mutating during
  // the render phase (which the react-hooks/refs lint rule forbids).
  useEffect(() => {
    renderRef.current = render;
  });

  // Geolocation + map events. Runs once per map — does NOT tear down when
  // heading / bearing change, so the blue dot stays on screen.
  useEffect(() => {
    const fire = () => renderRef.current();
    const onGeo = (p: GeolocationPosition) => {
      posRef.current = p.coords;
      onStatus({ kind: "ok" });
      fire();
    };
    let watchId: number | null = null;
    let triedLowAccuracy = false;
    const onErr = (e: GeolocationPositionError) => {
      console.warn(`geo error code=${e.code} msg=${e.message || "-"}`);
      onStatus({ kind: "error", code: e.code, message: e.message });
      // POSITION_UNAVAILABLE is common on desktop + Chrome DevTools Sensors
      // when enableHighAccuracy is on. Retry once with low-accuracy.
      if (e.code === 2 && !triedLowAccuracy && watchId != null) {
        triedLowAccuracy = true;
        navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(onGeo, onErr, {
          enableHighAccuracy: false,
          maximumAge: 10000,
          timeout: 20000,
        });
      }
    };
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(onGeo, onErr, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      });
    } else {
      onStatus({
        kind: "error",
        code: -1,
        message: "Geolocation API unavailable",
      });
    }
    map.on("moveend", fire);
    map.on("zoomend", fire);
    map.on("rotate", fire);
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      map.off("moveend", fire);
      map.off("zoomend", fire);
      map.off("rotate", fire);
      markerRef.current?.remove();
      markerRef.current = null;
      arrowRef.current?.remove();
      arrowRef.current = null;
    };
  }, [map, onStatus]);

  // Re-render marker when heading or bearing change, re-using the subscription.
  useEffect(() => {
    renderRef.current();
  }, [heading, mapBearing]);

  return null;
}

export default function MapView() {
  const [p, setP] = useState<Placement | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ kind: "idle" });
  const [menuOpen, setMenuOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // PWA install state
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Listen for the Chrome/Edge install prompt and detect iOS/standalone.
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    // Hydrate from localStorage + detect capabilities on mount — this is a
    // valid set-state-in-effect pattern for client-only data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setP(loadPlacement());
    loadImageAspect(MAP_IMAGE).then(setAspect);
    const needs = needsOrientationPermission();
    setNeedsPermission(needs);
    // Auto-subscribe when no explicit permission is required (Android, desktop).
    // iOS Safari requires a user gesture, handled by the one-time enable button.
    if (!needs) {
      const unsub = subscribeHeading((deg) => setHeading(deg));
      return unsub;
    }
  }, []);

  const bounds = useMemo(
    () => (p && aspect != null ? cornersBounds(p, aspect) : null),
    [p, aspect],
  );
  const bearing = useMemo(() => (p ? 90 - placementBearingDeg(p) : 0), [p]);

  const fitImage = useCallback(() => {
    const map = mapRef.current;
    if (!map || !p || aspect == null) return;
    // After applying map bearing, the image rectangle is axis-aligned on screen,
    // so we can compute the zoom directly from its width/height in world pixels
    // rather than going through fitBounds (which uses the larger AA bbox of the
    // rotated rectangle).
    const refZoom = map.getZoom();
    const tlP = map.project(L.latLng(p.topLeft.lat, p.topLeft.lng), refZoom);
    const trP = map.project(L.latLng(p.topRight.lat, p.topRight.lng), refZoom);
    const imgWidthPx = Math.hypot(trP.x - tlP.x, trP.y - tlP.y);
    const imgHeightPx = imgWidthPx * aspect;
    const size = map.getSize();
    const scale = Math.min(size.x / imgWidthPx, size.y / imgHeightPx);
    const newZoom = map.getScaleZoom(scale, refZoom);
    const c = deriveCenter(p, aspect);
    map.setView(L.latLng(c.lat, c.lng), newZoom, { animate: true });
  }, [p, aspect]);

  const canInstall = !isStandalone && (installEvent != null || isIOS);
  const handleInstallClick = useCallback(async () => {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setInstallEvent(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  }, [installEvent, isIOS]);

  const enableCompass = useCallback(async () => {
    const ok = await requestOrientationPermission();
    if (!ok) return;
    setNeedsPermission(false);
    const unsub = subscribeHeading((deg) => setHeading(deg));
    // Cleanup happens on unmount — MapView lives for the session.
    void unsub;
  }, []);

  if (!p || aspect == null || !bounds) {
    return (
      <div className='grid h-dvh place-items-center text-neutral-500'>
        Loading…
      </div>
    );
  }

  return (
    <div className='flex h-dvh w-dvw flex-col bg-stone-100'>
      <header className='z-[1100] flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 text-neutral-900 shadow-sm'>
        <div className='flex flex-col items-start leading-tight gap-1'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src='/logo.svg'
            alt='Logo'
            className='h-5 w-auto object-contain'
          />
          <span className='mt-0.5 text-[11px] font-medium text-[#30608D]'>
            Workation 2026 Resort Map
          </span>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label='Open menu'
          aria-expanded={menuOpen}
          className='rounded p-2 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-400'
        >
          <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <line x1='3' y1='6' x2='21' y2='6' />
            <line x1='3' y1='12' x2='21' y2='12' />
            <line x1='3' y1='18' x2='21' y2='18' />
          </svg>
        </button>
      </header>

      <div className='relative flex-1'>
        <MapContainer
          ref={mapRef}
          center={bounds.getCenter()}
          zoom={17}
          minZoom={3}
          maxZoom={20}
          zoomControl={false}
          attributionControl={false}
          rotate
          bearing={bearing}
          rotateControl={false}
          touchRotate={false}
          className='h-full w-full'
          style={{ background: "#f5f5f4" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            maxZoom={19}
          />
          <RotatedImage p={p} aspect={aspect} opacity={opacity} />
          <PinsLayer />
          <UserLocation
            heading={heading}
            mapBearing={bearing}
            onStatus={setGeoStatus}
          />
        </MapContainer>

        {geoStatus.kind === "error" && (
          <div className='pointer-events-auto absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-red-600/90 px-4 py-2 text-xs font-medium text-white shadow-lg'>
            {geoStatus.code === 1
              ? "Location permission denied — enable it in site settings."
              : geoStatus.code === 2
                ? "Location unavailable (no GPS fix). Check device location services."
                : geoStatus.code === 3
                  ? "Location request timed out. Try again outdoors."
                  : `Geolocation error (code ${geoStatus.code}): ${geoStatus.message || "unknown"}`}
          </div>
        )}

        {needsPermission && (
          <button
            onClick={enableCompass}
            className='pointer-events-auto absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-sky-600/95 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-sky-500'
          >
            🧭 Tap to enable compass
          </button>
        )}

        {/* Bottom-right stack: opacity slider above the footer. */}
        <div className='pointer-events-none absolute right-2 bottom-2 z-[1000] flex flex-col items-end gap-2'>
          <div className='pointer-events-auto flex items-center w-full justify-between gap-2'>
            {canInstall && (
              <button
                type='button'
                onClick={handleInstallClick}
                aria-label='Install app to home screen'
                title='Install app to home screen'
                className='flex items-center rounded-2xl bg-[#30608D] h-[46px] px-6 py-2 text-[16px] font-semibold text-white shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:bg-[#264f73]'
              >
                Install
              </button>
            )}
            <div className='flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur'>
              <button
                onClick={fitImage}
                aria-label='Fit entire map in view'
                title='Fit entire map in view'
                className='rounded-lg p-1.5 text-neutral-700 transition hover:bg-neutral-100 active:scale-95'
              >
                <svg
                  width='18'
                  height='18'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <polyline points='8 3 3 3 3 8' />
                  <polyline points='21 8 21 3 16 3' />
                  <polyline points='3 16 3 21 8 21' />
                  <polyline points='16 21 21 21 21 16' />
                </svg>
              </button>
              <input
                type='range'
                min={0}
                max={1}
                step={0.01}
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className='range-slider'
                style={{ ["--fill" as string]: `${opacity * 100}%` }}
                aria-label='Artwork opacity'
              />
              <span className='min-w-[3ch] text-right text-xs font-semibold tabular-nums text-neutral-700'>
                {Math.round(opacity * 100)}%
              </span>
            </div>
          </div>
          <footer className='pointer-events-auto max-w-[95vw] rounded bg-white/80 px-2 py-1 text-right text-[10px] leading-tight text-neutral-700 shadow-sm backdrop-blur'>
            Map Artwork by Thomas Staridas (Stanides Geography), 2025 Edition.
            Licensed under{" "}
            <a
              href='https://creativecommons.org/licenses/by-nc-nd/4.0/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-sky-700'
            >
              CC BY-NC-ND 4.0
            </a>
            . Base map © OpenStreetMap contributors.
          </footer>
        </div>
      </div>

      {/* Menu drawer */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className='fixed inset-0 z-[1200] bg-black/40'
            aria-hidden
          />
          <aside
            role='dialog'
            aria-label='Menu'
            className='fixed top-0 right-0 z-[1201] flex h-dvh w-72 max-w-[85vw] flex-col bg-white shadow-2xl'
          >
            <div className='flex items-center justify-between border-b border-neutral-200 px-4 py-3'>
              <span className='font-semibold text-neutral-800'>Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label='Close menu'
                className='rounded p-1 hover:bg-neutral-100'
              >
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <line x1='18' y1='6' x2='6' y2='18' />
                  <line x1='6' y1='6' x2='18' y2='18' />
                </svg>
              </button>
            </div>
            <nav className='flex flex-col gap-1 p-4 text-sm'>
              <a
                href='https://www.cretamaris.gr/'
                target='_blank'
                rel='noopener noreferrer'
                className='rounded px-3 py-2 text-neutral-800 hover:bg-neutral-100'
              >
                Resort website ↗
              </a>
              <a
                href='/calibrate'
                className='rounded px-3 py-2 text-neutral-800 hover:bg-neutral-100'
              >
                Calibrate map
              </a>
              <button
                onClick={() => {
                  if (confirm("Reset saved calibration to the default?")) {
                    localStorage.removeItem("workation-map:placement");
                    location.reload();
                  }
                }}
                className='rounded px-3 py-2 text-left text-neutral-800 hover:bg-neutral-100'
              >
                Reset calibration
              </button>
              <a
                href='https://creativecommons.org/licenses/by-nc-nd/4.0/'
                target='_blank'
                rel='noopener noreferrer'
                className='rounded px-3 py-2 text-neutral-800 hover:bg-neutral-100'
              >
                Artwork license (CC BY-NC-ND 4.0)
              </a>
            </nav>
          </aside>
        </>
      )}

      {/* iOS install instructions (no beforeinstallprompt on Safari) */}
      {showIOSGuide && (
        <>
          <div
            onClick={() => setShowIOSGuide(false)}
            className='fixed inset-0 z-[1300] bg-black/50'
            aria-hidden
          />
          <div
            role='dialog'
            aria-label='Install instructions'
            className='fixed bottom-0 left-0 right-0 z-[1301] rounded-t-2xl bg-white p-6 shadow-2xl sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-sm sm:rounded-2xl'
          >
            <h2 className='mb-3 text-base font-semibold text-neutral-900'>
              Add to Home Screen
            </h2>
            <ol className='mb-4 list-decimal space-y-2 pl-5 text-sm text-neutral-700'>
              <li>
                Tap the <strong>Share</strong> button (the square with an
                up-arrow) at the bottom of Safari.
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> in the top-right. The app icon will
                appear on your home screen.
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className='w-full rounded-md bg-[#30608D] px-3 py-2 text-sm font-medium text-white hover:bg-[#264f73]'
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
