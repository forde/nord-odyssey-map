"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center text-neutral-500">Loading map…</div>
  ),
});

export default function Home() {
  return <MapView />;
}
