import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const SEGMENTS = 32;

function toneFor(v) {
  if (v >= 70) return { bar: "#047857", text: "text-signal-emerald" };
  if (v >= 40) return { bar: "#c26a00", text: "text-signal-amber" };
  return { bar: "#d61f45", text: "text-signal-crimson" };
}

/**
 * Segmented signal meters - a quieter, more precise alternative to
 * progress bars. Each row fills segment by segment toward its real value;
 * hovering / focusing a row brightens it and dims the others, and reports
 * the hovered key so a parent can highlight the matching module.
 *
 * rows: [{ key, label, value (0-100 | null), display }]
 */
export default function SignalBars({ rows, onFocusChange, className = "" }) {
  const [focus, setFocus] = useState(null);
  const reduce = useReducedMotion();
  const set = (k) => {
    setFocus(k);
    onFocusChange?.(k);
  };

  return (
    <ul className={`space-y-1 ${className}`} onMouseLeave={() => set(null)}>
      {rows.map((r, idx) => {
        const has = typeof r.value === "number" && Number.isFinite(r.value);
        const v = has ? Math.max(0, Math.min(100, r.value)) : 0;
        const lit = Math.round((v / 100) * SEGMENTS);
        const tone = toneFor(v);
        const dim = focus && focus !== r.key;
        return (
          <li
            key={r.key}
            tabIndex={0}
            onMouseEnter={() => set(r.key)}
            onFocus={() => set(r.key)}
            onBlur={() => set(null)}
            onClick={() => set(focus === r.key ? null : r.key)}
            className={`grid cursor-default grid-cols-[minmax(84px,120px)_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 outline-none transition-all duration-300 sm:gap-4 ${
              dim ? "opacity-35" : "opacity-100"
            } ${focus === r.key ? "bg-white/[0.03]" : ""}`}
          >
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">{r.label}</span>
            <span className="flex h-3 items-center gap-[2px]" aria-hidden="true">
              {Array.from({ length: SEGMENTS }).map((_, i) => (
                <motion.span
                  key={i}
                  className="h-full flex-1 rounded-[1px]"
                  initial={reduce ? false : { opacity: 0.15, scaleY: 0.4 }}
                  whileInView={{ opacity: i < lit ? 1 : 0.12, scaleY: i < lit ? 1 : 0.55 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25, delay: reduce ? 0 : idx * 0.08 + i * 0.012 }}
                  style={{ background: i < lit ? tone.bar : "rgba(16,20,40,0.5)" }}
                />
              ))}
            </span>
            <span className={`w-14 text-right font-mono text-sm tabular-nums ${has ? tone.text : "text-ink-500"}`}>
              {r.display ?? (has ? Math.round(v) : "—")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
