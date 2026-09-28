import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import { hasWebGL, sceneBudget, usePrefersReducedMotion, useViewportTier } from "../ui/useViewport";

// Each scene is its own chunk, so three.js only downloads on pages that
// actually render 3D - and never blocks forms, camera or API work.
const SCENES = {
  identity: lazy(() => import("./IdentityCore")),
  document: lazy(() => import("./DocumentScanner")),
  network: lazy(() => import("./NetworkGraph")),
  world: lazy(() => import("./WorldScene")),
};

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Mounts a 3D scene only when WebGL is available and motion is allowed;
 * otherwise renders `fallback` (a static SVG/CSS composition). Rendering
 * pauses whenever the stage scrolls off-screen.
 *
 * `interactive` scenes (the fraud graph) keep pointer events; decorative
 * ones are pointer-events:none so they can never intercept a click.
 */
export default function Stage3D({ scene, fallback = null, className = "", interactive = false, sceneProps = {} }) {
  const tier = useViewportTier();
  const reduce = usePrefersReducedMotion();
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);
  const [canRender] = useState(() => typeof window !== "undefined" && hasWebGL());

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Scene = SCENES[scene];
  const use3D = canRender && !(reduce && !interactive);

  return (
    <div
      ref={ref}
      className={`${className} ${interactive ? "" : "pointer-events-none select-none"}`}
      aria-hidden={interactive ? undefined : "true"}
    >
      {use3D ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <Scene
              tier={tier}
              budget={sceneBudget(tier)}
              active={visible}
              reduceMotion={reduce}
              {...sceneProps}
            />
          </Suspense>
        </SceneBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
