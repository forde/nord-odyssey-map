"use client";

import dynamic from "next/dynamic";

const CalibrationView = dynamic(() => import("@/components/CalibrationView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center text-neutral-500">Loading calibrator…</div>
  ),
});

export default function CalibratePage() {
  return <CalibrationView />;
}
