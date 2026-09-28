import { useEffect, useId, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * TrustGauge - the signature instrument of Securix.
 * Renders the *trust* score (100 - risk) as a precision ring: a tick
 * bezel that fills with trust, a primary arc, a counter-rotating inner
 * reticle and an orbiting marker at the arc head. Arc recedes and shifts
 * to amber/crimson as risk climbs. Same inputs, same number, same band.
 */
export default function TrustGauge({ riskScore = 0, band = "", size = 180, label = "Trust score" }) {
  const trust = Math.max(0, Math.min(100, 100 - riskScore));
  const [animated, setAnimated] = useState(0);
  const gid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const from = useRef(0);

  // one tween drives arc, ticks, head marker and number together;
  // it always settles on exactly `trust`
  useEffect(() => {
    if (reduce) {
      setAnimated(trust);
      return;
    }
    let controls;
    const t = setTimeout(() => {
      controls = animate(from.current, trust, {
        duration: 1.4,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => {
          from.current = v;
          setAnimated(v);
        },
        onComplete: () => setAnimated(trust),
      });
    }, 100);
    return () => {
      clearTimeout(t);
      controls?.stop();
    };
  }, [trust, reduce]);

  const stroke = Math.max(5, Math.round(size * 0.042));
  const radius = size / 2 - stroke - size * 0.085;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 300 / 360; // 300-degree gauge, 60-degree gap at bottom
  const dash = circumference * arcFraction;
  const filled = dash * (animated / 100);
  const scale = size / 180;

  const color = band === "high" ? "#d61f45" : band === "medium" ? "#c26a00" : "#047857";
  const tier = band === "high" ? "Low trust" : band === "medium" ? "Medium trust" : band ? "High trust" : "";

  // tick bezel
  const ticks = 60;
  const tickR1 = size / 2 - 2;
  const tickR0 = tickR1 - size * 0.045;
  const c = size / 2;
  const startDeg = 120; // matches the arc start after rotation
  const headDeg = startDeg + 300 * (animated / 100);
  const head = {
    x: c + radius * Math.cos((headDeg * Math.PI) / 180),
    y: c + radius * Math.sin((headDeg * Math.PI) / 180),
  };

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* ambient bloom behind the instrument */}
        <div
          className="absolute inset-[18%] rounded-full blur-2xl transition-colors duration-700"
          style={{ background: `${color}22` }}
        />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>

          {/* tick bezel */}
          {Array.from({ length: ticks }).map((_, i) => {
            const deg = startDeg + (300 / (ticks - 1)) * i;
            const rad = (deg * Math.PI) / 180;
            const lit = (i / (ticks - 1)) * 100 <= animated && animated > 0;
            const major = i % 5 === 0;
            const r0 = major ? tickR0 - size * 0.015 : tickR0;
            return (
              <line
                key={i}
                x1={c + r0 * Math.cos(rad)}
                y1={c + r0 * Math.sin(rad)}
                x2={c + tickR1 * Math.cos(rad)}
                y2={c + tickR1 * Math.sin(rad)}
                stroke={lit ? color : "rgba(16,20,40,0.12)"}
                strokeOpacity={lit ? (major ? 0.95 : 0.6) : 1}
                strokeWidth={major ? 1.4 : 1}
              />
            );
          })}

          <g transform={`rotate(120 ${c} ${c})`}>
            <circle
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              stroke="rgba(16,20,40,0.07)"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
            />
            <circle
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              stroke={`url(#g${gid})`}
              strokeWidth={stroke}
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
            />
          </g>

          {/* inner reticle */}
          <g className="origin-center animate-spinSlow" style={{ transformOrigin: `${c}px ${c}px` }}>
            <circle cx={c} cy={c} r={radius - stroke * 2.2} fill="none" stroke="rgba(16,20,40,0.1)" strokeWidth="1" strokeDasharray="1.5 5" />
          </g>

          {/* trust core: concentric inner ring + counter-orbiting signal markers */}
          <circle cx={c} cy={c} r={radius - stroke * 2.2} fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="1" />
          <g className="animate-spinSlower" style={{ transformOrigin: `${c}px ${c}px`, animationDirection: "reverse" }}>
            {[0, 120, 240].map((deg) => {
              const rr = radius - stroke * 2.2;
              const a = (deg * Math.PI) / 180;
              return <circle key={deg} cx={c + rr * Math.cos(a)} cy={c + rr * Math.sin(a)} r={Math.max(1.5, size * 0.009)} fill={color} opacity="0.8" />;
            })}
          </g>
          <g className="animate-spinSlow" style={{ transformOrigin: `${c}px ${c}px` }}>
            {[30, 95, 170, 215, 290, 335].map((deg, i) => {
              const rr = radius - stroke * (1.4 + (i % 3) * 0.9);
              const a = (deg * Math.PI) / 180;
              return <circle key={deg} cx={c + rr * Math.cos(a)} cy={c + rr * Math.sin(a)} r={0.9} fill="#07080d" opacity={0.25 + (i % 3) * 0.15} />;
            })}
          </g>

          {/* orbiting head marker */}
          {animated > 0 && (
            <g>
              <circle cx={head.x} cy={head.y} r={stroke * 1.05} fill="#ffffff" stroke={color} strokeWidth={1.5} />
              <circle cx={head.x} cy={head.y} r={stroke * 0.38} fill={color} />
            </g>
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span
            className="font-mono uppercase text-ink-500"
            style={{ fontSize: `${Math.max(8, Math.round(9 * scale))}px`, letterSpacing: "0.22em" }}
          >
            Trust
          </span>
          <span
            className="font-display font-semibold tabular-nums leading-none tracking-tight text-ink-50"
            style={{ fontSize: `${Math.round(46 * scale)}px`, marginTop: `${Math.round(4 * scale)}px` }}
          >
            {Math.round(animated)}
          </span>
          <span
            className="mt-2 text-center uppercase leading-tight text-ink-500"
            style={{ fontSize: `${Math.max(7, Math.round(8 * scale))}px`, letterSpacing: "0.14em", maxWidth: `${Math.round(radius * 1.2)}px` }}
          >
            {label}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-col items-center gap-1">
        {tier && (
          <span className="font-display text-sm font-semibold uppercase tracking-[0.14em]" style={{ color }}>
            {tier}
          </span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{band ? `${band} risk` : "—"}</span>
      </div>
    </div>
  );
}
