"use client";

import { useEffect, useRef } from "react";

// Reactive accent: drives the app's accent CSS variables from the current rhythm
// state's hue. Violet (263) when steady, warming toward amber/orange as the
// rhythm degrades — the UI itself signals when you're slipping. The accent's
// lightness/chroma match the v1 token (oklch 0.65 / 0.25); only the hue moves,
// tweened over ~600ms so the shift reads as deliberate, not a snap.
//
// Overriding --cadence-accent on <html> cascades to --primary, --ring, --accent
// and chart-1, which all reference it (see globals.css). Renders nothing.

const L_C = "0.65 0.25"; // shared lightness + chroma
const DEFAULT_HUE = 263;
const DURATION = 600;

function setHue(hue: number) {
  const root = document.documentElement;
  root.style.setProperty("--cadence-accent", `oklch(${L_C} ${hue})`);
  root.style.setProperty("--cadence-accent-muted", `oklch(${L_C} ${hue} / 20%)`);
  root.style.setProperty("--cadence-accent-glow", `oklch(${L_C} ${hue} / 40%)`);
  root.style.setProperty("--accent-hue", String(Math.round(hue)));
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function ReactiveAccent({ hue }: { hue: number }) {
  const fromRef = useRef(DEFAULT_HUE);

  useEffect(() => {
    const from = fromRef.current;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce || from === hue) {
      setHue(hue);
      fromRef.current = hue;
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1);
      setHue(from + (hue - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = hue;
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [hue]);

  // Restore the default violet when leaving the page.
  useEffect(() => () => setHue(DEFAULT_HUE), []);

  return null;
}
