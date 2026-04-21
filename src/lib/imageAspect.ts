// Load an image and return its naturalHeight / naturalWidth.
// Falls back to 2/3 (approx the supplied map) if the image fails to load,
// so the calibration UI still works before /map.png is placed.
export function loadImageAspect(src: string, fallback = 0.706): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(fallback);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      resolve(h / w);
    };
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
}
