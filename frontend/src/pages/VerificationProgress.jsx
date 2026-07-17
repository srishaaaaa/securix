import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, ScanText, ShieldCheck, UserCheck, Camera, Gauge,
  ChevronDown, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  Download, ArrowLeft, Loader2, QrCode, Video,
} from "lucide-react";
import { api } from "../api/client";

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function StatusPill({ state }) {
  // state: "good" | "warn" | "bad" | "na"
  const map = {
    good: { label: "Passed", cls: "bg-emerald-50 text-emerald-600 ring-emerald-200", Icon: CheckCircle2 },
    warn: { label: "Review", cls: "bg-amber-50 text-amber-600 ring-amber-200", Icon: AlertTriangle },
    bad: { label: "Failed", cls: "bg-rose-50 text-rose-600 ring-rose-200", Icon: XCircle },
    na: { label: "N/A", cls: "bg-slate-50 text-slate-400 ring-slate-200", Icon: MinusCircle },
  };
  const { label, cls, Icon } = map[state] || map.na;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3">
      <p className={`text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function Bar({ value = 0, colorClass = "bg-blue-500" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className={`h-full rounded-full ${colorClass}`}
      />
    </div>
  );
}

function NotAvailableList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Not implemented in this build
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {items.map((i) => i.replaceAll("_", " ")).join(", ")} — these need external
        data/models (deepfake classifiers, geo-IP, specimen signatures, etc.) not
        available in this demo, so no score is fabricated for them.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expandable module card                                              */
/* ------------------------------------------------------------------ */

function ModuleCard({ icon: Icon, title, description, state, summary, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/60 sm:px-6 sm:py-5"
      >
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <StatusPill state={state} />
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{description}</p>
        </div>
        {summary && <div className="hidden flex-shrink-0 text-right sm:block">{summary}</div>}
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-5 pb-6 pt-5 sm:px-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function VerificationProgress() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getFullReport(id)
      .then((res) => setReport(res.data))
      .catch((err) => setError(err?.response?.data?.detail || "Could not load this verification report."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 bg-white text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-slate-600">{error || "Report unavailable."}</p>
        <Link to="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { document_upload, ocr, forgery, face, liveness, risk, aadhaar_qr, step_up } = report;

  const modulesState = {
    upload: document_upload.quality?.quality_score >= 70 ? "good" : document_upload.quality?.quality_score > 0 ? "warn" : "bad",
    ocr: ocr.ocr_confidence >= 70 && ocr.format_valid ? "good" : ocr.ocr_confidence >= 40 ? "warn" : "bad",
    forgery: forgery.authenticity_verdict === "Authentic" ? "good" : forgery.authenticity_verdict === "Suspicious" ? "warn" : "bad",
    face: face.face_detected ? (face.matched ? "good" : "bad") : "na",
    liveness: liveness.liveness_score >= 60 ? "good" : liveness.liveness_score > 0 ? "warn" : "na",
    risk: risk.risk_band === "low" ? "good" : risk.risk_band === "medium" ? "warn" : risk.risk_band ? "bad" : "na",
    aadhaarQr: !aadhaar_qr ? "na" : !aadhaar_qr.qr_present ? "na" : aadhaar_qr.signature_valid ? "good" : "bad",
    stepUp: !step_up || step_up.action === "none" ? "na" : step_up.status === "completed" ? "good" : step_up.status === "failed" ? "bad" : "warn",
  };
  const completedCount = Object.values(modulesState).filter((s) => s !== "na").length;
  const progressPct = Math.round((completedCount / 6) * 100);

  const riskColor = risk.risk_band === "low" ? "text-emerald-600" : risk.risk_band === "medium" ? "text-amber-600" : "text-rose-600";
  const riskBarColor = risk.risk_band === "low" ? "bg-emerald-500" : risk.risk_band === "medium" ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
      {/* header */}
      <div className="border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Verification Progress</h1>
              <p className="mt-1.5 text-sm text-slate-500">Track your KYC verification steps</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <motion.circle
                    cx="32" cy="32" r="27" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 27}
                    initial={{ strokeDashoffset: 2 * Math.PI * 27 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 27 * (1 - progressPct / 100) }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700">
                  {progressPct}%
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
              >
                <Download className="h-4 w-4" /> Download report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        {/* 1. Document Upload */}
        <ModuleCard
          icon={Upload}
          title="Document Upload"
          description="Upload quality & format checks"
          state={modulesState.upload}
          summary={<span className="text-sm font-semibold text-slate-700">{document_upload.quality?.quality_score ?? "—"}%</span>}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Document type" value={document_upload.document_type?.replace("_", " ")} />
            <Stat label="Resolution" value={document_upload.quality?.resolution_ok ? "OK" : "Low"} />
            <Stat label="Sharpness" value={document_upload.quality?.blur_ok ? "OK" : "Blurry"} />
            <Stat label="Lighting" value={document_upload.quality?.brightness_ok ? "OK" : "Poor"} />
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>Quality score</span><span>{document_upload.quality?.quality_score ?? 0}%</span>
            </div>
            <Bar value={document_upload.quality?.quality_score ?? 0} />
          </div>
          {document_upload.quality?.issues?.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-amber-600">
              {document_upload.quality.issues.map((iss, i) => <li key={i}>• {iss}</li>)}
            </ul>
          )}
        </ModuleCard>

        {/* 2. OCR Text Extraction */}
        <ModuleCard
          icon={ScanText}
          title="OCR Text Extraction"
          description="AI-extracted document fields"
          state={modulesState.ocr}
          summary={<span className="text-sm font-semibold text-slate-700">{ocr.ocr_confidence?.toFixed(0)}% conf.</span>}
        >
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              ["Full name", ocr.fields.full_name],
              ["Date of birth", ocr.fields.date_of_birth],
              ["Document number", ocr.fields.document_number],
              ["Address", ocr.fields.address],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs text-slate-400">{label}</span>
                <span className={`text-sm font-medium ${value ? "text-slate-700" : "text-rose-500"}`}>{value || "Not found"}</span>
              </div>
            ))}
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="OCR confidence" value={`${ocr.ocr_confidence?.toFixed(1)}%`} />
            <Stat label="Format valid" value={ocr.format_valid ? "Yes" : "No"} />
          </div>
          {ocr.missing_fields.length > 0 && (
            <p className="mt-3 text-xs text-amber-600">
              Unreadable/missing fields: {ocr.missing_fields.map((f) => f.replaceAll("_", " ")).join(", ")}
            </p>
          )}
        </ModuleCard>

        {/* 3. AI Forgery Detection */}
        <ModuleCard
          icon={ShieldCheck}
          title="AI Forgery Detection"
          description="Tamper, copy-move & metadata analysis"
          state={modulesState.forgery}
          summary={<span className="text-sm font-semibold text-slate-700">{forgery.authenticity_verdict}</span>}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Forgery risk" value={`${forgery.forgery_score}%`} />
            <Stat label="Copy-move" value={`${forgery.copy_move?.copy_move_score ?? 0}%`} />
            <Stat label="QR code" value={forgery.qr?.qr_present ? (forgery.qr.qr_valid ? "Valid" : "Unreadable") : "None found"} />
            <Stat label="EXIF metadata" value={forgery.metadata?.exif_present ? "Present" : "Stripped"} />
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>Forgery risk score</span><span>{forgery.forgery_score}%</span>
            </div>
            <Bar value={forgery.forgery_score} colorClass={forgery.forgery_score >= 60 ? "bg-rose-500" : forgery.forgery_score >= 30 ? "bg-amber-500" : "bg-emerald-500"} />
          </div>
          {forgery.heatmap_png_base64 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Compression-error heatmap (brighter = more suspicious)</p>
              <img
                src={`data:image/png;base64,${forgery.heatmap_png_base64}`}
                alt="Forgery heatmap"
                className="max-h-56 w-full rounded-xl border border-slate-200 object-contain bg-slate-900"
              />
            </div>
          )}
          {forgery.indicators?.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-amber-600">
              {forgery.indicators.map((ind, i) => <li key={i}>• {ind}</li>)}
            </ul>
          )}
          <NotAvailableList items={forgery.not_available} />
        </ModuleCard>

        {/* 3b. Aadhaar Secure QR verification (only for Aadhaar documents) */}
        {aadhaar_qr && (
          <ModuleCard
            icon={QrCode}
            title="Aadhaar Secure QR Verification"
            description="UIDAI-signed QR: cryptographic authenticity check"
            state={modulesState.aadhaarQr}
            summary={
              <span className="text-sm font-semibold text-slate-700">
                {!aadhaar_qr.qr_present ? "No QR found" : aadhaar_qr.signature_valid ? "Signature valid" : "Signature invalid"}
              </span>
            }
          >
            {aadhaar_qr.qr_present ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="QR decoded" value={aadhaar_qr.signature_valid !== null ? "Yes" : "No"} />
                  <Stat label="Signature" value={aadhaar_qr.signature_valid ? "Valid" : "Invalid"} />
                  <Stat label="Certificate" value={aadhaar_qr.using_test_certificate ? "Test cert" : "UIDAI (production)"} />
                  <Stat label="Name (from QR)" value={aadhaar_qr.fields?.name} />
                  <Stat label="DOB (from QR)" value={aadhaar_qr.fields?.dob} />
                  <Stat label="Field match vs OCR" value={aadhaar_qr.mismatch_flag ? "Mismatch" : "Consistent"} />
                </div>
                {aadhaar_qr.using_test_certificate && (
                  <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-700">
                    Verifying against a locally-generated TEST certificate, not UIDAI's real signing key (unreachable
                    from this environment). A real Aadhaar QR will correctly show "Signature invalid" here until
                    UIDAI's actual certificate is dropped into <code>backend/certs/uidai_cert.pem</code> - see{" "}
                    <code>backend/certs/README.md</code>.
                  </div>
                )}
                {aadhaar_qr.mismatch_flag && (
                  <p className="mt-3 text-xs text-rose-600">
                    The QR's signed demographic data disagrees with what OCR read off the printed card - a strong
                    forgery signal (e.g. a genuine QR reused on an altered card).
                  </p>
                )}
                {aadhaar_qr.notes?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {aadhaar_qr.notes.map((n, i) => n && <li key={i}>• {n}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">
                No decodable Secure QR code was found on this document (missing, unreadable, or not an Aadhaar card).
              </p>
            )}
          </ModuleCard>
        )}

        {/* 4. Face Matching */}
        <ModuleCard
          icon={UserCheck}
          title="Face Matching"
          description="Selfie vs. document photo comparison"
          state={modulesState.face}
          summary={<span className="text-sm font-semibold text-slate-700">{face.similarity_percent}%</span>}
        >
          {face.face_detected ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Similarity" value={`${face.similarity_percent}%`} />
                <Stat label="Result" value={face.matched ? "Matched" : "Not matched"} />
                <Stat label="Distance (proxy)" value={face.embedding_distance_proxy} mono />
                <Stat label="Selfie quality" value={`${face.selfie_quality?.quality_score ?? 0}%`} />
                <Stat label="Doc photo quality" value={`${face.document_photo_quality?.quality_score ?? 0}%`} />
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                  <span>Face similarity</span><span>{face.similarity_percent}%</span>
                </div>
                <Bar value={face.similarity_percent} colorClass={face.matched ? "bg-emerald-500" : "bg-rose-500"} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">No face verification captured for this document yet.</p>
          )}
          <NotAvailableList items={face.not_available} />
        </ModuleCard>

        {/* 5. AI Liveness Detection */}
        <ModuleCard
          icon={Camera}
          title="AI Liveness Detection"
          description="Confirms a live person, not a photo/replay"
          state={modulesState.liveness}
          summary={<span className="text-sm font-semibold text-slate-700">{liveness.liveness_score}%</span>}
        >
          <div className="mb-1.5 flex justify-between text-xs text-slate-500">
            <span>Liveness score</span><span>{liveness.liveness_score}%</span>
          </div>
          <Bar value={liveness.liveness_score} colorClass={liveness.liveness_score >= 60 ? "bg-emerald-500" : "bg-amber-500"} />
          <div className="mt-4 flex flex-wrap gap-2">
            {["image_sharpness", "natural_motion", "eye_blink_variation"].map((chk) => {
              const passed = liveness.checks_passed?.includes(chk);
              return (
                <span
                  key={chk}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                    passed ? "bg-emerald-50 text-emerald-600 ring-emerald-200" : "bg-slate-50 text-slate-400 ring-slate-200"
                  }`}
                >
                  {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <MinusCircle className="h-3.5 w-3.5" />}
                  {chk.replaceAll("_", " ")}
                </span>
              );
            })}
          </div>
          {liveness.challenge?.challenge_type && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Challenge: {liveness.challenge.challenge_type.replaceAll("_", " ")}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    liveness.challenge.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {liveness.challenge.passed ? "Passed" : "Failed"}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{liveness.challenge.detail}</p>
            </div>
          )}
          <NotAvailableList items={liveness.not_available} />
        </ModuleCard>

        {/* 6. AI Risk Assessment */}
        <ModuleCard
          icon={Gauge}
          title="AI Risk Assessment"
          description="Composite fraud risk score & recommendation"
          state={modulesState.risk}
          defaultOpen
          summary={<span className={`text-sm font-semibold ${riskColor}`}>{risk.risk_score ?? "—"} · {risk.risk_band ?? "n/a"}</span>}
        >
          <div className="mb-1.5 flex justify-between text-xs text-slate-500">
            <span>Overall risk score</span><span className={riskColor}>{risk.risk_score ?? "—"} / 100</span>
          </div>
          <Bar value={risk.risk_score ?? 0} colorClass={riskBarColor} />

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="OCR confidence" value={risk.factors.ocr_confidence?.toFixed(0)} />
            <Stat label="Forgery score" value={risk.factors.forgery_score} />
            <Stat label="Face match" value={risk.factors.face_match_score?.toFixed(0)} />
            <Stat label="Liveness" value={risk.factors.liveness_score?.toFixed(0)} />
            <Stat label="24h velocity" value={risk.factors.velocity_last_24h} />
            <Stat label="Prior flags" value={risk.factors.prior_flagged_verifications} />
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Recommendation</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                risk.status === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : risk.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {risk.status === "approved" ? "Approve" : risk.status === "rejected" ? "Reject" : "Manual review"}
            </span>
          </div>
          {risk.device_and_geo && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Location" value={risk.device_and_geo.geo_city || "Unknown"} />
              <Stat label="Device" value={risk.device_and_geo.device_id_hash ? risk.device_and_geo.device_id_hash.slice(0, 8) : "—"} />
              <Stat
                label="Travel check"
                value={risk.device_and_geo.travel_flag ? "Impossible travel" : "Normal"}
              />
            </div>
          )}

          {risk.fraud_network && (
            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Fraud network</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  risk.fraud_network.flagged ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {risk.fraud_network.flagged ? `${risk.fraud_network.linked_count} linked identities` : "Clean"}
              </span>
            </div>
          )}

          {risk.trust_engine && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Digital identity trust score</h4>
                <span
                  className={`font-display text-2xl font-bold ${
                    risk.trust_engine.trust_score >= 70
                      ? "text-emerald-600"
                      : risk.trust_engine.trust_score >= 40
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {Math.round(risk.trust_engine.trust_score)}
                  <span className="text-sm font-normal text-slate-400">/100</span>
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {risk.trust_engine.breakdown.map((rule, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{rule.label}</span>
                    <span className={rule.delta < 0 ? "font-mono font-semibold text-rose-600" : "font-mono text-slate-400"}>
                      {rule.delta === 0 ? "—" : rule.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <NotAvailableList items={risk.not_available} />
        </ModuleCard>

        {/* 7. Risk-based step-up flow */}
        {step_up && (
          <ModuleCard
            icon={step_up.action === "video_kyc" ? Video : Gauge}
            title="Risk-Based Step-Up"
            description="Routes each verification to the right amount of friction"
            state={modulesState.stepUp}
            defaultOpen={step_up.action !== "none"}
            summary={
              <span className="text-sm font-semibold text-slate-700 capitalize">
                {step_up.action === "none" ? "Instant approval" : `${step_up.action.replaceAll("_", " ")} · ${step_up.status.replaceAll("_", " ")}`}
              </span>
            }
          >
            <p className="text-sm text-slate-500">{step_up.reason}</p>
            {step_up.action !== "none" && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Action" value={step_up.action.replaceAll("_", " ")} />
                <Stat label="Status" value={step_up.status.replaceAll("_", " ")} />
                <Stat label="Method" value={step_up.method || "—"} />
                {step_up.action === "video_kyc" && (
                  <Stat label="Queue status" value={step_up.video_kyc_queue_status?.replaceAll("_", " ") || "not queued yet"} />
                )}
              </div>
            )}
            {step_up.action === "second_factor" && step_up.status === "pending" && (
              <p className="mt-4 text-xs text-amber-600">
                This verification needs a second factor (OTP or a repeat selfie) before it can be approved -
                complete it from the verification flow.
              </p>
            )}
            {step_up.action === "video_kyc" && step_up.status !== "completed" && (
              <p className="mt-4 text-xs text-amber-600">
                Routed to a live video-KYC call with a human agent instead of an automatic rejection - queue and
                completion are managed from the admin console.
              </p>
            )}
          </ModuleCard>
        )}
      </div>
    </div>
  );
}
