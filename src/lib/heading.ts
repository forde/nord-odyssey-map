// DeviceOrientation-based compass. Returns a subscribe fn that fires with
// heading in degrees clockwise from true north, or null if unavailable.
// Handles iOS permission prompts and desktop fallback.

type DeviceOrientationEventIOS = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type OrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

export function needsOrientationPermission(): boolean {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  return typeof (DeviceOrientationEvent as DeviceOrientationEventIOS).requestPermission === "function";
}

export async function requestOrientationPermission(): Promise<boolean> {
  const E = DeviceOrientationEvent as DeviceOrientationEventIOS;
  if (typeof E.requestPermission !== "function") return true;
  try {
    const res = await E.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

// Returns an unsubscribe function.
export function subscribeHeading(cb: (deg: number) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: OrientationEvent) => {
    // iOS Safari: webkitCompassHeading is true compass degrees CW from north.
    if (typeof e.webkitCompassHeading === "number") {
      cb(e.webkitCompassHeading);
      return;
    }
    // Chrome / others: deviceorientationabsolute gives alpha in device frame.
    // alpha = rotation around z axis, 0 when device points north; increases CCW.
    if (e.alpha != null && (e.absolute || (e as DeviceOrientationEvent).absolute !== false)) {
      // Normalise by screen orientation so it works in landscape.
      const screenAngle =
        (typeof screen !== "undefined" && screen.orientation?.angle) ||
        (typeof window !== "undefined" && typeof window.orientation === "number"
          ? (window.orientation as number)
          : 0);
      cb((360 - e.alpha + screenAngle) % 360);
    }
  };

  // Prefer the absolute variant; fall back to regular deviceorientation.
  const useAbsolute = "ondeviceorientationabsolute" in window;
  const evt = useAbsolute ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(evt, handler as EventListener, true);
  return () => window.removeEventListener(evt, handler as EventListener, true);
}
