import { CheckCircle2, Clock, XCircle, HelpCircle } from "lucide-react";

const CONFIG = {
  approved: { label: "Approved", color: "#35d99a", bg: "bg-signal-emerald/10", ring: "ring-signal-emerald/30", Icon: CheckCircle2, live: false },
  under_review: { label: "Under review", color: "#f3ad4b", bg: "bg-signal-amber/10", ring: "ring-signal-amber/30", Icon: Clock, live: true },
  rejected: { label: "Rejected", color: "#ff5468", bg: "bg-signal-crimson/10", ring: "ring-signal-crimson/30", Icon: XCircle, live: false },
  pending: { label: "Pending", color: "#a9b0c3", bg: "bg-white/[0.04]", ring: "ring-white/[0.12]", Icon: HelpCircle, live: true },
};

export default function StatusBadge({ status, size = "md" }) {
  const cfg = CONFIG[status] || CONFIG.pending;
  const { Icon } = cfg;
  const pad = size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-[11px]";

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium uppercase tracking-[0.12em] ring-1 ring-inset ${cfg.bg} ${cfg.ring} ${pad}`}
      style={{ color: cfg.color }}
    >
      {cfg.live ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: cfg.color }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
        </span>
      ) : (
        <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {cfg.label}
    </span>
  );
}
