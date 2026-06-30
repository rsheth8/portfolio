"use client";

import { DEFAULT_PALETTE, getPalette, type Palette, type RGB } from "./palette";

/**
 * Pull a small set of dominant, vibrant colors from a cover-art image and map
 * them onto our five accent slots so the site can re-tint to a song.
 *
 * Cross-origin: iTunes/mzstatic artwork is CORS-readable with crossOrigin
 * "anonymous"; if a source taints the canvas, getImageData throws and we bail
 * to the default palette rather than washing everything gray.
 */

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

/** Force a color to read well as a vivid accent on a near-black background. */
function vivid([h, s, l]: [number, number, number]): RGB {
  const sat = Math.min(1, Math.max(0.55, s));
  const light = Math.min(0.68, Math.max(0.5, l));
  return hslToRgb(h, sat, light);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("art load failed"));
    img.src = src;
  });
}

/** Bump an iTunes artwork URL to a larger size for better sampling. */
export function upscaleArtwork(url: string): string {
  return url.replace(/\/\d+x\d+bb\./, "/300x300bb.");
}

export async function extractPalette(artworkUrl: string): Promise<Palette | null> {
  if (!artworkUrl) return null;
  try {
    const img = await loadImage(upscaleArtwork(artworkUrl));
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // Bucket pixels into 12 hue bins, keeping a saturation-weighted average.
    const bins = Array.from({ length: 12 }, () => ({
      r: 0,
      g: 0,
      b: 0,
      w: 0,
      count: 0,
    }));
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, l] = rgbToHsl([r, g, b]);
      if (l < 0.12 || l > 0.92) continue; // skip near-black / near-white
      const weight = s * s; // favor saturated pixels
      const bin = bins[Math.floor(h / 30) % 12];
      bin.r += r * weight;
      bin.g += g * weight;
      bin.b += b * weight;
      bin.w += weight;
      bin.count += 1;
    }

    const swatches = bins
      .filter((bin) => bin.w > 0 && bin.count > 4)
      .map((bin) => {
        const rgb: RGB = [bin.r / bin.w, bin.g / bin.w, bin.b / bin.w];
        const hsl = rgbToHsl(rgb);
        return { hsl, score: bin.w };
      })
      .sort((a, b) => b.score - a.score);

    // Too washed-out / monochrome to theme convincingly — keep the default.
    if (!swatches.length || swatches[0].hsl[1] < 0.18) return null;

    const c1 = swatches[0].hsl;
    const c2 = swatches[1]?.hsl;
    const c3 = swatches[2]?.hsl;
    const rot = (h: [number, number, number], deg: number): [number, number, number] => [
      (h[0] + deg + 360) % 360,
      h[1],
      h[2],
    ];

    return {
      accent: vivid(c1),
      bass: vivid(c2 ?? rot(c1, 18)),
      mid: vivid(c3 ?? rot(c1, 165)),
      high: vivid([c1[0], c1[1], 0.66]),
      ice: hslToRgb((c1[0] + 200) % 360, 0.3, 0.62),
    };
  } catch {
    return null;
  }
}

/**
 * Retarget the live palette to a cover-art image (or reset to brand colors if
 * the art can't be read / has no usable color). Fire-and-forget; the
 * ThemeController eases the transition.
 */
export async function themeFromArtwork(
  url: string | null | undefined,
): Promise<void> {
  const palette = getPalette();
  if (!url) {
    palette.reset();
    return;
  }
  const extracted = await extractPalette(url);
  if (extracted) palette.setTarget(extracted);
  else palette.reset();
}

export function resetTheme(): void {
  getPalette().reset();
}

export { DEFAULT_PALETTE };
