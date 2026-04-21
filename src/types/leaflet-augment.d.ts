import "leaflet";

// leaflet-rotate extends L.MapOptions and L.Map with bearing / rotation support.
declare module "leaflet" {
  interface MapOptions {
    rotate?: boolean;
    bearing?: number;
    rotateControl?:
      | boolean
      | { closeOnZeroBearing?: boolean; position?: string };
    touchRotate?: boolean;
    shiftKeyRotate?: boolean;
  }
  interface Map {
    setBearing(bearing: number): this;
    getBearing(): number;
  }
}
