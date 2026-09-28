import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ScanFace, FileText, Calendar, ArrowRight, Inbox,
  QrCode, ShieldCheck, ShieldAlert, ShieldQuestion,
  Fingerprint, Video, KeyRound,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import TrustGauge from "../components/TrustGauge";
import { LitCard, MaskLines, PageShell, Reveal, SysLabel } from "../components/ui/motion";
import { staggerChild, staggerParent } from "../components/ui/tokens";

/* ------------------------------------------------------------------ */
/* Aadhaar Secure QR + Risk-Based Step-Up — compact summary presenters */
/* Same source fields as the full report page, surfaced here so a     */
/* reviewer doesn't have to open a verification to see them.          */
/* ------------------------------------------------------------------ */

function aadhaarQrSummary(v) {
  if (!v.aadhaar_qr_present) return null;
  if (v.aadhaar_qr_mismatch_flag) {
    return { tone: "bad", label: "QR/OCR mismatch", Icon: ShieldAlert };
  }
  if (v.aadhaar_qr_signature_valid === true) {
    return {
      tone: "good",
      label: v.aadhaar_qr_using_test_cert ? "QR valid (test cert)" : "QR signature valid",
      Icon: ShieldCheck,
    };
  }
  if (v.aadhaar_qr_signature_valid === false) {
    return { tone: "bad", label: "QR signature invalid", Icon: ShieldAlert };
  }
  return { tone: "warn", label: "QR present, unverified", Icon: ShieldQuestion };
}

function stepUpSummary(v) {
  if (!v.step_up_action || v.step_up_action === "none") return null;
  const actionLabel = v.step_up_action === "video_kyc" ? "Video KYC" : v.step_up_action.replaceAll("_", " ");
  const Icon = v.step_up_action === "video_kyc" ? Video : KeyRound;
  if (v.step_up_status === "completed") return { tone: "good", label: `${actionLabel} · done`, Icon };
  if (v.step_up_status === "failed") return { tone: "bad", label: `${actionLabel} · failed`, Icon };
  return { tone: "warn", label: `${actionLabel} · ${v.step_up_status?.replaceAll("_", " ") || "pending"}`, Icon };
}

const TONE = {
  good: { text: "text-signal-emerald", bg: "bg-signal-emerald/10", ring: "ring-signal-emerald/25" },
  warn: { text: "text-signal-amber", bg: "bg-signal-amber/10", ring: "ring-signal-amber/25" },
  bad: { text: "text-signal-crimson", bg: "bg-signal-crimson/10", ring: "ring-signal-crimson/25" },
};

/** Small inline pill used inside each row of the verification list. */
function SignalPill({ tone, label, Icon }) {
  const c = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] ring-1 ring-inset ${c.bg} ${c.ring} ${c.text}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

/** Larger module card used in the "Latest verification" summary rail. */
function ModuleSummaryCard({ title, data, emptyLabel, emptyIcon: EmptyIcon }) {
  const tone = data ? TONE[data.tone] : null;
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
      <p className="eyebrow mb-3">{title}</p>
      {data ? (
        <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${tone.bg}`}>
          <data.Icon className={`h-4 w-4 flex-shrink-0 ${tone.text}`} />
          <span className={`text-sm font-medium ${tone.text}`}>{data.label}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <EmptyIcon className="h-4 w-4 flex-shrink-0 text-ink-500" />
          <span className="text-sm text-ink-500">{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .mine()
      .then((res) => setVerifications(res.data))
      .finally(() => setLoading(false));
  }, []);

  const latest = verifications[0];
  const latestQr = latest ? aadhaarQrSummary(latest) : null;
  const latestStepUp = latest ? stepUpSummary(latest) : null;

  return (
    <PageShell className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 grid-overlay opacity-40" />

      <div className="relative mb-10 flex flex-col items-start justify-between gap-6 sm:mb-14 sm:flex-row sm:items-end">
        <div>
          <SysLabel live>Welcome, {user?.full_name?.split(" ")[0]}</SysLabel>
          <h1 className="mt-4 font-display text-huge font-semibold uppercase text-ink-50">
            <MaskLines lines={["Your identity", <span key="s" className="text-ink-500">status.</span>]} delay={0.1} />
          </h1>
          <p className="mt-4 text-sm text-ink-300">Your identity verification history and current status.</p>
        </div>
        <Link to="/verify" className="btn btn-light">
          <ScanFace className="h-4 w-4" /> New verification
        </Link>
      </div>

      {loading ? (
        <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]" aria-busy="true">
          <div className="skeleton h-[420px] rounded-[1.75rem]" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : verifications.length === 0 ? (
        <div className="glass-panel relative flex flex-col items-center gap-5 overflow-hidden rounded-[1.75rem] px-6 py-20 text-center">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 perspective-grid opacity-50" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
            <Inbox className="h-6 w-6 text-ink-500" />
          </div>
          <div className="relative">
            <p className="font-display text-2xl font-semibold uppercase text-ink-50">No verifications yet</p>
            <p className="mt-2 text-sm text-ink-300">Start your first KYC check to see your risk score here.</p>
          </div>
          <Link to="/verify" className="btn btn-light relative mt-2">
            Start verification <ArrowRight className="btn-arrow h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col gap-5">
            <Reveal className="glass-panel relative flex flex-col items-center overflow-hidden rounded-[1.75rem] px-6 pb-7 pt-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(100,120,255,0.12),transparent_70%)]" />
              <span className="eyebrow relative mb-4">Latest score</span>
              <div className="relative">
                <TrustGauge riskScore={latest.risk_score} band={latest.risk_band} size={210} />
              </div>
              <div className="relative mt-5">
                <StatusBadge status={latest.status} />
              </div>
            </Reveal>

            {/* Aadhaar Secure QR + Risk-Based Step-Up, surfaced right on the dashboard */}
            <Reveal delay={0.08} className="glass-panel flex flex-col gap-3 rounded-[1.75rem] p-4">
              <ModuleSummaryCard
                title="Aadhaar Secure QR"
                data={latestQr}
                emptyLabel="No Aadhaar QR on file"
                emptyIcon={QrCode}
              />
              <ModuleSummaryCard
                title="Risk-Based Step-Up"
                data={latestStepUp}
                emptyLabel="Instant approval — no step-up needed"
                emptyIcon={Fingerprint}
              />
            </Reveal>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between px-1">
              <span className="eyebrow">Verification history</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">{String(verifications.length).padStart(2, "0")} records</span>
            </div>
            <motion.div variants={staggerParent(0.07)} initial="hidden" animate="show" className="space-y-3">
              {verifications.map((v, idx) => {
                const qr = aadhaarQrSummary(v);
                const stepUp = stepUpSummary(v);
                return (
                  <motion.div key={v.id} variants={staggerChild}>
                    <LitCard className="glass-panel group flex flex-col gap-4 rounded-2xl p-4 transition-transform duration-500 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex items-center gap-4">
                        <span className="hidden font-mono text-[11px] text-ink-700 sm:block">{String(idx + 1).padStart(2, "0")}</span>
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                          <FileText className="h-4.5 w-4.5 text-accent-soft" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-base font-semibold capitalize text-ink-50">{v.document_type?.replace("_", " ") || "Document"}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
                            <Calendar className="h-3 w-3" /> {new Date(v.created_at).toLocaleString()}
                          </p>
                          {(qr || stepUp) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {qr && <SignalPill tone={qr.tone} label={qr.label} Icon={qr.Icon} />}
                              {stepUp && <SignalPill tone={stepUp.tone} label={stepUp.label} Icon={stepUp.Icon} />}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-5 border-t border-white/[0.05] pt-3 sm:justify-end sm:border-0 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="font-display text-2xl font-semibold tabular-nums text-ink-50">{v.risk_score?.toFixed(1) ?? "—"}</p>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">risk score</p>
                        </div>
                        <StatusBadge status={v.status} size="sm" />
                        <Link to={`/verification-progress/${v.id}`} className="btn btn-ghost btn-sm">
                          Report <ArrowRight className="btn-arrow h-3 w-3" />
                        </Link>
                      </div>
                    </LitCard>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
