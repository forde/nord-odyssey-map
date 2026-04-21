"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "@/lib/leafletGlobal";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import {
  DEFAULT_PLACEMENT,
  LatLng,
  Placement,
  RESORT_CENTER,
  deriveBottomLeft,
  deriveCenter,
  loadPlacement,
  savePlacement,
} from "@/lib/georeference";
import { loadImageAspect } from "@/lib/imageAspect";
import { ensureRotatedPlugin } from "@/lib/rotatedImageOverlay";

const MAP_IMAGE = "/map.png";

function makeDragIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      color:#fff;
      width:28px;height:28px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font:600 12px/1 system-ui;
      box-shadow:0 2px 6px rgba(0,0,0,.4);
      border:2px solid #fff;">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

type ReposFn = (tl: L.LatLng, tr: L.LatLng, bl: L.LatLng) => void;

function RotatedOverlay({
  tl,
  tr,
  bl,
  opacity,
  onReady,
}: {
  tl: L.LatLng;
  tr: L.LatLng;
  bl: L.LatLng;
  opacity: number;
  onReady: (fn: ReposFn) => void;
}) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Rotated } = await ensureRotatedPlugin();
      if (cancelled) return;
      const overlay = new Rotated(MAP_IMAGE, tl, tr, bl, {
        opacity,
        interactive: false,
      });
      overlay.addTo(map);
      overlayRef.current = overlay;
      onReady((a, b, c) => {
        (overlay as L.ImageOverlay & {
          reposition: (a: L.LatLng, b: L.LatLng, c: L.LatLng) => void;
        }).reposition(a, b, c);
      });
    })();
    return () => {
      cancelled = true;
      overlayRef.current?.remove();
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    overlayRef.current?.setOpacity(opacity);
  }, [opacity]);

  return null;
}

export default function CalibrationView() {
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [aspect, setAspect] = useState(0.706);
  const [opacity, setOpacity] = useState(0.6);
  const [hydrated, setHydrated] = useState(false);
  const reposRef = useRef<ReposFn | null>(null);

  useEffect(() => {
    setPlacement(loadPlacement());
    loadImageAspect(MAP_IMAGE).then(setAspect);
    setHydrated(true);
  }, []);

  const bl = useMemo(() => deriveBottomLeft(placement, aspect), [placement, aspect]);
  const center = useMemo(() => deriveCenter(placement, aspect), [placement, aspect]);

  const tlLL = useMemo(
    () => L.latLng(placement.topLeft.lat, placement.topLeft.lng),
    [placement.topLeft]
  );
  const trLL = useMemo(
    () => L.latLng(placement.topRight.lat, placement.topRight.lng),
    [placement.topRight]
  );
  const blLL = useMemo(() => L.latLng(bl.lat, bl.lng), [bl]);
  const centerLL = useMemo(() => L.latLng(center.lat, center.lng), [center]);

  const moveStartRef = useRef<{
    center: LatLng;
    tl: LatLng;
    tr: LatLng;
  } | null>(null);

  useEffect(() => {
    if (hydrated) reposRef.current?.(tlLL, trLL, blLL);
  }, [tlLL, trLL, blLL, hydrated]);

  const icons = useMemo(
    () => ({
      tl: makeDragIcon("#ef4444", "TL"),
      tr: makeDragIcon("#22c55e", "TR"),
      move: L.divIcon({
        className: "",
        html: `<div style="
          background:#0ea5e9;
          color:#fff;
          width:36px;height:36px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,.5);
          border:2px solid #fff;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="5 9 2 12 5 15"></polyline>
            <polyline points="9 5 12 2 15 5"></polyline>
            <polyline points="15 19 12 22 9 19"></polyline>
            <polyline points="19 9 22 12 19 15"></polyline>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="12" y1="2" x2="12" y2="22"></line>
          </svg></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    }),
    []
  );

  const json = useMemo(() => JSON.stringify(placement, null, 2), [placement]);

  function handleSave() {
    savePlacement(placement);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json);
    } catch {}
  }

  function handleReset() {
    setPlacement(DEFAULT_PLACEMENT);
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-200">
        <span className="font-semibold">Calibrate</span>
        <span className="text-neutral-400">
          <span className="text-sky-400">●</span> move ·{" "}
          <span className="text-red-400">TL</span>/
          <span className="text-green-400">TR</span> rotate + scale
        </span>
        <label className="ml-auto flex items-center gap-2">
          Opacity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
          />
        </label>
        <button
          onClick={handleReset}
          className="rounded bg-neutral-700 px-3 py-1 hover:bg-neutral-600"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          className="rounded bg-emerald-600 px-3 py-1 font-medium hover:bg-emerald-500"
        >
          Save to device
        </button>
        <button
          onClick={handleCopy}
          className="rounded bg-sky-600 px-3 py-1 font-medium hover:bg-sky-500"
        >
          Copy JSON
        </button>
      </div>

      <div className="relative flex-1">
        <MapContainer
          center={[RESORT_CENTER.lat, RESORT_CENTER.lng]}
          zoom={17}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {hydrated && (
            <RotatedOverlay
              tl={tlLL}
              tr={trLL}
              bl={blLL}
              opacity={opacity}
              onReady={(fn) => {
                reposRef.current = fn;
              }}
            />
          )}
          <Marker
            draggable
            position={tlLL}
            icon={icons.tl}
            eventHandlers={{
              drag: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                setPlacement((p) => ({ ...p, topLeft: { lat: ll.lat, lng: ll.lng } }));
              },
            }}
          />
          <Marker
            draggable
            position={trLL}
            icon={icons.tr}
            eventHandlers={{
              drag: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                setPlacement((p) => ({ ...p, topRight: { lat: ll.lat, lng: ll.lng } }));
              },
            }}
          />
          <Marker
            draggable
            position={centerLL}
            icon={icons.move}
            eventHandlers={{
              dragstart: () => {
                moveStartRef.current = {
                  center: { lat: centerLL.lat, lng: centerLL.lng },
                  tl: { ...placement.topLeft },
                  tr: { ...placement.topRight },
                };
              },
              drag: (e) => {
                const start = moveStartRef.current;
                if (!start) return;
                const ll = (e.target as L.Marker).getLatLng();
                const dLat = ll.lat - start.center.lat;
                const dLng = ll.lng - start.center.lng;
                setPlacement({
                  topLeft: { lat: start.tl.lat + dLat, lng: start.tl.lng + dLng },
                  topRight: { lat: start.tr.lat + dLat, lng: start.tr.lng + dLng },
                });
              },
              dragend: () => {
                moveStartRef.current = null;
              },
            }}
          />
        </MapContainer>

        <pre className="pointer-events-auto absolute right-3 bottom-3 z-[1000] max-w-sm rounded bg-neutral-900/90 p-3 text-xs text-neutral-100 shadow-lg">
          {json}
        </pre>
      </div>
    </div>
  );
}
