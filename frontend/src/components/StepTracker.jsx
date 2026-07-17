import { Check } from "lucide-react";

/**
 * StepTracker — renders the real, literal sequence a customer walks through
 * (Document → Face → Analysis → Decision). Numbered steps are justified
 * here because they mirror an actual ordered pipeline, not decoration.
 */
export default function StepTracker({ steps, currentIndex }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((label, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-semibold ring-1 transition-all duration-500 ${
                  done
                    ? "bg-signal-emerald/15 text-signal-emerald ring-signal-emerald/40"
                    : active
                    ? "bg-cyan-glow/15 text-cyan-glow ring-cyan-glow/50 shadow-glow"
                    : "bg-void-700 text-ink-500 ring-white/[0.06]"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`hidden font-mono text-[10px] uppercase tracking-wider sm:block ${active ? "text-cyan-glow" : done ? "text-signal-emerald" : "text-ink-500"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1.5 h-px w-8 sm:w-14 transition-colors duration-500 ${done ? "bg-signal-emerald/40" : "bg-white/[0.08]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
