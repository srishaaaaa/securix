import { motion, useReducedMotion } from "framer-motion";
import { MaskLines, PageShell, SysLabel } from "../ui/motion";

/** Slowly turning iris / reticle - the quiet signature of the auth pages. */
function Iris({ className = "" }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="iris-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#9db0ff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#6478ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6478ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" stroke="rgba(255,255,255,0.06)" />
      <g className={reduce ? "" : "animate-spinSlower"} style={{ transformOrigin: "200px 200px" }}>
        {Array.from({ length: 120 }).map((_, i) => {
          const a = (i / 120) * Math.PI * 2;
          const r0 = i % 10 === 0 ? 162 : 170;
          return (
            <line key={i} x1={200 + Math.cos(a) * r0} y1={200 + Math.sin(a) * r0} x2={200 + Math.cos(a) * 178} y2={200 + Math.sin(a) * 178}
              stroke={i % 10 === 0 ? "rgba(238,240,246,0.5)" : "rgba(238,240,246,0.14)"} />
          );
        })}
      </g>
      <g className={reduce ? "" : "animate-spinSlow"} style={{ transformOrigin: "200px 200px", animationDirection: "reverse" }}>
        <circle cx="200" cy="200" r="140" stroke="rgba(157,176,255,0.3)" strokeDasharray="2 7" />
        <path d="M200 60 A140 140 0 0 1 340 200" stroke="#9db0ff" strokeOpacity="0.8" strokeLinecap="round" />
      </g>
      <circle cx="200" cy="200" r="104" stroke="rgba(185,164,255,0.18)" />
      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return <line key={i} x1={200 + Math.cos(a) * 36} y1={200 + Math.sin(a) * 36} x2={200 + Math.cos(a) * 100} y2={200 + Math.sin(a) * 100} stroke="rgba(157,176,255,0.1)" />;
      })}
      <circle cx="200" cy="200" r="100" fill="url(#iris-core)" opacity="0.5" />
      <circle cx="200" cy="200" r="34" fill="#07080c" stroke="rgba(238,240,246,0.4)" />
      <circle cx="200" cy="200" r="6" fill="#eef0f6" />
      <path d="M200 8v26M200 366v26M8 200h26M366 200h26" stroke="rgba(238,240,246,0.35)" />
    </svg>
  );
}

/**
 * Split editorial layout for Login/Register: statement + iris on the left
 * (top on phones), the form panel on the right.
 */
export default function AuthLayout({ eyebrow, lines, sub, children }) {
  return (
    <PageShell className="relative overflow-x-clip">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl grid-cols-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
        <div className="relative">
          <div className="pointer-events-none absolute -left-32 top-1/2 hidden w-[600px] -translate-y-1/2 opacity-40 lg:block">
            <Iris className="w-full" />
          </div>
          <div className="pointer-events-none absolute -right-10 -top-8 w-44 opacity-40 sm:w-56 lg:hidden">
            <Iris className="w-full" />
          </div>
          <div className="relative">
            <SysLabel live>{eyebrow}</SysLabel>
            <h1 className="mt-5 font-display text-giant font-semibold uppercase text-ink-50">
              <MaskLines lines={lines} delay={0.15} />
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-5 max-w-sm text-sm leading-relaxed text-ink-300 sm:text-base"
            >
              {sub}
            </motion.p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md justify-self-center lg:justify-self-end"
        >
          {children}
        </motion.div>
      </div>
    </PageShell>
  );
}
