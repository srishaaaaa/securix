/**
 * ScanFrame — the hero's signature illustration: an ID card and a face
 * silhouette inside a softly-lit viewfinder, with a gentle scanning sweep.
 * Used on the landing hero and while a verification step is "processing".
 */
export default function ScanFrame({ active = true, size = 320 }) {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] glass-panel"
      style={{ width: size, height: size * 0.78 }}
    >
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />

      {/* corner brackets, softened */}
      {["top-4 left-4 border-t border-l", "top-4 right-4 border-t border-r",
        "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map((pos, i) => (
        <div key={i} className={`absolute h-5 w-5 rounded-[3px] border-accent-soft/40 ${pos}`} />
      ))}

      <svg viewBox="0 0 300 234" className="absolute inset-0 h-full w-full p-9">
        {/* ID card */}
        <rect x="20" y="60" width="120" height="80" rx="10" fill="#181c28" stroke="#5b6ef5" strokeOpacity="0.45" strokeWidth="1.5" />
        <circle cx="45" cy="90" r="12" fill="#212637" stroke="#5b6ef5" strokeOpacity="0.55" />
        <rect x="63" y="82" width="55" height="6" rx="3" fill="#5b6ef5" opacity="0.5" />
        <rect x="63" y="94" width="40" height="5" rx="2.5" fill="#727a90" opacity="0.6" />
        <rect x="30" y="112" width="100" height="5" rx="2.5" fill="#727a90" opacity="0.4" />
        <rect x="30" y="122" width="70" height="5" rx="2.5" fill="#727a90" opacity="0.4" />

        {/* face silhouette */}
        <g transform="translate(180,40)">
          <path d="M40 10 C60 10 70 30 70 55 C70 80 58 95 40 95 C22 95 10 80 10 55 C10 30 20 10 40 10Z"
                fill="none" stroke="#8fa4ff" strokeWidth="1.5" strokeOpacity="0.75" />
          <circle cx="27" cy="50" r="2.2" fill="#8fa4ff" />
          <circle cx="53" cy="50" r="2.2" fill="#8fa4ff" />
          <path d="M28 68 Q40 76 52 68" stroke="#8fa4ff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.75" />
          {[[20,30],[40,22],[60,30],[15,55],[65,55],[25,80],[55,80]].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#8fa4ff" opacity="0.55" />
          ))}
        </g>
      </svg>

      {active && (
        <div
          className="absolute left-0 right-0 h-20 animate-pulse bg-gradient-to-b from-transparent via-accent/20 to-transparent"
          style={{ top: "30%" }}
        />
      )}

      <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-[11px] font-medium tracking-wide text-accent-soft/90">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-soft opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-soft" />
        </span>
        {active ? "Analyzing…" : "Scan complete"}
      </div>
    </div>
  );
}
