import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Music-viz palette ===
        // Designed for: deep dark backgrounds, hot accent colors keyed to
        // frequency bands, plus a Drake-era nod (gold/cream/cold-blue).
        // The accent colors are the ones visualizations should pull from.
        ink: "#06060a",        // near-black background
        slate: "#0e0e16",       // section base
        graphite: "#1a1a26",    // raised surfaces
        // Frequency accents:
        bass: "#ff3a7a",        // hot magenta — bass kick
        mid: "#00d6ff",         // cyan — midrange / structure
        high: "#ffe66c",        // bright yellow — high-end sparkle
        accent: "#b14dff",      // violet — secondary
        // Drake palette nods:
        gold: "#d4b06a",        // Take Care era cream-gold
        ice: "#8aa8c8",         // Views era cold blue
        cream: "#ece2c6",       // soft warm text
        bone: "#d6cdb8",        // off-white text
        mute: "#6a6a78",        // dim gray
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
      animation: {
        "breathe": "breathe 6s ease-in-out infinite",
        "scanline": "scanline 8s linear infinite",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
