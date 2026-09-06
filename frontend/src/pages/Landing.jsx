import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ScanFrame from "../components/ScanFrame";
import TrustGauge from "../components/TrustGauge";
import {
  ArrowRight, ScanFace, FileSearch, Fingerprint, ShieldAlert,
  Gauge, Landmark, Building2, Wallet, Radio, Sparkles, CheckCircle2,
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

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden">
      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-aurora" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-overlay opacity-40" />

      {/* HERO */}
      <section className="relative mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 pb-24 pt-20 sm:pt-28 lg:flex-row lg:items-center lg:gap-12 lg:pb-32">
        <div className="max-w-xl text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.07] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-soft">
            <Sparkles className="h-3 w-3" />
            AI-powered digital KYC
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-100 sm:text-5xl lg:text-[3.5rem]">
            Verify identity in seconds.
            <br />
            <span className="bg-gradient-to-r from-accent-soft via-accent to-violet bg-clip-text text-transparent">
              Catch fraud before it onboards.
            </span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-ink-300 sm:text-lg">
            Securix replaces manual KYC with document OCR, biometric face matching, liveness
            detection and AI-driven risk scoring — one automated pipeline from upload to decision.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              to={user ? (user.role === "admin" ? "/admin" : "/verify") : "/register"}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-violet px-6 py-3.5 text-sm font-semibold text-white shadow-glow-lg transition hover:brightness-110 sm:w-auto"
            >
              {user ? "Go to console" : "Start verification"}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="w-full rounded-xl border border-white/[0.08] px-6 py-3.5 text-center text-sm font-medium text-ink-300 transition hover:border-white/[0.16] hover:text-ink-100 sm:w-auto"
            >
              I already have an account
            </Link>
          </div>
          <div className="mt-8 flex flex-col items-center gap-2.5 lg:items-start">
            {TRUST_POINTS.map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm text-ink-300">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-signal-emerald" />
                {t}
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-white/[0.06] pt-7 lg:justify-start">
            <span className="w-full text-xs font-medium uppercase tracking-wide text-ink-700 lg:w-auto">Built for</span>
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
          <div className="rounded-2xl glass-panel px-8 py-5">
            <TrustGauge riskScore={18} band="low" size={128} label="Sample trust score" />
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="mb-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-soft">The pipeline</span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-100 sm:text-4xl">Four steps, one decision</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-300">
            Every verification walks the same automated sequence — no step skipped, every signal logged.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map(({ n, title, desc, Icon }, i) => (
            <div key={n} className="group relative rounded-2xl glass-panel p-6 transition hover:-translate-y-1 hover:border-accent/25">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-2xl font-semibold text-white/10 transition group-hover:text-accent/25">{n}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-inset ring-accent/20">
                  <Icon className="h-4.5 w-4.5 text-accent-soft" />
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
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-soft">Under the hood</span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-100 sm:text-4xl">Built for real fraud patterns</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map(({ title, desc, Icon }) => (
            <div key={title} className="flex gap-4 rounded-2xl glass-panel p-6 transition hover:border-white/[0.12]">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-void-700 ring-1 ring-white/[0.06]">
                <Icon className="h-5 w-5 text-accent-soft" />
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
        <div className="relative overflow-hidden rounded-3xl glass-panel px-8 py-14 shadow-soft-lg">
          <div className="pointer-events-none absolute inset-0 bg-aurora opacity-70" />
          <div className="relative">
            <h2 className="font-display text-2xl font-semibold text-ink-100 sm:text-3xl">Ready to see your risk score?</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-300">
              Registration takes a minute. Full verification — document, face and decision — takes about two.
            </p>
            <Link
              to={user ? "/verify" : "/register"}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-violet px-7 py-3.5 text-sm font-semibold text-white shadow-glow-lg transition hover:brightness-110"
            >
              {user ? "Start verification" : "Create free account"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
