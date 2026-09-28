import { useEffect, useState } from "react";

/**
 * Viewport tier used to adapt 3D/animation density - not just layout.
 *   phone   <  640px
 *   laptop  <  1440px
 *   desktop >= 1440px
 */
const QUERIES = {
  phone: "(max-width: 639px)",
  laptop: "(min-width: 640px) and (max-width: 1439px)",
};

function currentTier() {
  if (typeof window === "undefined") return "laptop";
  if (window.matchMedia(QUERIES.phone).matches) return "phone";
  if (window.matchMedia(QUERIES.laptop).matches) return "laptop";
  return "desktop";
}

export function useViewportTier() {
  const [tier, setTier] = useState(currentTier);
  useEffect(() => {
    const mqs = Object.values(QUERIES).map((q) => window.matchMedia(q));
    const onChange = () => setTier(currentTier());
    mqs.forEach((m) => m.addEventListener("change", onChange));
    return () => mqs.forEach((m) => m.removeEventListener("change", onChange));
  }, []);
  return tier;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");

let webglSupport = null;
export function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** Tier-specific numbers for 3D scenes: particle counts, pixel ratio caps. */
export function sceneBudget(tier) {
  if (tier === "phone") return { particles: 0.45, dpr: [1, 1.5] };
  if (tier === "laptop") return { particles: 0.75, dpr: [1, 1.75] };
  return { particles: 1, dpr: [1, 2] };
}
