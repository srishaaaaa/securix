import { CheckCircle2, Clock, XCircle, HelpCircle } from "lucide-react";

const CONFIG = {
  approved: { label: "Approved", color: "#2fd487", bg: "bg-signal-emerald/10", ring: "ring-signal-emerald/25", Icon: CheckCircle2 },
  under_review: { label: "Under review", color: "#f0a63a", bg: "bg-signal-amber/10", ring: "ring-signal-amber/25", Icon: Clock },
  rejected: { label: "Rejected", color: "#f2495c", bg: "bg-signal-crimson/10", ring: "ring-signal-crimson/25", Icon: XCircle },
  pending: { label: "Pending", color: "#a7aec2", bg: "bg-ink-500/10", ring: "ring-ink-500/20", Icon: HelpCircle },
};

export default function StatusBadge({ status, size = "md" }) {
  const cfg = CONFIG[status] || CONFIG.pending;
  const { Icon } = cfg;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${cfg.bg} ${cfg.ring} ${pad}`}
      style={{ color: cfg.color }}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {cfg.label}
    </span>
  );
}
