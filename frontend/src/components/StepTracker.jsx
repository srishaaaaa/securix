import { motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * StepTracker - the real, literal sequence a customer walks through.
 * A numbered rail: completed steps check off and fill the progress line,
 * the current step lifts and lights, upcoming steps stay understated.
 */
export default function StepTracker({ steps, currentIndex }) {
  const pct = steps.length > 1 ? (Math.min(currentIndex, steps.length - 1) / (steps.length - 1)) * 100 : 0;
  return (
    <div className="relative mx-auto w-full max-w-3xl" aria-label="Verification progress">
      {/* rail */}
      <div className="absolute left-[10%] right-[10%] top-[17px] h-px bg-white/[0.08]" />
      <motion.div
        className="absolute left-[10%] top-[17px] h-px bg-gradient-to-r from-signal-emerald via-accent-soft to-accent"
        initial={false}
        animate={{ width: `${pct * 0.8}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((label, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={label} className="flex flex-col items-center gap-2.5" aria-current={active ? "step" : undefined}>
              <motion.div
                initial={false}
                animate={{ scale: active ? 1.08 : 1, y: active ? -2 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-full font-mono text-[11px] font-medium transition-colors duration-500 ${
                  done
                    ? "bg-signal-emerald/15 text-signal-emerald ring-1 ring-inset ring-signal-emerald/40"
                    : active
                    ? "bg-ink-50 text-void-900 shadow-[0_0_0_6px_rgba(100,120,255,0.14),0_10px_30px_-8px_rgba(100,120,255,0.8)]"
                    : "bg-void-800 text-ink-500 ring-1 ring-inset ring-white/[0.08]"
                }`}
              >
                {done ? (
                  <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </motion.span>
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
                {active && <span className="absolute inset-0 animate-ping rounded-full ring-1 ring-accent-soft/40" />}
              </motion.div>
              <span
                className={`hidden text-center font-mono text-[10px] uppercase tracking-[0.16em] sm:block ${
                  active ? "text-ink-50" : done ? "text-signal-emerald/80" : "text-ink-700"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300 sm:hidden">
        {String(Math.min(currentIndex, steps.length - 1) + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} ·{" "}
        {steps[Math.min(currentIndex, steps.length - 1)]}
      </p>
    </div>
  );
}
