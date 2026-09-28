import { useEffect, useRef } from "react";
import { useFinePointer, usePrefersReducedMotion } from "./ui/useViewport";

/**
 * Desktop-only companion cursor: a dot + a lagging ring that expands over
 * interactive elements. Purely additive - the native cursor is never
 * hidden, pointer events are never intercepted, and it is not mounted on
 * touch devices or for reduced-motion users. Position is written to
 * transforms inside requestAnimationFrame, never React state.
 */
export default function Cursor() {
  const fine = useFinePointer();
  const reduce = usePrefersReducedMotion();
  const dot = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    if (!fine || reduce) return;
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, visible = false;

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        rx = x;
        ry = y;
        dot.current?.classList.remove("is-hidden");
        ring.current?.classList.remove("is-hidden");
      }
      const interactive = e.target.closest?.("a, button, [role='button'], input, select, textarea, label, canvas");
      ring.current?.classList.toggle("is-hover", !!interactive);
    };
    const onLeave = () => {
      visible = false;
      dot.current?.classList.add("is-hidden");
      ring.current?.classList.add("is-hidden");
    };
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [fine, reduce]);

  if (!fine || reduce) return null;
  return (
    <>
      <div ref={ring} className="cursor-ring is-hidden" aria-hidden="true" />
      <div ref={dot} className="cursor-dot is-hidden" aria-hidden="true" />
    </>
  );
}
