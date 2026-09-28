import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform,
} from "framer-motion";
import { useAuth } from "../context/AuthContext";
import TrustGauge from "../components/TrustGauge";
import SignalBars from "../components/SignalBars";
import Stage3D from "../components/three/Stage3D";
import { Logo } from "../components/Navbar";
import { EASE, LitCard, Magnetic, MaskLines, PageShell, Reveal, SysLabel, WordReveal } from "../components/ui/motion";
import { FaceMeshVisual, IdCardVisual, IdentityFallback, LivenessDemo, NetworkVisual } from "../components/story/visuals";
import {
  ArrowRight, ScanFace, FileSearch, Fingerprint, ShieldAlert,
  Gauge, Landmark, Building2, Wallet, Radio, CheckCircle2, ArrowDown, Check,
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

/* ------------------------------------------------------------------ */
/* Scroll-scene helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * A tall section whose content is pinned while the page scrolls through
 * it; children receive a 0..1 progress MotionValue. Reduced-motion users
 * get a normal, un-pinned section with every stage shown.
 */
function StickyScene({ vh = 260, phoneVh, id, children }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const done = useMotionValue(1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  if (reduce) {
    return (
      <section ref={ref} id={id} className="relative py-24">
        {children(done)}
      </section>
    );
  }
  return (
    <section
      ref={ref}
      id={id}
      className="relative [height:var(--h-phone)] sm:[height:var(--h)]"
      style={{ "--h": `${vh}vh`, "--h-phone": `${phoneVh || vh}vh` }}
    >
      <SceneFrame p={scrollYProgress}>{children(scrollYProgress)}</SceneFrame>
    </section>
  );
}

/**
 * Cinematic in/out for pinned scenes: the frame opens from an inset
 * rounded clip as it arrives, and recedes (scale + blur + fade) as the
 * next scene takes over.
 */
function SceneFrame({ p, children }) {
  const inset = useTransform(p, [0, 0.1], [9, 0]);
  const radius = useTransform(p, [0, 0.1], [36, 0]);
  const clip = useTransform([inset, radius], ([i, r]) => `inset(${i}% ${i * 0.6}% ${i}% ${i * 0.6}% round ${r}px)`);
  const scale = useTransform(p, [0.86, 1], [1, 0.93]);
  const opacity = useTransform(p, [0.88, 1], [1, 0.15]);
  const blur = useTransform(p, [0.88, 1], ["blur(0px)", "blur(10px)"]);
  return (
    <div className="sticky top-0 h-[100svh] overflow-hidden">
      <motion.div style={{ clipPath: clip, scale, opacity, filter: blur }} className="flex h-full items-center bg-void-900/40">
        {children}
      </motion.div>
    </div>
  );
}

/** Discrete stage index from a progress value, updated only at thresholds. */
function useStage(progress, thresholds) {
  const calc = (v) => thresholds.filter((t) => v >= t).length;
  const [stage, setStage] = useState(() => calc(progress.get()));
  useMotionValueEvent(progress, "change", (v) => {
    const s = calc(v);
    if (s !== stage) setStage(s);
  });
  return stage;
}

function SceneIndex({ n, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-accent-soft">SCENE {n}</span>
      <span className="h-px w-10 bg-white/15" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 01 - Identity                                                 */
/* ------------------------------------------------------------------ */

function SceneIdentity({ p }) {
  const w1 = useTransform(p, [0.02, 0.14, 0.5, 0.6], [0, 1, 1, 0]);
  const w2 = useTransform(p, [0.1, 0.22, 0.5, 0.6], [0, 1, 1, 0]);
  const w3 = useTransform(p, [0.18, 0.3, 0.5, 0.6], [0, 1, 1, 0]);
  const wy = useTransform(p, [0, 0.3], [60, 0]);
  const wBlur = useTransform(p, [0.5, 0.6], ["blur(0px)", "blur(14px)"]);
  const wScale = useTransform(p, [0.5, 0.6], [1, 0.92]);
  const b = useTransform(p, [0.58, 0.72], [0, 1]);
  const by = useTransform(p, [0.58, 0.72], [50, 0]);

  const cardRotY = useTransform(p, [0, 0.5, 1], [-38, -8, 16]);
  const cardRotX = useTransform(p, [0, 0.5, 1], [18, 6, -4]);
  const cardScale = useTransform(p, [0, 0.4, 1], [0.78, 1, 1.04]);
  const cardY = useTransform(p, [0, 1], [60, -30]);
  const stage = useStage(p, [0.62, 0.7, 0.78, 0.86]);
  const chips = ["Name", "Date of birth", "Document no.", "Address"];

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-6 px-5 sm:px-8 lg:grid-cols-2 lg:gap-10">
      <div className="relative">
        <SceneIndex n="01" label="Identity" />
        <div className="relative mt-6 h-[30vh] sm:h-[42vh]">
          <motion.h2 style={{ y: wy, filter: wBlur, scale: wScale }} className="absolute inset-0 origin-left font-display text-giant font-semibold uppercase text-ink-50">
            <motion.span style={{ opacity: w1 }} className="block">Who</motion.span>
            <motion.span style={{ opacity: w2 }} className="block text-outline">are</motion.span>
            <motion.span style={{ opacity: w3 }} className="block">you?</motion.span>
          </motion.h2>
          <motion.h2 style={{ opacity: b, y: by }} className="absolute inset-0 font-display text-giant font-semibold uppercase text-ink-50">
            <span className="block">We read</span>
            <span className="block text-gradient">the signals.</span>
          </motion.h2>
        </div>
        <motion.p style={{ opacity: b }} className="mt-2 max-w-md text-sm leading-relaxed text-ink-300 sm:text-base">
          Every verification starts with a document. SECURIX reads it the way an examiner would — field by field, pixel by pixel.
        </motion.p>
      </div>

      <div className="relative flex items-center justify-center" style={{ perspective: 1200 }}>
        <motion.div style={{ rotateY: cardRotY, rotateX: cardRotX, scale: cardScale, y: cardY }} className="relative w-[min(86vw,520px)]">
          <div className="absolute -inset-10 rounded-[40px] bg-accent/10 blur-3xl" />
          <IdCardVisual className="relative w-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.7)]" />
          <div className="pointer-events-none absolute inset-0">
            {chips.map((c, i) => (
              <motion.div
                key={c}
                initial={false}
                animate={{ opacity: stage > i ? 1 : 0, x: stage > i ? 0 : 20 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute right-[-4%] flex items-center gap-2 rounded-full border border-signal-emerald/30 bg-void-900/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal-emerald backdrop-blur sm:right-[-12%]"
                style={{ top: `${18 + i * 18}%` }}
              >
                <Check className="h-3 w-3" /> {c}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 02 - Document intelligence                                    */
/* ------------------------------------------------------------------ */

const DOC_STAGES = ["Document detected", "OCR extraction", "Field recognition", "Format validation", "Authenticity analysis", "Forgery analysis"];
// bounding boxes over the IdCardVisual, in % of the card
const DOC_BOXES = [
  { l: 4.2, t: 19.5, w: 23, h: 45, label: "Photo" },
  { l: 29.5, t: 20, w: 38, h: 9, label: "Name" },
  { l: 29.5, t: 33, w: 26, h: 9, label: "DOB" },
  { l: 29.5, t: 46, w: 33, h: 9, label: "Doc no." },
  { l: 29.5, t: 59, w: 56, h: 13, label: "Address" },
  { l: 3.5, t: 76, w: 76, h: 18, label: "MRZ" },
];

function SceneDocument({ p }) {
  const stage = useStage(p, [0.08, 0.22, 0.36, 0.5, 0.64, 0.78]);
  const beam = useTransform(p, [0.05, 0.95], ["0%", "100%"]);
  const scale = useTransform(p, [0, 0.2], [0.9, 1]);
  const pct = useTransform(p, [0.05, 0.9], [0, 100]);
  const pctRef = useRef(null);
  // written straight to the DOM - scrolling never re-renders the scene
  useMotionValueEvent(pct, "change", (v) => {
    if (pctRef.current) pctRef.current.textContent = `${String(Math.round(Math.max(0, Math.min(100, v)))).padStart(3, "0")}%`;
  });

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
      <div className="order-2 lg:order-1">
        <SceneIndex n="02" label="Document intelligence" />
        <h2 className="mt-5 font-display text-big font-semibold uppercase text-ink-50 sm:text-huge">
          Read.<br />
          <span className="text-ink-500">Validate.</span><br />
          Examine.
        </h2>
        <ol className="mt-6 space-y-1.5 sm:mt-8 sm:space-y-2.5">
          {DOC_STAGES.map((s, i) => {
            const done = stage > i + 1;
            const active = stage === i + 1;
            return (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[9px] transition-all duration-500 ${
                    done ? "border-signal-emerald/50 bg-signal-emerald/15 text-signal-emerald" : active ? "border-ink-50 bg-ink-50 text-void-900" : "border-white/10 text-ink-700"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-500 sm:text-xs ${active ? "text-ink-50" : done ? "text-ink-300" : "text-ink-700"}`}>
                  {s}
                </span>
                {active && <span className="h-px flex-1 bg-gradient-to-r from-accent-soft/60 to-transparent" />}
              </li>
            );
          })}
        </ol>
      </div>

      <motion.div style={{ scale }} className="relative order-1 mx-auto w-full max-w-[640px] lg:order-2">
        <div className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-to-br from-accent/15 via-transparent to-violet/10 blur-2xl" />
        <div className="relative">
          <IdCardVisual className="w-full" scanning={false} />
          {/* scan beam, tied to scroll */}
          <motion.div style={{ top: beam }} className="pointer-events-none absolute inset-x-0 h-px bg-ink-50 shadow-[0_0_30px_6px_rgba(157,176,255,0.55)]" />
          {DOC_BOXES.map((b, i) => (
            <motion.div
              key={b.label}
              initial={false}
              animate={{ opacity: stage >= 2 + (i > 2 ? 1 : 0) ? 1 : 0, scale: stage >= 2 ? 1 : 1.08 }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
              className={`absolute rounded-[4px] border ${stage >= 5 ? "border-signal-emerald/80" : "border-accent-soft/80"}`}
              style={{ left: `${b.l}%`, top: `${b.t}%`, width: `${b.w}%`, height: `${b.h}%` }}
            >
              {(b.label === "Photo" || b.label === "MRZ") && (
                <span className={`absolute -top-4 left-0 font-mono text-[8px] uppercase tracking-[0.14em] sm:-top-5 sm:text-[9px] ${stage >= 5 ? "text-signal-emerald" : "text-accent-soft"}`}>
                  {b.label}
                </span>
              )}
            </motion.div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {["OCR", "Format", "Authenticity", "QR", "Forensic"].map((t, i) => (
            <span
              key={t}
              className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] transition-all duration-500 ${
                stage >= i + 2 ? "border-signal-emerald/40 bg-signal-emerald/10 text-signal-emerald" : "border-white/10 text-ink-700"
              }`}
            >
              {stage >= i + 2 ? "✓ " : ""}{t}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <span>{DOC_STAGES[Math.max(0, Math.min(stage - 1, DOC_STAGES.length - 1))]}</span>
          <span ref={pctRef} className="tabular-nums text-ink-300">{`${String(Math.round(Math.max(0, Math.min(100, pct.get())))).padStart(3, "0")}%`}</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 03 - Face verification                                        */
/* ------------------------------------------------------------------ */

const FACE_STAGES = ["Waiting", "Face detected", "Facial landmarks", "Face match", "Liveness"];

function SceneFace({ p }) {
  const stage = useStage(p, [0.1, 0.32, 0.55, 0.76]);
  const thumbX = useTransform(p, [0, 0.35], ["0%", "-30%"]);
  const thumbO = useTransform(p, [0, 0.12, 0.5, 0.62], [0, 1, 1, 0.35]);
  const meshScale = useTransform(p, [0, 0.3], [0.86, 1]);

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-6 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12">
      <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-center">
        {/* the document portrait "lifts off" into the live biometric mesh */}
        <motion.div style={{ x: thumbX, opacity: thumbO }} className="absolute left-0 top-[8%] w-[26%] rounded-xl border border-white/10 bg-void-800/80 p-2 backdrop-blur">
          <div className="aspect-[3/4] rounded-md bg-gradient-to-b from-void-600 to-void-700" />
          <span className="mt-1.5 block font-mono text-[8px] uppercase tracking-[0.14em] text-ink-500">Doc photo</span>
        </motion.div>
        <motion.div style={{ scale: meshScale }} className="relative aspect-[200/240] w-[min(64vw,400px)]">
          <FaceMeshVisual stage={stage} className="h-full w-full" />
        </motion.div>
      </div>

      <div>
        <SceneIndex n="03" label="Face verification" />
        <div className="relative mt-5 min-h-[1em] font-display text-big font-semibold uppercase sm:text-huge">
          <AnimatePresence mode="wait">
            <motion.h2
              key={stage}
              initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -24, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: EASE }}
              className={stage >= 3 ? "text-signal-emerald" : "text-ink-50"}
            >
              {FACE_STAGES[stage]}
              {stage === 0 && <span className="animate-blink">_</span>}
            </motion.h2>
          </AnimatePresence>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-300 sm:text-base">
          The selfie is matched against the portrait on the document, then a multi-frame burst checks for natural
          micro-movement, sharpness and blink variation — a live human, not a photo or a replay.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {FACE_STAGES.slice(1).map((s, i) => (
            <span
              key={s}
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all duration-500 ${
                stage > i ? "border-signal-emerald/40 bg-signal-emerald/10 text-signal-emerald" : "border-white/10 text-ink-700"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: illustrative pipeline states cycled on the identity core.     */
/* (A labelled demo sequence - never a real verification result.)      */
/* ------------------------------------------------------------------ */

const HERO_STATES = ["Scanning identity", "Document detected", "Biometrics analyzed", "Liveness verified", "Risk analyzed", "Identity verified"];
const ORBITS = [
  { n: "01", label: "Identity", cls: "left-[8%] top-[18%]" },
  { n: "02", label: "Biometric", cls: "right-[20%] top-[12%]" },
  { n: "03", label: "Trust", cls: "right-[16%] bottom-[28%]" },
  { n: "04", label: "Fraud", cls: "left-[14%] bottom-[18%]" },
];

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
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const { user } = useAuth();
  const heroRef = useRef(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroTextY = useTransform(heroP, [0, 1], [0, -120]);
  const heroTextO = useTransform(heroP, [0, 0.7], [1, 0]);
  const heroCanvasScale = useTransform(heroP, [0, 1], [1, 1.18]);
  const heroCanvasO = useTransform(heroP, [0, 0.9], [1, 0.2]);
  const heroCanvasY = useTransform(heroP, [0, 1], [0, 80]);
  const heroState = useHeroState();
  const done = heroState === HERO_STATES.length - 1;

  return (
    <PageShell className="relative -mt-[66px] overflow-x-clip sm:-mt-[72px]">
      {/* ============================ HERO ============================ */}
      <section ref={heroRef} className="relative flex min-h-[100svh] flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-overlay opacity-50" />
        <motion.div
          style={{ scale: heroCanvasScale, opacity: heroCanvasO, y: heroCanvasY }}
          className="absolute inset-x-0 top-0 h-[62svh] sm:h-[70svh] lg:inset-y-0 lg:left-auto lg:right-[-6%] lg:h-full lg:w-[62%]"
        >
          <Stage3D
            scene="identity"
            className="h-full w-full"
            sceneProps={{ stage: heroState }}
            fallback={<IdentityFallback className="h-full w-full p-6 opacity-90" />}
          />
          {/* orbit labels */}
          <div className="pointer-events-none absolute inset-0 hidden lg:block">
            {ORBITS.map((o, k) => (
              <motion.div
                key={o.n}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + k * 0.15, duration: 0.8 }}
                className={`absolute ${o.cls} flex items-center gap-2`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-soft/80 shadow-[0_0_10px_rgba(157,176,255,0.8)]" />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
                  Orbit {o.n} <span className="text-ink-300">/ {o.label}</span>
                </span>
              </motion.div>
            ))}
          </div>
          {/* pipeline state (demo sequence) */}
          <div className="pointer-events-none absolute left-1/2 top-[15%] w-max -translate-x-1/2 sm:top-[14%] lg:bottom-[12%] lg:left-auto lg:right-[22%] lg:top-auto lg:translate-x-0">
            <div className="glass-2 flex items-center gap-3 rounded-full px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${done ? "bg-signal-emerald" : "bg-accent-soft"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${done ? "bg-signal-emerald" : "bg-accent-soft"}`} />
              </span>
              <motion.span
                key={heroState}
                initial={{ opacity: 0.2, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={`min-w-[17ch] font-mono text-[10px] uppercase tracking-[0.2em] ${done ? "text-signal-emerald" : "text-ink-100"}`}
              >
                {HERO_STATES[heroState]}
              </motion.span>
              <span className="font-mono text-[9px] text-ink-700">{String(heroState + 1).padStart(2, "0")}/06</span>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void-900 to-transparent lg:hidden" />
        </motion.div>

        <motion.div
          style={{ y: heroTextY, opacity: heroTextO }}
          className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-5 pb-10 pt-[46svh] sm:px-8 sm:pt-[52svh] lg:justify-center lg:pb-16 lg:pt-32"
        >
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <SysLabel live>SECURIX / Identity engine</SysLabel>
              <SysLabel tone="muted" className="hidden sm:inline-flex">System status / online</SysLabel>
            </div>
          </motion.div>

          <h1 className="mt-5 max-w-[13ch] font-display text-[clamp(2.5rem,7vw,6.6rem)] font-semibold uppercase leading-[0.9] tracking-[-0.045em] text-ink-50">
            <MaskLines lines={["Identity", "is more than"]} delay={0.35} />
            <MaskLines lines={[<span key="v" className="text-gradient">a document.</span>]} delay={0.53} />
          </h1>

          <div className="mt-6 flex flex-col gap-1 font-display text-lg font-medium uppercase tracking-tight sm:text-2xl">
            <WordReveal text="Verify the person." delay={0.8} className="text-ink-50" />
            <WordReveal text="Understand the signal." delay={0.95} className="text-ink-500" />
            <WordReveal text="Stop the fraud." delay={1.1} className="text-accent-soft" />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 1.2, duration: 0.8, ease: EASE }}
            className="mt-5 max-w-md text-sm leading-relaxed text-ink-300 sm:text-base"
          >
            AI-powered identity verification built to detect fraud before it becomes a problem — document OCR,
            biometric face matching, liveness and risk scoring in one pipeline.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.7, ease: EASE }}
            className="mt-8 flex flex-col gap-3 xs:flex-row xs:items-center"
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
              <a href="#story" className="btn btn-ghost btn-lg w-full xs:w-auto">
                Explore Securix <ArrowDown className="h-4 w-4" />
              </a>
            </Magnetic>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-5">
            <Link to="/login" className="text-sm text-ink-500 underline-offset-4 transition hover:text-ink-100 hover:underline">
              I already have an account
            </Link>
          </motion.div>
        </motion.div>

        {/* telemetry strip */}
        <div className="relative z-10 border-t border-white/[0.06] bg-void-900/40 backdrop-blur-sm">
          <div className="fade-x flex overflow-hidden py-3.5">
            <div className="flex min-w-max animate-marquee gap-10 pr-10">
              {[...SIGNALS, ...SIGNALS].map((s, i) => (
                <span key={i} className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  <span className="h-1 w-1 rounded-full bg-accent-soft/70" /> {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======================= STORY SCENES ======================== */}
      <div id="story" className="scroll-mt-20">
        <StickyScene vh={240} phoneVh={200}>{(p) => <SceneIdentity p={p} />}</StickyScene>
        <StickyScene vh={300} phoneVh={240}>{(p) => <SceneDocument p={p} />}</StickyScene>
        <StickyScene vh={260} phoneVh={220}>{(p) => <SceneFace p={p} />}</StickyScene>
      </div>

      {/* ========================= LIVENESS ========================== */}
      <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <SceneIndex n="04" label="Liveness" />
            <h2 className="mt-5 font-display text-huge font-semibold uppercase text-ink-50">
              Prove you're<br /><span className="text-gradient">here. Now.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-300 sm:text-base">
              A randomized challenge — look left, look right, smile or raise your eyebrows — is issued per attempt, so a
              pre-recorded video of one gesture can't be replayed. Five frames are captured and the motion is verified
              with facial landmarks.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
              {[["Randomized", "per attempt"], ["5 frames", "per capture"], ["Landmarks", "468-point mesh"], ["Burst", "blink & motion"]].map(([a, b]) => (
                <div key={a} className="surface rounded-2xl px-4 py-3.5">
                  <p className="font-display text-lg font-semibold text-ink-50">{a}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{b}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="relative flex justify-center">
            <div className="absolute inset-0 -z-10 m-auto h-[80%] w-[80%] rounded-full bg-accent/10 blur-3xl" />
            <LivenessDemo />
          </Reveal>
        </div>
      </section>

      {/* ======================= FRAUD NETWORK ======================= */}
      <section className="relative overflow-hidden border-y border-white/[0.05] bg-void-950/60 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(255,84,104,0.06),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <SceneIndex n="05" label="Fraud intelligence" />
              <h2 className="mt-5 font-display text-huge font-semibold uppercase text-ink-50">
                Nobody verifies<br />in isolation.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-300 sm:text-base">
              Every verification is linked to the devices, phone numbers and document numbers it shares with others. Rings
              of synthetic identities light up the moment they connect.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 sm:mt-14">
            <NetworkVisual className="mx-auto w-full max-w-5xl" />
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-signal-amber" /> Shared device</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-soft" /> Shared phone</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-signal-crimson" /> Shared document #</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-300" /> Shared email</span>
            <span className="flex items-center gap-2"><span className="h-px w-5 bg-signal-crimson" /> High-risk link</span>
          </div>
          <p className="mt-4 text-center font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-700">Hover or tap a node · illustrative</p>
        </div>
      </section>

      {/* =========================== TRUST =========================== */}
      <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_auto]">
          <Reveal>
            <SceneIndex n="06" label="Trust" />
            <h2 className="mt-5 font-display text-huge font-semibold uppercase text-ink-50">
              Confidence,<br /><span className="text-ink-500">quantified.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-base">
              Document, biometric, behavioural and network signals roll into one explainable risk score — and an instant
              approve, review or reject. Every contributing rule is visible in the report.
            </p>
            <div className="mt-8 flex max-w-xl flex-wrap gap-2">
              {SIGNALS.map((s) => (
                <span key={s} className="rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
                  {s}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="flex justify-center">
            <div className="glass-3 edge-light edge-emerald relative rounded-[2rem] px-8 py-8 sm:px-12 sm:py-10">
              <TrustGauge riskScore={18} band="low" size={230} label="Sample trust score" />
              <SignalBars
                className="mt-8 w-[min(78vw,380px)]"
                rows={[
                  { key: "doc", label: "Document", value: 91 },
                  { key: "face", label: "Face", value: 86 },
                  { key: "live", label: "Liveness", value: 94 },
                  { key: "dev", label: "Device", value: 78 },
                  { key: "net", label: "Fraud signal", value: 82 },
                ]}
              />
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink-700">Illustrative sample</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= DECISION ========================== */}
      <section className="relative overflow-hidden border-y border-white/[0.05] py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_40%,rgba(53,217,154,0.10),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <SceneIndex n="07" label="Decision" />
          </Reveal>
          <h2 className="mt-6 font-display text-giant font-semibold uppercase text-signal-emerald">
            <MaskLines lines={["Identity", "verified."]} inView />
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-base">
              Every verification ends in one of four outcomes — decided by the risk engine, explained in the report, and
              overridable by an admin.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Approved", d: "Low risk — instant approval.", c: "text-signal-emerald", e: "edge-emerald" },
              { t: "Step-up", d: "Second factor: OTP, repeat selfie or video KYC.", c: "text-accent-soft", e: "" },
              { t: "Review", d: "Borderline — routed to a human analyst.", c: "text-signal-amber", e: "edge-amber" },
              { t: "Rejected", d: "High risk or tampering — declined.", c: "text-signal-crimson", e: "edge-crimson" },
            ].map((o, i) => (
              <Reveal key={o.t} delay={i * 0.08}>
                <div className={`glass-2 edge-light ${o.e} h-full rounded-[1.4rem] p-6`}>
                  <span className="font-mono text-[10px] text-ink-700">0{i + 1}</span>
                  <p className={`mt-6 font-display text-2xl font-semibold uppercase ${o.c}`}>{o.t}</p>
                  <p className="mt-2 text-sm text-ink-300">{o.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== PIPELINE ========================= */}
      <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <Reveal className="mb-12 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="eyebrow">The pipeline</span>
            <h2 className="mt-4 font-display text-big font-semibold uppercase text-ink-50">Four steps, one decision</h2>
          </div>
          <p className="max-w-md text-ink-300">
            Every verification walks the same automated sequence — no step skipped, every signal logged.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 border-t border-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map(({ n, title, desc, Icon }, i) => (
            <Reveal key={n} delay={i * 0.08} className="group border-b border-white/[0.07] py-8 sm:px-6 sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-700 transition-colors group-hover:text-accent-soft">{n}</span>
                <Icon className="h-5 w-5 text-ink-500 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:text-accent-soft" />
              </div>
              <h3 className="mt-10 font-display text-2xl font-semibold text-ink-50">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-300">{desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ========================== FEATURES ========================= */}
      <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <Reveal className="mb-12">
          <span className="eyebrow">Under the hood</span>
          <h2 className="mt-4 font-display text-big font-semibold uppercase text-ink-50">Built for real fraud patterns</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FEATURES.map(({ title, desc, Icon }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <LitCard className="glass-panel group h-full rounded-[1.5rem] p-7 transition-transform duration-500 hover:-translate-y-1 sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  <Icon className="h-5 w-5 text-accent-soft" />
                </div>
                <h3 className="mt-8 font-display text-xl font-semibold text-ink-50">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-300">{desc}</p>
              </LitCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ====================== BUILT FOR / TRUST ==================== */}
      <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal className="grid grid-cols-1 gap-10 border-y border-white/[0.07] py-10 lg:grid-cols-2">
          <div>
            <span className="eyebrow">Built for</span>
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
              {INDUSTRIES.map(({ label, Icon }) => (
                <div key={label} className="flex items-center gap-2.5 text-ink-300">
                  <Icon className="h-5 w-5 text-ink-500" />
                  <span className="font-display text-lg font-medium">{label}</span>
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
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 sm:px-8 sm:pt-28">
        <Reveal className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] px-6 py-16 text-center sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(100,120,255,0.18),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 perspective-grid opacity-60" />
          <div className="relative">
            <span className="eyebrow">Two minutes, start to decision</span>
            <h2 className="mx-auto mt-5 max-w-3xl font-display text-huge font-semibold uppercase text-ink-50">
              Ready to see your risk score?
            </h2>
            <p className="mx-auto mt-5 max-w-md text-ink-300">
              Registration takes a minute. Full verification — document, face and decision — takes about two.
            </p>
            <Magnetic className="mt-9">
              <Link to={user ? "/verify" : "/register"} className="btn btn-light btn-lg">
                {user ? "Start verification" : "Create free account"}
                <ArrowRight className="btn-arrow h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo className="h-6 w-6" />
            <span className="font-display text-sm font-semibold tracking-[0.18em] text-ink-300">SECURIX</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700">AI-powered digital KYC & fraud detection</span>
        </footer>
      </section>
    </PageShell>
  );
}
