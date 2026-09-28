import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1];

/**
 * Route entrance transition. App.jsx (and its <Routes>) is intentionally
 * untouched, so each page fades/rises/unblurs in on mount instead of
 * cross-fading at the router level.
 */
export function PageShell({ children, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Scroll-into-view reveal: fade + rise + blur-to-sharp. */
export function Reveal({ children, delay = 0, y = 26, className = "", as = "div", once = true, amount = 0.25 }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/** Line-by-line masked text reveal for editorial headings. */
export function MaskLines({ lines, className = "", lineClassName = "", delay = 0, stagger = 0.09, inView = false }) {
  const reduce = useReducedMotion();
  const trigger = inView
    ? { whileInView: "show", viewport: { once: true, amount: 0.5 } }
    : { animate: "show" };
  return (
    <motion.span className={`block ${className}`} initial="hide" {...trigger}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <motion.span
            className={`block ${lineClassName}`}
            variants={{
              hide: reduce ? { opacity: 0 } : { y: "108%", opacity: 0 },
              show: reduce ? { opacity: 1 } : { y: "0%", opacity: 1 },
            }}
            transition={{ duration: 0.95, ease: EASE, delay: delay + i * stagger }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/** Staggered list container + item. */
export const staggerParent = (stagger = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});
export const staggerChild = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } },
};

/**
 * Card whose border lights up toward the pointer. Pointer position is
 * written straight to CSS variables (no React state) so hovering never
 * re-renders the card.
 */
export function LitCard({ as: Tag = "div", className = "", children, ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag ref={ref} onPointerMove={onMove} className={`lit-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Counts up to a real value when scrolled into view. The final text is
 * always exactly String(value) - the animation never shows a number the
 * data didn't contain at rest. Non-numeric values render unchanged.
 */
export function Counter({ value, className = "", duration = 1.2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const numeric = typeof value === "number" && Number.isFinite(value);
  const decimals = numeric ? (String(value).split(".")[1] || "").length : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!numeric || reduce || !inView) {
      el.textContent = numeric && !inView && !reduce ? (0).toFixed(decimals) : String(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => (el.textContent = v.toFixed(decimals)),
      onComplete: () => (el.textContent = String(value)),
    });
    return () => controls.stop();
  }, [value, inView, numeric, reduce, decimals, duration]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular-nums">{String(value)}</span>
      <span className="sr-only">{String(value)}</span>
    </span>
  );
}

/** Small monospaced "system" label with an optional live dot. */
export function SysLabel({ children, live = false, tone = "accent", className = "" }) {
  const toneCls = {
    accent: "text-accent-soft",
    emerald: "text-signal-emerald",
    amber: "text-signal-amber",
    crimson: "text-signal-crimson",
    muted: "text-ink-500",
  }[tone];
  const dotCls = {
    accent: "bg-accent-soft",
    emerald: "bg-signal-emerald",
    amber: "bg-signal-amber",
    crimson: "bg-signal-crimson",
    muted: "bg-ink-500",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] ${toneCls} ${className}`}>
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotCls}`} />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotCls}`} />
        </span>
      )}
      {children}
    </span>
  );
}

/** Editorial page header: index number, eyebrow, big heading, subline. */
export function PageHeading({ index, eyebrow, title, sub, right, className = "" }) {
  return (
    <div className={`flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-3">
          {index && <span className="font-mono text-[11px] text-ink-700">{index}</span>}
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        </div>
        <h1 className="font-display text-huge font-semibold text-ink-50">{title}</h1>
        {sub && <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-300 sm:text-base">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
