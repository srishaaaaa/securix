import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import TrustGauge from "../components/TrustGauge";
import SignalBars from "../components/SignalBars";
import Stage3D from "../components/three/Stage3D";
import { Logo } from "../components/Navbar";
import { Magnetic, MaskLines, PageShell, Reveal, SysLabel, WordReveal } from "../components/ui/motion";
import { EASE } from "../components/ui/tokens";
import { useViewportTier } from "../components/ui/useViewport";
import { IdentityFallback, LivenessDemo } from "../components/story/visuals";
import {
  ArrowRight, ScanFace, FileSearch, Fingerprint, ShieldAlert,
  Gauge, Landmark, Building2, Wallet, Radio, CheckCircle2, ArrowDown,
} from "lucide-react";

const PIPELINE = [
  { n: "01", title: "Register", desc: "Create an account with your name, email and mobile number.", Icon: Fingerprint },
  { n: "02", title: "Upload ID", desc: "Scan an Aadhaar, PAN, passport or driving licence — OCR reads it instantly.", Icon: FileSearch },
  { n: "03", title: "Face + liveness", desc: "A short webcam burst checks it's really you, live, in front of the camera.", Icon: ScanFace },
  { n: "04", title: "Risk decision", desc: "Every signal rolls into one risk score, with an instant approve / review / reject.", Icon: Gauge },
];

const FEATURES = [
  { title: "OCR document extraction", desc: "Tesseract-powered text extraction pulls name, DOB, address and ID number straight off the document image.", Icon: FileSearch },
  { title: "Face match & liveness", desc: "Computer-vision face matching plus a multi-frame liveness burst that resists printed-photo and screen-replay spoofing.", Icon: ScanFace },
  { title: "Fraud & risk engine", desc: "Weighted risk scoring flags duplicate identities, format-invalid IDs, and signs of image tampering.", Icon: ShieldAlert },
  { title: "Admin oversight", desc: "A live dashboard for borderline cases, full audit trail, and manual override on every decision.", Icon: Radio },
];

const INDUSTRIES = [
  { label: "Banks", Icon: Landmark },
  { label: "Fintech", Icon: Wallet },
  { label: "Insurance", Icon: Building2 },
  { label: "Telecom", Icon: Radio },
];

const TRUST_POINTS = [
  "SOC2-style audit trail on every decision",
  "Bank-grade risk scoring, zero manual bottleneck",
  "Deployed in minutes, not quarters",
];

const SIGNALS = ["OCR", "Format validity", "ELA authenticity", "Forgery analysis", "Face match", "Liveness", "Challenge", "Device", "Geo-velocity", "Fraud graph", "Risk", "Trust"];

/* Illustrative pipeline states on the hero (a labelled demo sequence). */
const HERO_STATES = ["Scanning identity", "Document detected", "Biometrics analyzed", "Liveness verified", "Risk analyzed", "Identity verified"];

function useHeroState() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(reduce ? HERO_STATES.length - 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((v) => (v + 1) % HERO_STATES.length), 1800);
    return () => clearInterval(id);
  }, [reduce]);
  return i;
}

/* ------------------------------------------------------------------ */
/* Chapters - each one is a [data-world] section the 3D field morphs to */
/* ------------------------------------------------------------------ */

function Chapter({ n, world, next, side, kicker, lines, body, children, tone = "text-ink-50" }) {
  // the 3D form sits on `side`; copy takes the other half
  const textRight = side === "left";
  return (
    <section data-world={world} data-next={next} data-side={side} className="relative flex min-h-[115svh] items-center py-24">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 px-5 sm:px-10 lg:grid-cols-2">
        <div className={`relative pt-[38svh] sm:pt-[42svh] lg:pt-0 ${textRight ? "lg:col-start-2 lg:pl-10" : "lg:pr-10"}`}>
          <span className="pointer-events-none absolute -top-10 left-0 select-none font-display text-[clamp(7rem,20vw,18rem)] font-bold leading-none text-outline opacity-40 lg:-top-24">
            {n}
          </span>
          <Reveal className="relative">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-accent">CHAPTER {n}</span>
              <span className="h-px w-10 bg-ink-50/30" />
              <span className="eyebrow">{kicker}</span>
            </div>
          </Reveal>
          <h2 className={`relative mt-6 font-display text-[clamp(2.6rem,6.4vw,6.2rem)] font-semibold uppercase leading-[0.9] tracking-[-0.045em] ${tone}`}>
            <MaskLines lines={lines} inView />
          </h2>
          <Reveal delay={0.1} className="relative">
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-300 sm:text-base">{body}</p>
          </Reveal>
          {children && (
            <Reveal delay={0.18} className="relative mt-8">
              {children}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal scroll strip: pipeline + features                         */
/* ------------------------------------------------------------------ */

function HorizontalStrip() {
  const ref = useRef(null);
  const track = useRef(null);
  const reduce = useReducedMotion();
  const tier = useViewportTier();
  const [dist, setDist] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -dist]);
  const pinned = tier !== "phone" && !reduce;

  useLayoutEffect(() => {
    const measure = () => {
      if (track.current) setDist(Math.max(0, track.current.scrollWidth - window.innerWidth + 80));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pinned]);

  const cards = [
    ...PIPELINE.map((p, i) => ({ key: p.n, n: p.n, title: p.title, desc: p.desc, Icon: p.Icon, dark: i % 2 === 1, tag: "Pipeline" })),
    ...FEATURES.map((f, i) => ({ key: f.title, n: `0${i + 5}`, title: f.title, desc: f.desc, Icon: f.Icon, dark: i % 2 === 1, tag: "Under the hood" })),
  ];

  const intro = (
    <div className="flex w-[82vw] flex-shrink-0 flex-col justify-center pr-6 sm:w-[46vw] lg:w-[34vw]">
      <span className="eyebrow">The pipeline</span>
      <h2 className="mt-5 font-display text-[clamp(2.4rem,5vw,5rem)] font-semibold uppercase leading-[0.9] tracking-[-0.04em] text-ink-50">
        Four steps,<br />one decision.
      </h2>
      <p className="mt-5 max-w-sm text-ink-300">Every verification walks the same automated sequence — no step skipped, every signal logged.</p>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{pinned ? "Scroll →" : "Swipe →"}</p>
    </div>
  );

  const cardEls = cards.map(({ key, n, title, desc, Icon, dark, tag }) => (
    <article
      key={key}
      className={`flex h-[62svh] max-h-[560px] min-h-[380px] w-[78vw] flex-shrink-0 snap-start flex-col justify-between rounded-[2rem] p-7 sm:w-[46vw] sm:p-9 lg:w-[30vw] ${
        dark ? "bg-ink-50 text-paper" : "glass-3"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`font-display text-[clamp(3.5rem,7vw,6.5rem)] font-bold leading-none ${dark ? "text-paper/15" : "text-ink-50/10"}`}>{n}</span>
        <Icon className={`h-7 w-7 ${dark ? "text-[#8f90ff]" : "text-accent"}`} />
      </div>
      <div>
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${dark ? "text-paper/50" : "text-ink-500"}`}>{tag}</span>
        <h3 className={`mt-3 font-display text-[clamp(1.6rem,2.4vw,2.4rem)] font-semibold leading-tight ${dark ? "text-paper" : "text-ink-50"}`}>{title}</h3>
        <p className={`mt-3 max-w-sm text-sm leading-relaxed ${dark ? "text-paper/70" : "text-ink-300"}`}>{desc}</p>
      </div>
    </article>
  ));

  if (!pinned) {
    return (
      <section ref={ref} data-world="5" data-side="right" className="relative bg-void-900 py-20">
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4">
          {intro}
          {cardEls}
        </div>
      </section>
    );
  }
  return (
    <section ref={ref} data-world="5" data-side="right" className="relative bg-void-900" style={{ height: `${Math.max(220, 100 + dist / 8)}vh` }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <motion.div ref={track} style={{ x }} className="flex items-center gap-6 pl-[6vw]">
          {intro}
          {cardEls}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const { user } = useAuth();
  const heroState = useHeroState();
  const done = heroState === HERO_STATES.length - 1;

  // lets the fixed 3D world show through App's page background
  useEffect(() => {
    document.body.classList.add("has-world");
    return () => document.body.classList.remove("has-world");
  }, []);

  return (
    <PageShell className="relative -mt-[66px] overflow-x-clip sm:-mt-[72px]">
      {/* ======================= THE 3D WORLD ======================= */}
      {/* portalled to <body>: PageShell's entrance filter would otherwise
          become the containing block and the "fixed" world would scroll */}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden="true">
          <Stage3D scene="world" className="h-full w-full" fallback={<IdentityFallback className="absolute right-0 top-1/2 h-[70vh] w-[70vh] -translate-y-1/2 opacity-60" />} />
        </div>,
        document.body
      )}

      <div className="relative z-10">
        {/* =========================== HERO =========================== */}
        <section data-world="1" data-next="1" data-side="right" data-world-off className="relative flex min-h-[100svh] flex-col">
          {/* hero visual: the 3D identity-core mask (face mesh, orbit rings, ID fragments) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[58svh] sm:h-[64svh] lg:inset-y-0 lg:left-auto lg:right-[-4%] lg:h-full lg:w-[58%]">
            <Stage3D
              scene="identity"
              className="h-full w-full"
              sceneProps={{ stage: heroState }}
              fallback={<IdentityFallback className="h-full w-full p-6 opacity-90" />}
            />
            <div className="absolute inset-0 hidden lg:block">
              {[
                { n: "01", label: "Identity", cls: "left-[10%] top-[20%]" },
                { n: "02", label: "Biometric", cls: "right-[22%] top-[12%]" },
                { n: "03", label: "Trust", cls: "right-[16%] bottom-[30%]" },
                { n: "04", label: "Fraud", cls: "left-[16%] bottom-[20%]" },
              ].map((o, k) => (
                <motion.div
                  key={o.n}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + k * 0.15, duration: 0.8 }}
                  className={`absolute ${o.cls} flex items-center gap-2`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(61,61,255,0.6)]" />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
                    Orbit {o.n} <span className="text-ink-50">/ {o.label}</span>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-end px-5 pb-10 pt-[46svh] sm:px-10 lg:justify-center lg:pt-28">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <SysLabel live>SECURIX / Identity engine</SysLabel>
                <SysLabel tone="muted" className="hidden sm:inline-flex">System status / online</SysLabel>
              </div>
            </motion.div>

            <h1 className="mt-6 max-w-[12ch] font-display text-[clamp(3rem,9.2vw,9.6rem)] font-semibold uppercase leading-[0.86] tracking-[-0.055em] text-ink-50">
              <MaskLines lines={["Identity", "is more than"]} delay={0.3} />
              <MaskLines lines={[<span key="v" className="text-gradient">a document.</span>]} delay={0.48} />
            </h1>

            <div className="mt-7 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-end">
              <div className="flex flex-col gap-1 font-display text-lg font-medium uppercase tracking-tight sm:text-2xl">
                <WordReveal text="Verify the person." delay={0.75} className="text-ink-50" />
                <WordReveal text="Understand the signal." delay={0.9} className="text-ink-500" />
                <WordReveal text="Stop the fraud." delay={1.05} className="text-accent" />
              </div>
              <motion.p
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 1.15, duration: 0.8, ease: EASE }}
                className="max-w-sm text-sm leading-relaxed text-ink-300 sm:border-l sm:border-white/[0.12] sm:pl-6"
              >
                AI-powered identity verification built to detect fraud before it becomes a problem — document OCR,
                biometric face matching, liveness and risk scoring in one pipeline.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.7, ease: EASE }}
              className="mt-9 flex flex-col gap-3 xs:flex-row xs:items-center"
            >
              <Magnetic className="w-full xs:w-auto">
                <Link
                  to={user ? (user.role === "admin" ? "/admin" : "/verify") : "/register"}
                  className="btn btn-light btn-lg w-full xs:w-auto"
                >
                  {user ? "Go to console" : "Start verification"}
                  <ArrowRight className="btn-arrow h-4 w-4" />
                </Link>
              </Magnetic>
              <Magnetic className="w-full xs:w-auto" strength={0.2}>
                <a href="#chapters" className="btn btn-ghost btn-lg w-full xs:w-auto">
                  Explore Securix <ArrowDown className="h-4 w-4" />
                </a>
              </Magnetic>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-5">
              <Link to="/login" className="text-sm text-ink-500 underline-offset-4 transition hover:text-ink-50 hover:underline">
                I already have an account
              </Link>
            </motion.div>
          </div>

          {/* pipeline state (demo sequence) */}
          <div className="pointer-events-none absolute left-1/2 top-[16%] w-max -translate-x-1/2 sm:top-[14%] lg:bottom-[14%] lg:left-auto lg:right-[8%] lg:top-auto lg:translate-x-0">
            <div className="glass-2 flex items-center gap-3 rounded-full px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${done ? "bg-signal-emerald" : "bg-accent"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${done ? "bg-signal-emerald" : "bg-accent"}`} />
              </span>
              <motion.span
                key={heroState}
                initial={{ opacity: 0.2, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={`min-w-[17ch] font-mono text-[10px] uppercase tracking-[0.2em] ${done ? "text-signal-emerald" : "text-ink-50"}`}
              >
                {HERO_STATES[heroState]}
              </motion.span>
              <span className="font-mono text-[9px] text-ink-500">{String(heroState + 1).padStart(2, "0")}/06 · demo</span>
            </div>
          </div>

          {/* telemetry strip */}
          <div className="relative border-y border-white/[0.08] bg-paper/70 backdrop-blur-sm">
            <div className="fade-x flex overflow-hidden py-3.5">
              <div className="flex min-w-max animate-marquee gap-10 pr-10">
                {[...SIGNALS, ...SIGNALS].map((s, i) => (
                  <span key={i} className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                    <span className="h-1 w-1 rounded-full bg-accent" /> {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ========================= CHAPTERS ========================= */}
        <div id="chapters" className="scroll-mt-10">
          <Chapter
            n="01"
            world={1}
            next={2}
            side="right"
            kicker="Document intelligence"
            lines={["Read.", <span key="v" className="text-ink-500">Validate.</span>, "Examine."]}
            body="Every verification starts with a document. OCR pulls every field, format rules validate it, and error-level, copy-move and metadata analysis look for tampering — field by field, pixel by pixel."
          >
            <div className="flex max-w-lg flex-wrap gap-2">
              {["OCR", "Format", "Authenticity", "QR", "Forensic", "EXIF", "Copy-move"].map((t) => (
                <span key={t} className="rounded-full border border-white/[0.12] bg-paper/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
                  {t}
                </span>
              ))}
            </div>
          </Chapter>

          <Chapter
            n="02"
            world={2}
            next={3}
            side="left"
            kicker="Biometrics & liveness"
            lines={["Prove you're", <span key="v" className="text-gradient">here. Now.</span>]}
            body="The selfie is matched against the document portrait, then a multi-frame burst and a randomized challenge — look left, look right, smile, raise your eyebrows — confirm a live human, not a photo or a replay."
          >
            <div className="glass-3 inline-block rounded-[1.75rem] px-8 py-7">
              <LivenessDemo />
            </div>
          </Chapter>

          <Chapter
            n="03"
            world={3}
            next={4}
            side="right"
            kicker="Fraud intelligence"
            lines={["Nobody", "verifies", <span key="v" className="text-ink-500">alone.</span>]}
            body="Every verification is linked to the devices, phone numbers and document numbers it shares with others. Rings of synthetic identities light up the moment they connect."
          >
            <div className="grid max-w-md grid-cols-2 gap-2">
              {[
                ["Shared device", "bg-signal-amber"],
                ["Shared phone", "bg-violet"],
                ["Shared document #", "bg-signal-crimson"],
                ["Linked verification", "bg-accent"],
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-paper/80 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
                  <span className={`h-2 w-2 rounded-full ${c}`} /> {l}
                </span>
              ))}
            </div>
          </Chapter>

          <Chapter
            n="04"
            world={4}
            next={5}
            side="left"
            kicker="Trust"
            lines={["Confidence,", <span key="v" className="text-ink-500">quantified.</span>]}
            body="Document, biometric, behavioural and network signals roll into one explainable risk score. Every contributing rule is visible in the report."
          >
            <div className="glass-3 edge-light edge-emerald inline-flex flex-col items-center rounded-[1.75rem] px-8 py-7 sm:flex-row sm:items-center sm:gap-8">
              <TrustGauge riskScore={18} band="low" size={180} label="Sample trust score" />
              <div className="mt-6 sm:mt-0">
                <SignalBars
                  className="w-[min(72vw,300px)]"
                  rows={[
                    { key: "doc", label: "Document", value: 91 },
                    { key: "face", label: "Face", value: 86 },
                    { key: "live", label: "Liveness", value: 94 },
                    { key: "dev", label: "Device", value: 78 },
                    { key: "net", label: "Fraud signal", value: 82 },
                  ]}
                />
                <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">Illustrative sample</p>
              </div>
            </div>
          </Chapter>

          <Chapter
            n="05"
            world={5}
            next={5}
            side="right"
            kicker="Decision"
            tone="text-signal-emerald"
            lines={["Identity", "verified."]}
            body="Every verification ends in one of four outcomes — decided by the risk engine, explained in the report, and overridable by an admin."
          >
            <div className="grid max-w-xl grid-cols-2 gap-2">
              {[
                ["Approved", "Low risk — instant approval.", "text-signal-emerald"],
                ["Step-up", "OTP, repeat selfie or video KYC.", "text-accent"],
                ["Review", "Borderline — a human analyst.", "text-signal-amber"],
                ["Rejected", "High risk or tampering.", "text-signal-crimson"],
              ].map(([t, d, c]) => (
                <div key={t} className="rounded-2xl border border-white/[0.1] bg-paper/85 p-4 backdrop-blur">
                  <p className={`font-display text-lg font-semibold uppercase ${c}`}>{t}</p>
                  <p className="mt-1 text-xs text-ink-300">{d}</p>
                </div>
              ))}
            </div>
          </Chapter>
        </div>

        {/* ================= HORIZONTAL STRIP (pipeline + features) ================= */}
        <HorizontalStrip />

        {/* ====================== BUILT FOR / TRUST ==================== */}
        <section data-world="5" data-side="right" className="relative bg-void-900 px-5 py-16 sm:px-10">
          <Reveal className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 border-y border-white/[0.1] py-10 lg:grid-cols-2">
            <div>
              <span className="eyebrow">Built for</span>
              <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
                {INDUSTRIES.map(({ label, Icon }) => (
                  <div key={label} className="flex items-center gap-2.5 text-ink-50">
                    <Icon className="h-6 w-6 text-accent" />
                    <span className="font-display text-2xl font-semibold uppercase tracking-tight">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {TRUST_POINTS.map((t) => (
                <div key={t} className="flex items-center gap-3 text-sm text-ink-300">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-signal-emerald" />
                  {t}
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ============================ CTA ============================ */}
        <section data-world="5" data-side="right" className="relative bg-void-900 px-5 pb-16 pt-10 sm:px-10">
          <Reveal className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[2.5rem] bg-ink-50 px-6 py-20 text-center sm:px-12 sm:py-28">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(61,61,255,0.45),transparent_70%)]" />
            <div className="relative">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-paper/60">Two minutes, start to decision</span>
              <h2 className="mx-auto mt-6 max-w-4xl font-display text-[clamp(2.4rem,6vw,6rem)] font-semibold uppercase leading-[0.9] tracking-[-0.045em] text-paper">
                Ready to see your risk score?
              </h2>
              <p className="mx-auto mt-6 max-w-md text-paper/70">
                Registration takes a minute. Full verification — document, face and decision — takes about two.
              </p>
              <Magnetic className="mt-10">
                <Link to={user ? "/verify" : "/register"} className="btn btn-lg bg-paper text-ink-50 shadow-glow-lg">
                  {user ? "Start verification" : "Create free account"}
                  <ArrowRight className="btn-arrow h-4 w-4" />
                </Link>
              </Magnetic>
            </div>
          </Reveal>
          <footer className="mx-auto mt-14 flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-white/[0.1] pt-8 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <Logo className="h-6 w-6" />
              <span className="font-display text-sm font-semibold tracking-[0.18em] text-ink-50">SECURIX</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">AI-powered digital KYC & fraud detection</span>
          </footer>
        </section>
      </div>
    </PageShell>
  );
}
