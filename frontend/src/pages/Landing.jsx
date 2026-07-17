import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ScanFrame from "../components/ScanFrame";
import TrustGauge from "../components/TrustGauge";
import {
  ArrowRight, ScanFace, FileSearch, Fingerprint, ShieldAlert,
  Gauge, Landmark, Building2, Wallet, Radio, Sparkles,
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

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden">
      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-[0.35]" />

      {/* HERO */}
      <section className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-6 pb-24 pt-16 sm:pt-24 lg:flex-row lg:items-center lg:gap-10 lg:pb-32">
        <div className="max-w-xl text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-glow/25 bg-cyan-glow/5 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-glow">
            <Sparkles className="h-3 w-3" />
            AI-powered digital KYC
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-100 sm:text-5xl lg:text-[3.4rem]">
            Verify identity in seconds.
            <br />
            <span className="bg-gradient-to-r from-cyan-glow to-signal-emerald bg-clip-text text-transparent">
              Catch fraud before it onboards.
            </span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-ink-300 sm:text-lg">
            SECURIX replaces manual KYC with document OCR, biometric face matching, liveness
            detection and AI-driven risk scoring — one automated pipeline from upload to decision.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              to={user ? (user.role === "admin" ? "/admin" : "/verify") : "/register"}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-glow px-6 py-3.5 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90 sm:w-auto"
            >
              {user ? "Go to console" : "Start verification"}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="w-full rounded-xl border border-white/[0.08] px-6 py-3.5 text-center text-sm font-medium text-ink-300 transition hover:border-white/[0.15] hover:text-ink-100 sm:w-auto"
            >
              I already have an account
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start">
            {INDUSTRIES.map(({ label, Icon }) => (
              <div key={label} className="flex items-center gap-1.5 text-ink-500">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-center gap-6">
          <ScanFrame size={340} />
          <TrustGauge riskScore={18} band="low" size={148} label="Sample trust score" />
        </div>
      </section>

      {/* PIPELINE */}
      <section className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="mb-14 text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-glow">The pipeline</span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-100 sm:text-4xl">Four steps, one decision</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-300">
            Every verification walks the same automated sequence — no step skipped, every signal logged.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map(({ n, title, desc, Icon }, i) => (
            <div key={n} className="group relative rounded-2xl glass-panel p-6 transition hover:border-cyan-glow/20">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-2xl font-semibold text-white/10 group-hover:text-cyan-glow/20 transition">{n}</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-glow/10 ring-1 ring-cyan-glow/20">
                  <Icon className="h-4.5 w-4.5 text-cyan-glow" />
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{desc}</p>
              {i < PIPELINE.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 lg:block">
                  <ArrowRight className="h-4 w-4 text-white/10" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="mb-14 text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-glow">Under the hood</span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-100 sm:text-4xl">Built for real fraud patterns</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map(({ title, desc, Icon }) => (
            <div key={title} className="flex gap-4 rounded-2xl glass-panel p-6">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-void-700 ring-1 ring-white/[0.06]">
                <Icon className="h-5 w-5 text-cyan-glow" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-ink-100">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl px-6 pb-28 pt-6 text-center">
        <div className="rounded-3xl glass-panel px-8 py-14 shadow-glow">
          <h2 className="font-display text-2xl font-semibold text-ink-100 sm:text-3xl">Ready to see your risk score?</h2>
          <p className="mx-auto mt-3 max-w-md text-ink-300">
            Registration takes a minute. Full verification — document, face and decision — takes about two.
          </p>
          <Link
            to={user ? "/verify" : "/register"}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-glow px-7 py-3.5 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90"
          >
            {user ? "Start verification" : "Create free account"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
