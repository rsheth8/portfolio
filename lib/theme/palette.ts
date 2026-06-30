"use client";

/**
 * Live accent palette. The five frequency-accent colors (bass / mid / high /
 * accent / ice) are exposed as CSS variables and consumed by the whole DOM via
 * Tailwind, plus by a few canvas backdrops that read them directly. When a
 * track with cover art starts, we retarget these toward the art's dominant
 * colors and the site smoothly takes on the song's palette ("synesthesia").
 *
 * Colors are stored as [r, g, b] 0-255 triplets so they can be written as the
 * space-separated channels Tailwind's `rgb(var(--x) / <alpha>)` tokens expect.
 */

export type RGB = [number, number, number];

export interface Palette {
  bass: RGB;
  mid: RGB;
  high: RGB;
  accent: RGB;
  ice: RGB;
}

export const DEFAULT_PALETTE: Palette = {
  bass: [255, 58, 122], // #ff3a7a
  mid: [0, 214, 255], // #00d6ff
  high: [255, 230, 108], // #ffe66c
  accent: [177, 77, 255], // #b14dff
  ice: [138, 168, 200], // #8aa8c8
};

const KEYS: (keyof Palette)[] = ["bass", "mid", "high", "accent", "ice"];

type Listener = (current: Palette) => void;

function clone(p: Palette): Palette {
  return { bass: [...p.bass], mid: [...p.mid], high: [...p.high], accent: [...p.accent], ice: [...p.ice] };
}

class PaletteStore {
  private current = clone(DEFAULT_PALETTE);
  private target = clone(DEFAULT_PALETTE);
  private listeners = new Set<Listener>();

  getCurrent(): Palette {
    return this.current;
  }

  setTarget(next: Palette): void {
    this.target = clone(next);
  }

  reset(): void {
    this.target = clone(DEFAULT_PALETTE);
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Lerp current → target by `t` (0..1). Returns true if it moved. */
  step(t = 0.06): boolean {
    let moved = false;
    for (const k of KEYS) {
      const c = this.current[k];
      const g = this.target[k];
      for (let i = 0; i < 3; i++) {
        const d = g[i] - c[i];
        if (Math.abs(d) > 0.4) {
          c[i] += d * t;
          moved = true;
        } else {
          c[i] = g[i];
        }
      }
    }
    if (moved) this.listeners.forEach((l) => l(this.current));
    return moved;
  }
}

let store: PaletteStore | null = null;

export function getPalette(): PaletteStore {
  if (!store) store = new PaletteStore();
  return store;
}

/** "r g b" string for CSS custom properties. */
export function rgbChannels([r, g, b]: RGB): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

/** "rgb(r,g,b)" for canvas / inline styles. */
export function rgbCss([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
