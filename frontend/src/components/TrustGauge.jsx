import { useEffect, useState } from "react";

/**
 * TrustGauge — the signature visual element of SECURIX.
 * Renders the *trust* score (100 - risk) as an arc: full cyan arc = fully
 * trusted, arc recedes and shifts to amber/crimson as risk climbs.
 */
export default function TrustGauge({ riskScore = 0, band = "", size = 180, label = "Trust Score" }) {
  const trust = Math.max(0, Math.min(100, 100 - riskScore));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(trust), 100);
    return () => clearTimeout(t);
  }, [trust]);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 220; // degrees of arc gap at bottom, gauge style
  const arcFraction = 300 / 360; // 300-degree gauge, 60-degree gap at bottom
  const dash = circumference * arcFraction;
  const filled = dash * (animated / 100);

  const color =
    band === "high"
      ? "#f4415e"
      : band === "medium"
      ? "#f5a623"
      : "#22d3ee";

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[150deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1b2333"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1), stroke 0.5s ease",
            filter: `drop-shadow(0 0 8px ${color}88)`,
          }}
        />
      </svg>
      <div className="-mt-[108px] flex flex-col items-center">
        <span className="font-mono text-4xl font-semibold tabular-nums" style={{ color }}>
          {Math.round(animated)}
        </span>
        <span className="text-ink-500 text-xs tracking-wider uppercase mt-1">{label}</span>
      </div>
      <div className="mt-3 text-xs font-mono uppercase tracking-widest" style={{ color }}>
        {band ? `${band} risk` : "—"}
      </div>
    </div>
  );
}
