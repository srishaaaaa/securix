import { useMemo } from "react";
import { usePrefersReducedMotion, useViewportTier } from "./ui/useViewport";

/**
 * The "security laboratory" environment behind every page: drifting light
 * sources, a fine technical grid, a few floating particles and a scan line
 * that passes every so often. Pure CSS transforms - no React updates after
 * mount, nothing interactive, and particles/scan are dropped for
 * reduced-motion users.
 */
export default function Atmosphere() {
  const tier = useViewportTier();
  const reduce = usePrefersReducedMotion();
  const count = tier === "phone" ? 10 : tier === "laptop" ? 18 : 26;

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // deterministic pseudo-random spread
        const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        return {
          left: `${r(1) * 100}%`,
          top: `${60 + r(2) * 50}%`,
          size: 1 + r(3) * 1.6,
          dur: 18 + r(4) * 26,
          delay: -r(5) * 40,
          dx: `${(r(6) - 0.5) * 80}px`,
          o: 0.2 + r(7) * 0.45,
        };
      }),
    [count]
  );

  return (
    <div className="atmo" aria-hidden="true">
      <div className="atmo-light a" />
      <div className="atmo-light b" />
      <div className="atmo-light c" />
      <div className="atmo-grid" />
      {!reduce &&
        particles.map((p, i) => (
          <span
            key={i}
            className="atmo-particle"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--dx": p.dx,
              "--o": p.o,
            }}
          />
        ))}
      {!reduce && <div className="atmo-scan" />}
    </div>
  );
}
