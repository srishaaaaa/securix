import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/* ================================================================== */
/* Shared 2D face model (no three.js - keeps the landing main chunk    */
/* light). Landmark positions in a 200x240 box.                        */
/* ================================================================== */

const FACE_CX = 100;
const FACE_CY = 118;

function faceContour(n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const y = Math.sin(t);
    const narrow = y > 0 ? 1 - 0.3 * y * y : 1 - 0.08 * y * y;
    pts.push([FACE_CX + Math.cos(t) * 64 * narrow, FACE_CY + y * 92]);
  }
  return pts;
}

function faceLandmarks() {
  const pts = [];
  for (let i = 0; i < 17; i++) {
    const t = Math.PI * 0.06 + (i / 16) * Math.PI * 0.88;
    const y = Math.sin(t);
    pts.push([FACE_CX - Math.cos(t) * 62 * (1 - 0.28 * y * y), FACE_CY - 8 + y * 94]);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) pts.push([FACE_CX + s * (12 + i * 9), 84 - Math.sin((i / 4) * Math.PI) * 6]);
  for (let i = 0; i < 4; i++) pts.push([FACE_CX, 96 + i * 11]);
  for (let i = 0; i < 5; i++) pts.push([FACE_CX + (i - 2) * 7, 142 - Math.abs(i - 2) * 1.5]);
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push([FACE_CX + s * 26 + Math.cos(a) * 11, 104 + Math.sin(a) * 4.5]);
    }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push([FACE_CX + Math.cos(a) * 20, 170 + Math.sin(a) * 6]);
  }
  return pts;
}

function meshLines(pts) {
  // connect each landmark to its two nearest neighbours - reads as a mesh
  const out = [];
  pts.forEach((p, i) => {
    const d = pts
      .map((q, j) => [j, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
    d.forEach(([j]) => {
      if (j > i) out.push([p, pts[j]]);
    });
  });
  return out;
}

/* ================================================================== */
/* Face mesh - progressive stages driven by `stage` (0..4)             */
/*   0 idle, 1 face detected, 2 landmarks, 3 match, 4 liveness         */
/* ================================================================== */

export function FaceMeshVisual({ stage = 4, className = "" }) {
  const contour = useMemo(() => faceContour(), []);
  const lm = useMemo(() => faceLandmarks(), []);
  const lines = useMemo(() => meshLines(lm), [lm]);
  const reduce = useReducedMotion();
  const contourPath = `M${contour.map((p) => p.join(",")).join(" L")} Z`;

  return (
    <svg viewBox="0 0 200 240" className={className} fill="none">
      {/* biometric rings */}
      <g style={{ transformOrigin: "100px 118px" }} className={reduce ? "" : "animate-spinSlow"}>
        <circle cx="100" cy="118" r="112" stroke="rgba(157,176,255,0.14)" strokeDasharray="1 5" />
      </g>
      <circle cx="100" cy="118" r="102" stroke="rgba(157,176,255,0.08)" />
      <motion.circle
        cx="100" cy="118" r="102"
        stroke="#35d99a" strokeWidth="1.2" strokeLinecap="round"
        initial={false}
        animate={{ pathLength: stage >= 3 ? 1 : 0, opacity: stage >= 3 ? 0.9 : 0 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        style={{ rotate: -90, transformOrigin: "100px 118px" }}
      />

      {/* face detection box */}
      <motion.g initial={false} animate={{ opacity: stage >= 1 ? 1 : 0, scale: stage >= 1 ? 1 : 1.15 }} style={{ transformOrigin: "100px 118px" }} transition={{ duration: 0.6 }}>
        {[[28, 20, 1, 1], [172, 20, -1, 1], [28, 216, 1, -1], [172, 216, -1, -1]].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x} ${y + sy * 14} V${y} H${x + sx * 14}`} stroke="#eef0f6" strokeOpacity="0.7" strokeWidth="1.2" />
        ))}
      </motion.g>

      {/* contour */}
      <motion.path
        d={contourPath}
        stroke="#c7d2ff"
        strokeOpacity="0.55"
        strokeWidth="1"
        initial={false}
        animate={{ pathLength: stage >= 1 ? 1 : 0.001 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* mesh */}
      <motion.g initial={false} animate={{ opacity: stage >= 2 ? 1 : 0 }} transition={{ duration: 0.8 }}>
        {lines.map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#9db0ff" strokeOpacity="0.28" strokeWidth="0.6" />
        ))}
      </motion.g>
      {lm.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={1.5}
          fill={stage >= 3 ? "#35d99a" : "#eef0f6"}
          initial={false}
          animate={{ opacity: stage >= 2 ? 1 : 0, scale: stage >= 2 ? 1 : 0 }}
          transition={{ duration: 0.35, delay: stage >= 2 ? i * 0.008 : 0 }}
        />
      ))}

      {/* liveness pulse */}
      {stage >= 4 && !reduce && (
        <motion.ellipse
          cx="100" cy="118" rx="70" ry="98"
          stroke="#35d99a" strokeOpacity="0.6"
          initial={{ scale: 0.9, opacity: 0.8 }}
          animate={{ scale: 1.25, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: "100px 118px" }}
        />
      )}
    </svg>
  );
}

/* ================================================================== */
/* Liveness guide - an animated head that demonstrates a challenge.    */
/* ================================================================== */

const MOUTH_NEUTRAL = "M84 170 Q100 174 116 170";
const MOUTH_SMILE = "M80 166 Q100 186 120 166";

export function LivenessGuide({ challenge = "smile", phase = "waiting", className = "", loop = true }) {
  const reduce = useReducedMotion();
  const animateOn = loop && !reduce;
  const turn = challenge === "turn_left" ? -1 : challenge === "turn_right" ? 1 : 0;
  const tone = phase === "confirmed" ? "#35d99a" : phase === "detecting" ? "#9db0ff" : "#eef0f6";

  const cycle = animateOn ? { repeat: Infinity, repeatType: "reverse", duration: 1.1, repeatDelay: 0.5, ease: [0.45, 0, 0.55, 1] } : { duration: 0.6 };

  return (
    <svg viewBox="0 0 200 240" className={className} fill="none" aria-hidden="true">
      <ellipse cx="100" cy="122" rx="86" ry="108" stroke="rgba(157,176,255,0.12)" strokeDasharray="2 6" />
      {/* head */}
      <motion.g
        initial={false}
        animate={{ x: turn * 16, scaleX: turn ? 0.9 : 1 }}
        transition={cycle}
        style={{ transformOrigin: "100px 120px" }}
      >
        <ellipse cx="100" cy="120" rx="62" ry="84" stroke={tone} strokeOpacity="0.8" strokeWidth="1.4" />
        {/* features shift further than the outline -> reads as a head turn */}
        <motion.g initial={false} animate={{ x: turn * 14 }} transition={cycle}>
          <motion.g initial={false} animate={{ y: challenge === "raise_eyebrows" ? -9 : 0 }} transition={cycle}>
            <path d="M66 92 Q78 86 90 91" stroke={tone} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M110 91 Q122 86 134 92" stroke={tone} strokeWidth="1.6" strokeLinecap="round" />
          </motion.g>
          <ellipse cx="78" cy="106" rx="8" ry="4" stroke={tone} strokeOpacity="0.8" />
          <ellipse cx="122" cy="106" rx="8" ry="4" stroke={tone} strokeOpacity="0.8" />
          <circle cx="78" cy="106" r="2" fill={tone} />
          <circle cx="122" cy="106" r="2" fill={tone} />
          <path d="M100 112 L95 140 L104 142" stroke={tone} strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
          <motion.path
            initial={false}
            animate={{ d: challenge === "smile" ? [MOUTH_NEUTRAL, MOUTH_SMILE] : MOUTH_NEUTRAL }}
            transition={challenge === "smile" ? cycle : { duration: 0.4 }}
            stroke={tone}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </motion.g>
      </motion.g>
      {/* direction cue */}
      {turn !== 0 && (
        <motion.path
          d={turn < 0 ? "M40 224 H14 M24 214 L14 224 L24 234" : "M160 224 H186 M176 214 L186 224 L176 234"}
          stroke="#9db0ff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={animateOn ? { opacity: [0.2, 1, 0.2], x: [0, turn * 6, 0] } : { opacity: 1 }}
          transition={animateOn ? { duration: 1.6, repeat: Infinity } : {}}
        />
      )}
    </svg>
  );
}

/** Self-running demo that cycles the four challenges and their states. */
const DEMO = [
  ["turn_left", "Look left"],
  ["turn_right", "Look right"],
  ["smile", "Smile"],
  ["raise_eyebrows", "Raise eyebrows"],
];
const PHASES = ["waiting", "capturing", "analyzing", "verified"];

export function LivenessDemo({ active = true }) {
  const reduce = useReducedMotion();
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!active || reduce) return;
    const id = setInterval(() => setK((v) => v + 1), 900);
    return () => clearInterval(id);
  }, [active, reduce]);
  const challengeIdx = Math.floor(k / PHASES.length) % DEMO.length;
  const phase = reduce ? "verified" : PHASES[k % PHASES.length];
  const [challenge, label] = DEMO[challengeIdx];
  const phaseTone = { waiting: "text-ink-500", capturing: "text-accent-soft", analyzing: "text-violet-soft", verified: "text-signal-emerald" }[phase];
  const guidePhase = { waiting: "waiting", capturing: "scanning", analyzing: "detecting", verified: "confirmed" }[phase];

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative aspect-[200/240] w-[min(68vw,300px)]">
        <LivenessGuide challenge={challenge} phase={guidePhase} className="h-full w-full" />
        {phase === "capturing" && !reduce && (
          <div className="absolute inset-x-[12%] top-0 h-px animate-scanY bg-gradient-to-r from-transparent via-ink-50 to-transparent" />
        )}
      </div>
      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Live check</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.4 }}
            className="font-display text-3xl font-semibold uppercase tracking-tight text-ink-50 sm:text-4xl"
          >
            {label}
          </motion.span>
        </AnimatePresence>
        <span className={`font-mono text-[11px] uppercase tracking-[0.24em] transition-colors ${phaseTone}`}>
          {phase === "verified" ? "✓ Verified" : `${phase}…`}
        </span>
      </div>
      <div className="mt-5 flex gap-1.5">
        {DEMO.map(([c], i) => (
          <span key={c} className={`h-1 rounded-full transition-all duration-500 ${i === challengeIdx ? "w-8 bg-ink-50" : "w-3 bg-white/15"}`} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* ID card                                                             */
/* ================================================================== */

export function IdCardVisual({ className = "", scanning = true }) {
  return (
    <svg viewBox="0 0 340 214" className={className} fill="none">
      <defs>
        <linearGradient id="idg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2130" />
          <stop offset="1" stopColor="#0c0f16" />
        </linearGradient>
        <clipPath id="idclip">
          <rect x="1" y="1" width="338" height="212" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#idclip)">
        <rect width="340" height="214" fill="url(#idg)" />
        {Array.from({ length: 14 }).map((_, k) => (
          <path
            key={k}
            d={`M0 ${40 + k * 12} ${Array.from({ length: 18 }).map((_, i) => `Q${i * 20 + 10} ${40 + k * 12 + (i % 2 ? 5 : -5)} ${i * 20 + 20} ${40 + k * 12}`).join(" ")}`}
            stroke="rgba(157,176,255,0.06)"
          />
        ))}
        <rect width="340" height="30" fill="rgba(100,120,255,0.14)" />
        <text x="16" y="20" fill="#c7d2ff" fontFamily="Space Grotesk" fontSize="11" fontWeight="600" letterSpacing="2">IDENTITY DOCUMENT</text>
        <text x="258" y="20" fill="rgba(199,210,255,0.5)" fontFamily="JetBrains Mono" fontSize="8">SECURIX</text>
        <rect x="16" y="44" width="74" height="94" rx="8" fill="#20263a" stroke="rgba(157,176,255,0.4)" />
        <ellipse cx="53" cy="82" rx="19" ry="24" stroke="rgba(199,210,255,0.6)" />
        <path d="M22 138 C 26 112, 80 112, 84 138" stroke="rgba(199,210,255,0.6)" />
        <rect x="280" y="46" width="40" height="30" rx="5" fill="rgba(243,173,75,0.45)" />
        {[[104, 52, 120], [104, 80, 80], [104, 108, 104], [104, 136, 180], [104, 148, 150]].map(([x, y, w], i) => (
          <rect key={i} x={x} y={y} width={w} height="6" rx="3" fill="rgba(169,176,195,0.5)" />
        ))}
        {["NAME", "DOB", "DOC NO.", "ADDRESS"].map((l, i) => (
          <text key={l} x="104" y={48 + i * 28} fill="#737b91" fontFamily="JetBrains Mono" fontSize="6.5" letterSpacing="1">{l}</text>
        ))}
        <text x="16" y="178" fill="rgba(199,210,255,0.35)" fontFamily="JetBrains Mono" fontSize="10.5">IDIND&lt;&lt;SECURIX&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
        <text x="16" y="196" fill="rgba(199,210,255,0.35)" fontFamily="JetBrains Mono" fontSize="10.5">8812034M2901017&lt;&lt;&lt;&lt;&lt;04</text>
        {scanning && (
          <rect x="0" width="340" height="3" fill="#eef0f6" opacity="0.8">
            <animate attributeName="y" values="0;211;0" dur="3.4s" repeatCount="indefinite" />
          </rect>
        )}
      </g>
      <rect x="1" y="1" width="338" height="212" rx="16" stroke="rgba(157,176,255,0.35)" />
    </svg>
  );
}

/* ================================================================== */
/* Fraud-intelligence network (landing) - illustrative only            */
/* ================================================================== */

const NET_NODES = [
  { id: "person", x: 300, y: 200, r: 18, label: "Person", kind: "core" },
  { id: "device", x: 300, y: 64, r: 11, label: "Device", kind: "device" },
  { id: "phone", x: 118, y: 150, r: 11, label: "Phone", kind: "phone" },
  { id: "document", x: 482, y: 150, r: 11, label: "Document", kind: "document" },
  { id: "email", x: 160, y: 330, r: 11, label: "Email", kind: "email" },
  { id: "identity", x: 440, y: 330, r: 11, label: "Identity", kind: "identity" },
  { id: "l1", x: 470, y: 50, r: 7, label: "Linked verification", kind: "linked" },
  { id: "l2", x: 575, y: 250, r: 7, label: "Linked verification", kind: "linked" },
  { id: "l3", x: 40, y: 72, r: 7, label: "Linked verification", kind: "linked" },
  { id: "l4", x: 40, y: 262, r: 6, label: "Linked verification", kind: "linked" },
  { id: "l5", x: 300, y: 382, r: 6, label: "Linked verification", kind: "linked" },
];
const NET_EDGES = [
  ["person", "device"], ["person", "phone"], ["person", "document"], ["person", "email"], ["person", "identity"],
  ["device", "l1"], ["document", "l1", "risk"], ["document", "l2", "risk"], ["phone", "l3"], ["phone", "l4"],
  ["email", "l4"], ["email", "l5"], ["identity", "l5"], ["identity", "l2"],
];
const NET_COLOR = { core: "#eef0f6", device: "#f3ad4b", phone: "#b9a4ff", document: "#ff5468", email: "#7dd3fc", identity: "#9db0ff", linked: "#737b91" };

/**
 * Landing "network intelligence" illustration. Hover (or tap) a node: it
 * becomes prominent, its neighbours light up and unrelated nodes fade.
 */
export function NetworkVisual({ className = "" }) {
  const reduce = useReducedMotion();
  const [focus, setFocus] = useState(null);
  const byId = Object.fromEntries(NET_NODES.map((n) => [n.id, n]));
  const neighbours = new Set(focus ? NET_EDGES.filter((e) => e[0] === focus || e[1] === focus).flatMap((e) => [e[0], e[1]]) : []);
  const nodeDim = (id) => focus && !neighbours.has(id);
  const edgeOn = (e) => focus && (e[0] === focus || e[1] === focus);

  return (
    <svg viewBox="0 0 600 400" className={className} fill="none" role="img" aria-label="Illustration of an identity network linking a person to devices, phones, documents and emails">
      {NET_EDGES.map((e, i) => {
        const a = byId[e[0]];
        const b = byId[e[1]];
        const risk = e[2] === "risk";
        const path = `M${a.x} ${a.y} L${b.x} ${b.y}`;
        const faded = focus && !edgeOn(e);
        return (
          <g key={i} style={{ opacity: faded ? 0.12 : 1, transition: "opacity .4s ease" }}>
            <motion.path
              d={path}
              stroke={risk ? "#ff5468" : edgeOn(e) ? "#c7d2ff" : "rgba(157,176,255,0.22)"}
              strokeWidth={risk || edgeOn(e) ? 1.6 : 1}
              strokeDasharray={risk || edgeOn(e) ? "0" : "3 5"}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 + i * 0.06 }}
            />
            {!reduce && (
              <circle r={risk ? 2.6 : 2} fill={risk ? "#ff8a98" : "#9db0ff"}>
                <animateMotion dur={`${2.8 + (i % 4) * 0.6}s`} repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        );
      })}
      {NET_NODES.map((n, i) => {
        const c = NET_COLOR[n.kind];
        const on = focus === n.id;
        return (
          <motion.g
            key={n.id}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 + i * 0.05 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px`, cursor: "pointer" }}
            onMouseEnter={() => setFocus(n.id)}
            onMouseLeave={() => setFocus(null)}
            onClick={() => setFocus(on ? null : n.id)}
          >
            <g style={{ opacity: nodeDim(n.id) ? 0.2 : 1, transition: "opacity .4s ease" }}>
              <circle cx={n.x} cy={n.y} r={n.r * (on ? 3.2 : 2.4)} fill={c} opacity={on || n.kind === "core" ? 0.14 : 0.04} style={{ transition: "r .4s ease" }} />
              <circle cx={n.x} cy={n.y} r={on ? n.r * 1.25 : n.r} fill="#07080c" stroke={c} strokeWidth={n.kind === "core" || on ? 2 : 1.3} />
              <circle cx={n.x} cy={n.y} r={n.r * 0.4} fill={c} />
              {n.kind !== "linked" && (
                <text x={n.x} y={n.y + n.r + 18} textAnchor="middle" fill={on ? "#eef0f6" : "#a9b0c3"} fontFamily="JetBrains Mono" fontSize="10" letterSpacing="2">
                  {n.label.toUpperCase()}
                </text>
              )}
            </g>
          </motion.g>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/* Static fallback for the 3D identity core (reduced motion / no GL)   */
/* ================================================================== */

export function IdentityFallback({ className = "" }) {
  const lm = useMemo(() => faceLandmarks(), []);
  const pts = useMemo(() => {
    const out = [];
    const n = 260;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const z = Math.sin(th) * r;
      out.push([200 + Math.cos(th) * r * 150, 200 + y * 150, z]);
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none">
      <defs>
        <radialGradient id="ifg" cx="50%" cy="45%" r="50%">
          <stop offset="0" stopColor="rgba(100,120,255,0.25)" />
          <stop offset="1" stopColor="rgba(100,120,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" fill="url(#ifg)" />
      {pts.map(([x, y, z], i) => (
        <circle key={i} cx={x} cy={y} r={z > 0 ? 1.3 : 0.8} fill="#9db0ff" opacity={z > 0 ? 0.7 : 0.25} />
      ))}
      {[168, 182, 196].map((r, i) => (
        <ellipse key={r} cx="200" cy="200" rx={r} ry={r * (0.32 + i * 0.12)} stroke={i === 1 ? "rgba(53,217,154,0.3)" : "rgba(157,176,255,0.25)"} strokeDasharray={i === 2 ? "2 5" : "0"} transform={`rotate(${-18 + i * 22} 200 200)`} />
      ))}
      <g transform="translate(130 128) scale(0.7)">
        {meshLines(lm).map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#9db0ff" strokeOpacity="0.3" strokeWidth="0.8" />
        ))}
        {lm.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.9" fill="#fff" />
        ))}
      </g>
      <line x1="40" y1="232" x2="360" y2="232" stroke="#fff" strokeOpacity="0.5" />
    </svg>
  );
}

/** Static fallback for the 3D document scanner. */
export function DocumentFallback({ className = "" }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <IdCardVisual className="w-[82%] max-w-[420px] drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]" />
    </div>
  );
}
