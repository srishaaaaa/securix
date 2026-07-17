/**
 * ScanFrame — the hero's signature illustration: an ID card and a face
 * silhouette inside a bracketed viewfinder, swept by an animated scan line.
 * Used on the landing hero and while a verification step is "processing".
 */
export default function ScanFrame({ active = true, size = 320 }) {
  return (
    <div
      className="relative rounded-2xl glass-panel overflow-hidden"
      style={{ width: size, height: size * 0.78 }}
    >
      <div className="absolute inset-0 grid-overlay opacity-40" />

      {/* corner brackets */}
      {["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2",
        "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map((pos, i) => (
        <div key={i} className={`absolute w-6 h-6 border-cyan-glow/70 ${pos}`} />
      ))}

      <svg viewBox="0 0 300 234" className="absolute inset-0 w-full h-full p-8">
        {/* ID card */}
        <rect x="20" y="60" width="120" height="80" rx="8" fill="#141a29" stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="45" cy="90" r="12" fill="#1b2333" stroke="#22d3ee" strokeOpacity="0.6" />
        <rect x="63" y="82" width="55" height="6" rx="3" fill="#22d3ee" opacity="0.5" />
        <rect x="63" y="94" width="40" height="5" rx="2.5" fill="#7c8797" opacity="0.6" />
        <rect x="30" y="112" width="100" height="5" rx="2.5" fill="#7c8797" opacity="0.4" />
        <rect x="30" y="122" width="70" height="5" rx="2.5" fill="#7c8797" opacity="0.4" />

        {/* face silhouette */}
        <g transform="translate(180,40)">
          <path d="M40 10 C60 10 70 30 70 55 C70 80 58 95 40 95 C22 95 10 80 10 55 C10 30 20 10 40 10Z"
                fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.7" />
          <circle cx="27" cy="50" r="2.2" fill="#22d3ee" />
          <circle cx="53" cy="50" r="2.2" fill="#22d3ee" />
          <path d="M28 68 Q40 76 52 68" stroke="#22d3ee" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
          {/* face mesh points */}
          {[[20,30],[40,22],[60,30],[15,55],[65,55],[25,80],[55,80]].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#22d3ee" opacity="0.55" />
          ))}
        </g>
      </svg>

      {active && (
        <div
          className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-cyan-glow/25 to-transparent animate-scanline"
          style={{ top: "-4rem" }}
        />
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest text-cyan-glow/80 uppercase">
        {active ? "analyzing…" : "scan complete"}
      </div>
    </div>
  );
}
