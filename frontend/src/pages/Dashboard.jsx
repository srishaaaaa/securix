import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ScanFace, FileText, Calendar, ArrowRight, Inbox,
  QrCode, ShieldCheck, ShieldAlert, ShieldQuestion,
  Fingerprint, Video, KeyRound,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import TrustGauge from "../components/TrustGauge";

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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${c.bg} ${c.ring} ${c.text}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

/** Larger module card used in the "Latest verification" summary rail. */
function ModuleSummaryCard({ title, data, emptyLabel, emptyIcon: EmptyIcon }) {
  const tone = data ? TONE[data.tone] : null;
  return (
    <div className="rounded-xl bg-void-700/60 p-4 ring-1 ring-white/[0.06]">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
        {title}
      </p>
      {data ? (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${tone.bg}`}>
          <data.Icon className={`h-4 w-4 flex-shrink-0 ${tone.text}`} />
          <span className={`text-sm font-medium ${tone.text}`}>{data.label}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-void-600/50 px-3 py-2">
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
    <div className="relative mx-auto max-w-5xl px-6 py-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-aurora opacity-70" />

      <div className="relative mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-100 sm:text-3xl">Welcome, {user?.full_name?.split(" ")[0]}</h1>
          <p className="mt-1.5 text-sm text-ink-300">Your identity verification history and current status.</p>
        </div>
        <Link
          to="/verify"
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
        >
          <ScanFace className="h-4 w-4" /> New verification
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="relative flex flex-col items-center gap-4 rounded-2xl glass-panel py-20 text-center shadow-soft">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-void-700 ring-1 ring-white/[0.06]">
            <Inbox className="h-6 w-6 text-ink-500" />
          </div>
          <div>
            <p className="font-medium text-ink-100">No verifications yet</p>
            <p className="mt-1 text-sm text-ink-300">Start your first KYC check to see your risk score here.</p>
          </div>
          <Link to="/verify" className="mt-2 flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow">
            Start verification <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center rounded-2xl glass-panel p-7 shadow-soft">
              <span className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-500">Latest score</span>
              <TrustGauge riskScore={latest.risk_score} band={latest.risk_band} size={170} />
              <div className="mt-4">
                <StatusBadge status={latest.status} />
              </div>
            </div>

            {/* Aadhaar Secure QR + Risk-Based Step-Up, surfaced right on the dashboard */}
            <div className="flex flex-col gap-3 rounded-2xl glass-panel p-4 shadow-soft">
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
            </div>
          </div>

          <div className="space-y-3">
            {verifications.map((v) => {
              const qr = aadhaarQrSummary(v);
              const stepUp = stepUpSummary(v);
              return (
                <div key={v.id} className="flex flex-col gap-3 rounded-xl glass-panel p-5 shadow-soft transition hover:border-white/[0.12] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-void-700 ring-1 ring-white/[0.06]">
                      <FileText className="h-4.5 w-4.5 text-accent-soft" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize text-ink-100">{v.document_type?.replace("_", " ") || "Document"}</p>
                      <p className="flex items-center gap-1.5 text-xs text-ink-500">
                        <Calendar className="h-3 w-3" /> {new Date(v.created_at).toLocaleString()}
                      </p>
                      {(qr || stepUp) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {qr && <SignalPill tone={qr.tone} label={qr.label} Icon={qr.Icon} />}
                          {stepUp && <SignalPill tone={stepUp.tone} label={stepUp.label} Icon={stepUp.Icon} />}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="font-display text-sm font-semibold text-ink-100">{v.risk_score?.toFixed(1) ?? "—"}</p>
                      <p className="text-[10px] uppercase tracking-wide text-ink-500">risk score</p>
                    </div>
                    <StatusBadge status={v.status} size="sm" />
                    <Link
                      to={`/verification-progress/${v.id}`}
                      className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-accent/40 hover:text-accent-soft"
                    >
                      Report <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
