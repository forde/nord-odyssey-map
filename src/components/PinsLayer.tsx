"use client";

import { useEffect, useRef, useState } from "react";
import L from "@/lib/leafletGlobal";
import { Marker, Popup, Tooltip, useMapEvents } from "react-leaflet";
import { loadPins, newId, Pin, savePins } from "@/lib/pins";

const pinIcon = L.divIcon({
  className: "",
  html: `
    <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0 C6 0 0 6 0 14 C0 23 14 36 14 36 C14 36 28 23 28 14 C28 6 22 0 14 0 Z"
            fill="#30608D" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#ffffff"/>
    </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  tooltipAnchor: [0, -34],
  popupAnchor: [0, -32],
});

const NAV_ICON = (
  <svg
    width='14'
    height='14'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <polygon points='3 11 22 2 13 21 11 13 3 11' />
  </svg>
);

function navigateUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

type Phase = "initial" | "naming" | "edit";

function PinMarker({
  pin,
  isDraft,
  onSave,
  onDelete,
  onCancel,
}: {
  pin: Pin;
  isDraft?: boolean;
  onSave: (p: Pin) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  // Three-phase popup: drafts start in "initial" (Save-as-pin + Navigate),
  // advance to "naming" (input + Save), or "edit" for already-saved pins.
  const [phase, setPhase] = useState<Phase>(isDraft ? "initial" : "edit");
  const [title, setTitle] = useState(pin.title);
  const markerRef = useRef<L.Marker | null>(null);
  // Suppresses the popupclose->onCancel path while we're programmatically
  // swapping the popup contents (react-leaflet's setContent triggers a close
  // event for drafts otherwise, which would discard the pin).
  const suppressCloseRef = useRef(false);

  // Auto-open popup on mount for freshly placed draft pins.
  useEffect(() => {
    if (isDraft) {
      const t = setTimeout(() => markerRef.current?.openPopup(), 30);
      return () => clearTimeout(t);
    }
  }, [isDraft]);

  const commit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({ ...pin, title: trimmed });
    markerRef.current?.closePopup();
  };

  const goToNaming = () => {
    suppressCloseRef.current = true;
    setPhase("naming");
    // Re-assert the popup open state after the React re-render and Leaflet's
    // own reflow have settled, then clear the suppression flag.
    setTimeout(() => {
      markerRef.current?.openPopup();
      suppressCloseRef.current = false;
    }, 0);
  };

  return (
    <Marker
      ref={(instance) => {
        markerRef.current = instance;
      }}
      position={[pin.lat, pin.lng]}
      icon={pinIcon}
      eventHandlers={{
        popupclose: () => {
          if (suppressCloseRef.current) return;
          if (isDraft) {
            onCancel?.();
          } else {
            // Discard unsaved edits when popup closes via click-outside.
            setTitle(pin.title);
          }
        },
      }}
    >
      {!isDraft && pin.title && (
        <Tooltip permanent direction='top' className='pin-label'>
          {pin.title}
        </Tooltip>
      )}
      <Popup closeButton={false} autoClose={false} closeOnEscapeKey>
        <div className='flex min-w-[220px] flex-col gap-2'>
          {phase === "initial" && (
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={goToNaming}
                className='flex-1 rounded-md bg-[#30608D] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#264f73]'
              >
                Save as pin
              </button>
              <a
                href={navigateUrl(pin.lat, pin.lng)}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50'
              >
                {NAV_ICON}
                Navigate
              </a>
            </div>
          )}

          {phase === "naming" && (
            <>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  } else if (e.key === "Escape") {
                    markerRef.current?.closePopup();
                  }
                }}
                placeholder='Pin name'
                className='w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-[#30608D] focus:ring-2 focus:ring-[#30608D]/20'
              />
              <button
                type='button'
                onClick={commit}
                disabled={!title.trim()}
                className='rounded-md bg-[#30608D] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#264f73] disabled:cursor-not-allowed disabled:opacity-40'
              >
                Save
              </button>
            </>
          )}

          {phase === "edit" && (
            <>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  } else if (e.key === "Escape") {
                    markerRef.current?.closePopup();
                  }
                }}
                placeholder='Pin name'
                className='w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-[#30608D] focus:ring-2 focus:ring-[#30608D]/20'
              />
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={commit}
                  disabled={!title.trim()}
                  className='flex-1 rounded-md bg-[#30608D] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#264f73] disabled:cursor-not-allowed disabled:opacity-40'
                >
                  Save
                </button>
                {onDelete && (
                  <button
                    type='button'
                    onClick={() => {
                      onDelete();
                      markerRef.current?.closePopup();
                    }}
                    className='rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50'
                  >
                    Delete
                  </button>
                )}
              </div>
              <a
                href={navigateUrl(pin.lat, pin.lng)}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50'
              >
                {NAV_ICON}
                Navigate
              </a>
            </>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function PinsLayer() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [draft, setDraft] = useState<Pin | null>(null);

  // Hydrate from localStorage on mount — valid client-only hydration pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPins(loadPins());
  }, []);

  // Update state AND persist atomically — no effect-timing races.
  const mutate = (updater: (list: Pin[]) => Pin[]) => {
    setPins((list) => {
      const next = updater(list);
      savePins(next);
      return next;
    });
  };

  useMapEvents({
    contextmenu(e) {
      // Only one draft at a time — replace any existing draft.
      setDraft({
        id: newId(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        title: "",
      });
    },
  });

  return (
    <>
      {pins.map((p) => (
        <PinMarker
          key={p.id}
          pin={p}
          onSave={(updated) =>
            mutate((list) =>
              list.map((x) => (x.id === updated.id ? updated : x)),
            )
          }
          onDelete={() => mutate((list) => list.filter((x) => x.id !== p.id))}
        />
      ))}
      {draft && (
        <PinMarker
          key={draft.id}
          pin={draft}
          isDraft
          onSave={(saved) => {
            mutate((list) => [...list, saved]);
            setDraft(null);
          }}
          onCancel={() => setDraft(null)}
        />
      )}
    </>
  );
}
