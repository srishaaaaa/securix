/**
 * ScanFrame - a biometric viewfinder: corner brackets, a faint lattice,
 * an ID card and a landmark face mesh, with a scan beam sweeping through.
 * Used wherever a verification step is "processing".
 */
export default function ScanFrame({ active = true, size = 320 }) {
  return (
    <div
      className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-void-850/80"
      style={{ width: size, maxWidth: "100%", aspectRatio: "1 / 0.78" }}
    >
      <div className="absolute inset-0 grid-overlay opacity-40" />
      <div className="absolute left-1/2 top-[-30%] h-2/3 w-2/3 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />

      {/* corner brackets */}
      {["left-4 top-4 border-l border-t", "right-4 top-4 border-r border-t", "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map(
        (pos, i) => (
          <div key={i} className={`absolute h-6 w-6 rounded-[4px] border-ink-50/50 ${pos}`} />
        )
      )}

      <svg viewBox="0 0 300 234" className="absolute inset-0 h-full w-full p-8">
        {/* ID card */}
        <g opacity="0.95">
          <rect x="18" y="58" width="124" height="82" rx="10" fill="#10131b" stroke="#9db0ff" strokeOpacity="0.45" strokeWidth="1.2" />
          <rect x="28" y="72" width="30" height="36" rx="5" fill="#1b1f29" stroke="#9db0ff" strokeOpacity="0.5" strokeWidth="0.8" />
          <rect x="66" y="76" width="58" height="5" rx="2.5" fill="#9db0ff" opacity="0.55" />
          <rect x="66" y="88" width="40" height="4" rx="2" fill="#737b91" opacity="0.7" />
          <rect x="66" y="98" width="48" height="4" rx="2" fill="#737b91" opacity="0.5" />
          <rect x="28" y="118" width="102" height="4" rx="2" fill="#737b91" opacity="0.4" />
          <rect x="28" y="127" width="72" height="4" rx="2" fill="#737b91" opacity="0.35" />
        </g>
        {/* dashed link between document face and live face */}
        <path d="M60 90 C 110 40, 150 40, 190 70" stroke="#9db0ff" strokeOpacity="0.35" strokeDasharray="2 4" fill="none" />
        {/* face mesh */}
        <g transform="translate(176,34)">
          <path d="M44 6 C68 6 80 28 80 56 C80 86 64 104 44 104 C24 104 8 86 8 56 C8 28 20 6 44 6Z" fill="none" stroke="#c7d2ff" strokeWidth="1.1" strokeOpacity="0.8" />
          {[[22, 34, 66, 34], [14, 56, 74, 56], [22, 80, 66, 80], [44, 8, 44, 102], [26, 16, 26, 96], [62, 16, 62, 96]].map(([a, b, c2, d], i) => (
            <line key={i} x1={a} y1={b} x2={c2} y2={d} stroke="#9db0ff" strokeOpacity="0.14" />
          ))}
          <circle cx="30" cy="50" r="2.2" fill="#fff" />
          <circle cx="58" cy="50" r="2.2" fill="#fff" />
          <path d="M44 52 L41 68 L47 68" stroke="#c7d2ff" strokeOpacity="0.6" fill="none" />
          <path d="M32 80 Q44 88 56 80" stroke="#c7d2ff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeOpacity="0.8" />
          {[[18, 30], [44, 18], [70, 30], [12, 58], [76, 58], [22, 88], [66, 88], [44, 100]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#9db0ff" opacity="0.8" />
          ))}
        </g>
      </svg>

      {active && (
        <div className="absolute inset-x-6 top-0 h-px animate-scanY bg-gradient-to-r from-transparent via-ink-50 to-transparent shadow-[0_0_24px_4px_rgba(157,176,255,0.45)]" />
      )}

      <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-soft">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-soft opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-soft" />
        </span>
        {active ? "Analyzing…" : "Scan complete"}
      </div>
    </div>
  );
}
