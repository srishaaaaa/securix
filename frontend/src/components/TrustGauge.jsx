import { useEffect, useState } from "react";

/**
 * TrustGauge — the signature visual element of Securix.
 * Renders the *trust* score (100 - risk) as an arc: full accent arc = fully
 * trusted, arc recedes and shifts to amber/crimson as risk climbs.
 */
export default function TrustGauge({ riskScore = 0, band = "", size = 180, label = "Trust score" }) {
  const trust = Math.max(0, Math.min(100, 100 - riskScore));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(trust), 100);
    return () => clearTimeout(t);
  }, [trust]);

  const stroke = Math.max(6, Math.round(size * 0.058));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 300 / 360; // 300-degree gauge, 60-degree gap at bottom
  const dash = circumference * arcFraction;
  const filled = dash * (animated / 100);
  const scale = size / 180;

  const color =
    band === "high"
      ? "#f2495c"
      : band === "medium"
      ? "#f0a63a"
      : "#5b6ef5";

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[150deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1b2130"
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
              filter: `drop-shadow(0 0 10px ${color}66)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span
            className="font-display font-semibold tabular-nums leading-none"
            style={{ color, fontSize: `${Math.round(34 * scale)}px` }}
          >
            {Math.round(animated)}
          </span>
          <span
            className="mt-1.5 text-center uppercase leading-tight tracking-wide text-ink-500"
            style={{ fontSize: `${Math.max(9, Math.round(10 * scale))}px` }}
          >
            {label}
          </span>
        </div>
      </div>
      <div className="mt-3 text-xs font-medium uppercase tracking-wide" style={{ color }}>
        {band ? `${band} risk` : "—"}
      </div>
    </div>
  );
}
