import L from "leaflet";

// Both leaflet-rotate and leaflet-imageoverlay-rotated reference a global `L`.
// When Leaflet is loaded via webpack/Next they use the CommonJS path, which
// does NOT set window.L, so plugin scripts crash. Expose it explicitly.
if (typeof window !== "undefined") {
  (window as unknown as { L: typeof L }).L = L;
}

export default L;
