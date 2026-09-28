import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, ScanText, ShieldCheck, UserCheck, Camera, Gauge,
  ChevronDown, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  Download, ArrowLeft, Loader2, QrCode, Video, MapPin, Network, Sparkles, Gavel, Maximize2, X,
} from "lucide-react";
import { api } from "../api/client";
import { MaskLines, PageShell, SysLabel } from "../components/ui/motion";

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

const STATE_MAP = {
  good: { label: "Pass", cls: "bg-signal-emerald/10 text-signal-emerald ring-signal-emerald/30", dot: "bg-signal-emerald", Icon: CheckCircle2 },
  warn: { label: "Warning", cls: "bg-signal-amber/10 text-signal-amber ring-signal-amber/30", dot: "bg-signal-amber", Icon: AlertTriangle },
  bad: { label: "Fail", cls: "bg-signal-crimson/10 text-signal-crimson ring-signal-crimson/30", dot: "bg-signal-crimson", Icon: XCircle },
  na: { label: "Not available", cls: "bg-white/[0.04] text-ink-500 ring-white/[0.1]", dot: "bg-ink-700", Icon: MinusCircle },
};

function StatusPill({ state }) {
  // state: "good" | "warn" | "bad" | "na"
  const { label, cls, Icon } = STATE_MAP[state] || STATE_MAP.na;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] ring-1 ring-inset ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
      <p className={`text-sm font-semibold capitalize text-ink-50 ${mono ? "font-mono normal-case" : ""}`}>{value ?? "—"}</p>
      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
    </div>
  );
}

function Bar({ value = 0, colorClass = "bg-accent" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full ${colorClass}`}
      />
    </div>
  );
}

function Meter({ label, value, display, colorClass }) {
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
        <span>{label}</span>
        <span className="text-ink-100">{display ?? `${value}%`}</span>
      </div>
      <Bar value={value} colorClass={colorClass} />
    </div>
  );
}

function NotAvailableList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.015] px-4 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">Not implemented in this build</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        {items.map((i) => i.replaceAll("_", " ")).join(", ")} — these need external
        data/models (deepfake classifiers, geo-IP, specimen signatures, etc.) not
        available in this demo, so no score is fabricated for them.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline module (expandable)                                        */
/* ------------------------------------------------------------------ */

function ModuleCard({ index, icon: Icon, title, description, state, summary, defaultOpen, children, last }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const st = STATE_MAP[state] || STATE_MAP.na;
  return (
    <motion.li
      initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative grid grid-cols-[28px_1fr] gap-3 sm:grid-cols-[56px_1fr] sm:gap-5"
    >
      {/* timeline rail */}
      <div className="relative flex justify-center">
        {!last && <span className="absolute bottom-[-20px] top-8 w-px bg-gradient-to-b from-white/15 to-white/[0.04]" />}
        <span className="relative mt-5 flex h-3 w-3 items-center justify-center">
          <span className={`absolute h-3 w-3 rounded-full ${st.dot} opacity-30`} />
          <span className={`relative h-1.5 w-1.5 rounded-full ${st.dot}`} />
        </span>
      </div>

      <div className="glass-panel overflow-hidden rounded-[1.4rem]">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.02] sm:gap-4 sm:px-6 sm:py-5"
        >
          <span className="hidden font-mono text-[11px] text-ink-700 sm:block">{String(index).padStart(2, "0")}</span>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
            <Icon className="h-4.5 w-4.5 text-accent-soft" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink-50 sm:text-lg">{title}</h3>
              <StatusPill state={state} />
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-500">{description}</p>
          </div>
          {summary && <div className="hidden flex-shrink-0 text-right md:block">{summary}</div>}
          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-ink-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/[0.06] px-4 pb-6 pt-5 sm:px-6">
                {summary && <div className="mb-4 md:hidden">{summary}</div>}
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* Forensic image analysis (ELA heatmap)                               */
/* ------------------------------------------------------------------ */

const FORENSIC_TABS = ["ELA", "EXIF", "Copy-move", "QR", "Authenticity", "Forgery"];

function ForensicRows({ rows, notes }) {
  return (
    <div className="p-4">
      <dl className="divide-y divide-white/[0.05]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{k}</dt>
            <dd className="truncate text-right font-mono text-ink-100">{String(v)}</dd>
          </div>
        ))}
      </dl>
      {notes?.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-signal-amber">
          {notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  );
}

function ForensicPanel({ forgery }) {
  const [zoom, setZoom] = useState(false);
  const [tab, setTab] = useState("ELA");

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const src = `data:image/png;base64,${forgery.heatmap_png_base64}`;
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-void-950/60">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <SysLabel>Forensic image analysis</SysLabel>
        <button onClick={() => setZoom(true)} className="btn btn-ghost btn-sm !py-1.5">
          <Maximize2 className="h-3.5 w-3.5" /> Expand
        </button>
      </div>
      {/* forensic tabs */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2" role="tablist" aria-label="Forensic analysis">
        {FORENSIC_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`relative whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] transition-colors ${
              tab === t ? "text-void-900" : "text-ink-500 hover:text-ink-100"
            }`}
          >
            {tab === t && <motion.span layoutId={`ftab-${forgery.forgery_score}`} className="absolute inset-0 rounded-full bg-ink-50" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
          transition={{ duration: 0.25 }}
        >
          {tab === "ELA" && (
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr]">
              <button onClick={() => setZoom(true)} className="group relative block overflow-hidden bg-black" aria-label="Expand forgery heatmap">
                <img src={src} alt="Forgery heatmap" className="max-h-72 w-full object-contain transition duration-700 group-hover:scale-[1.03]" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-6 text-left text-[11px] text-[#c9cedb]">
                  Compression-error heatmap (brighter = more suspicious)
                </span>
              </button>
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">Error level scale</p>
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,#00007f,#0000ff,#00ffff,#ffff00,#ff0000,#7f0000)]" />
                  <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-ink-700">
                    <span>consistent</span>
                    <span>suspicious</span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  Error-level analysis re-compresses the image and maps where the error differs — edited regions tend to
                  carry a different compression history than the rest of the document.
                </p>
              </div>
            </div>
          )}

          {tab === "EXIF" && (
            <ForensicRows
              rows={[
                ["EXIF metadata", forgery.metadata?.exif_present ? "Present" : "Stripped"],
                ["Software tag", forgery.metadata?.software_tag || "—"],
              ]}
              notes={forgery.metadata?.indicators}
            />
          )}

          {tab === "Copy-move" && (
            <ForensicRows
              rows={[
                ["Copy-move score", `${forgery.copy_move?.copy_move_score ?? 0}%`],
                ["Duplicate regions", forgery.copy_move?.duplicate_regions ?? "—"],
              ]}
              notes={forgery.copy_move?.note ? [forgery.copy_move.note] : []}
            />
          )}

          {tab === "QR" && (
            <ForensicRows
              rows={[
                ["QR code", forgery.qr?.qr_present ? (forgery.qr.qr_valid ? "Valid" : "Unreadable") : "None found"],
                ["Decoded length", forgery.qr?.qr_data_length ?? "—"],
              ]}
            />
          )}

          {tab === "Authenticity" && (
            <ForensicRows rows={[["Verdict", forgery.authenticity_verdict || "—"]]} notes={forgery.indicators} />
          )}

          {tab === "Forgery" && (
            <div className="space-y-4 p-4">
              <Meter
                label="Forgery risk score"
                value={forgery.forgery_score}
                colorClass={forgery.forgery_score >= 60 ? "bg-signal-crimson" : forgery.forgery_score >= 30 ? "bg-signal-amber" : "bg-signal-emerald"}
              />
              {forgery.breakdown && Object.keys(forgery.breakdown).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(forgery.breakdown).map(([k, v]) => (
                    <Meter
                      key={k}
                      label={k.replaceAll("_", " ")}
                      value={Math.round(v * 100)}
                      colorClass={v >= 0.6 ? "bg-signal-crimson" : v >= 0.3 ? "bg-signal-amber" : "bg-accent-soft"}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {createPortal(
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-void-950/80 p-4 backdrop-blur-xl"
            onClick={() => setZoom(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Forgery heatmap"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="relative max-h-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={src} alt="Forgery heatmap, enlarged" className="max-h-[82vh] w-full object-contain" />
              <button onClick={() => setZoom(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-void-900/80 text-ink-100 backdrop-blur" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
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
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent-soft" />
        <SysLabel live>Assembling forensic report</SysLabel>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-signal-amber/30 bg-signal-amber/10">
          <AlertTriangle className="h-6 w-6 text-signal-amber" />
        </div>
        <p className="text-ink-300">{error || "Report unavailable."}</p>
        <Link to="/dashboard" className="btn btn-ghost btn-sm">
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
  const totalModules = Object.keys(modulesState).length;
  const progressPct = Math.round((completedCount / totalModules) * 100);

  const riskColor = risk.risk_band === "low" ? "text-signal-emerald" : risk.risk_band === "medium" ? "text-signal-amber" : "text-signal-crimson";
  const riskBarColor = risk.risk_band === "low" ? "bg-signal-emerald" : risk.risk_band === "medium" ? "bg-signal-amber" : "bg-signal-crimson";

  // presentation-only states for the split-out timeline nodes (not part of progressPct)
  const deviceState = !risk.device_and_geo ? "na" : risk.device_and_geo.travel_flag ? "bad" : "good";
  const networkState = !risk.fraud_network ? "na" : risk.fraud_network.flagged ? "bad" : "good";
  const trustState = !risk.trust_engine ? "na" : risk.trust_engine.trust_score >= 70 ? "good" : risk.trust_engine.trust_score >= 40 ? "warn" : "bad";
  const decisionState = risk.status === "approved" ? "good" : risk.status === "rejected" ? "bad" : "warn";

  let n = 0;
  const idx = () => ++n;

  return (
    <PageShell className="relative min-h-screen pb-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 grid-overlay opacity-40" />

      {/* header */}
      <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-8 sm:pt-12">
        <Link to="/dashboard" className="no-print mb-8 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-ink-100">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <SysLabel>Forensic report · <span className="text-ink-500">{String(id).slice(0, 8)}</span></SysLabel>
            <h1 className="mt-4 font-display text-huge font-semibold uppercase text-ink-50">
              <MaskLines lines={["Verification", <span key="p" className="text-ink-500">progress.</span>]} delay={0.1} />
            </h1>
            <p className="mt-4 text-sm text-ink-300">Every module's output, in one audited report.</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(16,20,40,0.07)" strokeWidth="4" />
                <motion.circle
                  cx="32" cy="32" r="27" fill="none" stroke="#3d3dff" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 27}
                  initial={{ strokeDashoffset: 2 * Math.PI * 27 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 27 * (1 - progressPct / 100) }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-lg font-semibold text-ink-50">{progressPct}%</span>
                <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-ink-500">modules</span>
              </span>
            </div>
            <button onClick={() => window.print()} className="no-print btn btn-light">
              <Download className="h-4 w-4" /> Download report
            </button>
          </div>
        </div>
      </div>

      <ol className="relative mx-auto max-w-5xl space-y-5 px-4 sm:px-8">
        {/* 1. Document Upload */}
        <ModuleCard
          index={idx()}
          icon={Upload}
          title="Document Upload"
          description="Upload quality & format checks"
          state={modulesState.upload}
          summary={<span className="font-display text-lg font-semibold text-ink-50">{document_upload.quality?.quality_score ?? "—"}%</span>}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Document type" value={document_upload.document_type?.replace("_", " ")} />
            <Stat label="Resolution" value={document_upload.quality?.resolution_ok ? "OK" : "Low"} />
            <Stat label="Sharpness" value={document_upload.quality?.blur_ok ? "OK" : "Blurry"} />
            <Stat label="Lighting" value={document_upload.quality?.brightness_ok ? "OK" : "Poor"} />
          </div>
          <div className="mt-5">
            <Meter label="Quality score" value={document_upload.quality?.quality_score ?? 0} />
          </div>
          {document_upload.quality?.issues?.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-signal-amber">
              {document_upload.quality.issues.map((iss, i) => <li key={i}>• {iss}</li>)}
            </ul>
          )}
        </ModuleCard>

        {/* 2. OCR Text Extraction */}
        <ModuleCard
          index={idx()}
          icon={ScanText}
          title="OCR Text Extraction"
          description="AI-extracted document fields"
          state={modulesState.ocr}
          summary={<span className="font-display text-lg font-semibold text-ink-50">{ocr.ocr_confidence?.toFixed(0)}% <span className="text-xs text-ink-500">conf.</span></span>}
        >
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ["Full name", ocr.fields.full_name],
              ["Date of birth", ocr.fields.date_of_birth],
              ["Document number", ocr.fields.document_number],
              ["Address", ocr.fields.address],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
                <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">{label}</dt>
                <dd className={`text-right text-sm font-medium ${value ? "text-ink-50" : "text-signal-crimson"}`}>{value || "Not found"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Stat label="OCR confidence" value={`${ocr.ocr_confidence?.toFixed(1)}%`} />
            <Stat label="Format valid" value={ocr.format_valid ? "Yes" : "No"} />
          </div>
          {ocr.missing_fields.length > 0 && (
            <p className="mt-3 text-xs text-signal-amber">
              Unreadable/missing fields: {ocr.missing_fields.map((f) => f.replaceAll("_", " ")).join(", ")}
            </p>
          )}
        </ModuleCard>

        {/* 3. AI Forgery Detection */}
        <ModuleCard
          index={idx()}
          icon={ShieldCheck}
          title="AI Forgery Detection"
          description="Tamper, copy-move & metadata analysis"
          state={modulesState.forgery}
          summary={<span className="font-display text-lg font-semibold text-ink-50">{forgery.authenticity_verdict}</span>}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Forgery risk" value={`${forgery.forgery_score}%`} />
            <Stat label="Copy-move" value={`${forgery.copy_move?.copy_move_score ?? 0}%`} />
            <Stat label="QR code" value={forgery.qr?.qr_present ? (forgery.qr.qr_valid ? "Valid" : "Unreadable") : "None found"} />
            <Stat label="EXIF metadata" value={forgery.metadata?.exif_present ? "Present" : "Stripped"} />
          </div>
          <div className="mt-5">
            <Meter
              label="Forgery risk score"
              value={forgery.forgery_score}
              colorClass={forgery.forgery_score >= 60 ? "bg-signal-crimson" : forgery.forgery_score >= 30 ? "bg-signal-amber" : "bg-signal-emerald"}
            />
          </div>
          {forgery.heatmap_png_base64 && <ForensicPanel forgery={forgery} />}
          {forgery.indicators?.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-signal-amber">
              {forgery.indicators.map((ind, i) => <li key={i}>• {ind}</li>)}
            </ul>
          )}
          <NotAvailableList items={forgery.not_available} />
        </ModuleCard>

        {/* 3b. Aadhaar Secure QR verification (only for Aadhaar documents) */}
        {aadhaar_qr && (
          <ModuleCard
            index={idx()}
            icon={QrCode}
            title="Aadhaar Secure QR Verification"
            description="UIDAI-signed QR: cryptographic authenticity check"
            state={modulesState.aadhaarQr}
            summary={
              <span className="font-display text-sm font-semibold text-ink-50">
                {!aadhaar_qr.qr_present ? "No QR found" : aadhaar_qr.signature_valid ? "Signature valid" : "Signature invalid"}
              </span>
            }
          >
            {aadhaar_qr.qr_present ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Stat label="QR decoded" value={aadhaar_qr.signature_valid !== null ? "Yes" : "No"} />
                  <Stat label="Signature" value={aadhaar_qr.signature_valid ? "Valid" : "Invalid"} />
                  <Stat label="Certificate" value={aadhaar_qr.using_test_certificate ? "Test cert" : "UIDAI (production)"} />
                  <Stat label="Name (from QR)" value={aadhaar_qr.fields?.name} />
                  <Stat label="DOB (from QR)" value={aadhaar_qr.fields?.dob} />
                  <Stat label="Field match vs OCR" value={aadhaar_qr.mismatch_flag ? "Mismatch" : "Consistent"} />
                </div>
                {aadhaar_qr.using_test_certificate && (
                  <div className="mt-4 rounded-2xl border border-dashed border-signal-amber/25 bg-signal-amber/[0.05] px-4 py-3 text-xs text-signal-amber">
                    Verifying against a locally-generated TEST certificate, not UIDAI's real signing key (unreachable
                    from this environment). A real Aadhaar QR will correctly show "Signature invalid" here until
                    UIDAI's actual certificate is dropped into <code>backend/certs/uidai_cert.pem</code> - see{" "}
                    <code>backend/certs/README.md</code>.
                  </div>
                )}
                {aadhaar_qr.mismatch_flag && (
                  <p className="mt-3 text-xs text-signal-crimson">
                    The QR's signed demographic data disagrees with what OCR read off the printed card - a strong
                    forgery signal (e.g. a genuine QR reused on an altered card).
                  </p>
                )}
                {aadhaar_qr.notes?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-ink-500">
                    {aadhaar_qr.notes.map((note, i) => note && <li key={i}>• {note}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-500">
                No decodable Secure QR code was found on this document (missing, unreadable, or not an Aadhaar card).
              </p>
            )}
          </ModuleCard>
        )}

        {/* 4. Face Matching */}
        <ModuleCard
          index={idx()}
          icon={UserCheck}
          title="Face Matching"
          description="Selfie vs. document photo comparison"
          state={modulesState.face}
          summary={<span className="font-display text-lg font-semibold text-ink-50">{face.similarity_percent}%</span>}
        >
          {face.face_detected ? (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Stat label="Similarity" value={`${face.similarity_percent}%`} />
                <Stat label="Result" value={face.matched ? "Matched" : "Not matched"} />
                <Stat label="Distance (proxy)" value={face.embedding_distance_proxy} mono />
                <Stat label="Selfie quality" value={`${face.selfie_quality?.quality_score ?? 0}%`} />
                <Stat label="Doc photo quality" value={`${face.document_photo_quality?.quality_score ?? 0}%`} />
              </div>
              <div className="mt-5">
                <Meter label="Face similarity" value={face.similarity_percent} colorClass={face.matched ? "bg-signal-emerald" : "bg-signal-crimson"} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-500">No face verification captured for this document yet.</p>
          )}
          <NotAvailableList items={face.not_available} />
        </ModuleCard>

        {/* 5. AI Liveness Detection */}
        <ModuleCard
          index={idx()}
          icon={Camera}
          title="AI Liveness Detection"
          description="Confirms a live person, not a photo/replay"
          state={modulesState.liveness}
          summary={<span className="font-display text-lg font-semibold text-ink-50">{liveness.liveness_score}%</span>}
        >
          <Meter label="Liveness score" value={liveness.liveness_score} colorClass={liveness.liveness_score >= 60 ? "bg-signal-emerald" : "bg-signal-amber"} />
          <div className="mt-4 flex flex-wrap gap-2">
            {["image_sharpness", "natural_motion", "eye_blink_variation"].map((chk) => {
              const passed = liveness.checks_passed?.includes(chk);
              return (
                <span
                  key={chk}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 ring-inset ${
                    passed ? "bg-signal-emerald/10 text-signal-emerald ring-signal-emerald/25" : "bg-white/[0.03] text-ink-500 ring-white/[0.08]"
                  }`}
                >
                  {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <MinusCircle className="h-3.5 w-3.5" />}
                  {chk.replaceAll("_", " ")}
                </span>
              );
            })}
          </div>
          {liveness.challenge?.challenge_type && (
            <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                  Challenge: {liveness.challenge.challenge_type.replaceAll("_", " ")}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                    liveness.challenge.passed ? "bg-signal-emerald/15 text-signal-emerald" : "bg-signal-crimson/15 text-signal-crimson"
                  }`}
                >
                  {liveness.challenge.passed ? "Passed" : "Failed"}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-500">{liveness.challenge.detail}</p>
            </div>
          )}
          <NotAvailableList items={liveness.not_available} />
        </ModuleCard>

        {/* 6. Device & geo */}
        {risk.device_and_geo && (
          <ModuleCard
            index={idx()}
            icon={MapPin}
            title="Device & Geolocation"
            description="Device fingerprint and geo-velocity check"
            state={deviceState}
            summary={<span className="font-display text-sm font-semibold text-ink-50">{risk.device_and_geo.travel_flag ? "Impossible travel" : "Normal"}</span>}
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat label="Location" value={risk.device_and_geo.geo_city || "Unknown"} />
              <Stat label="Device" value={risk.device_and_geo.device_id_hash ? risk.device_and_geo.device_id_hash.slice(0, 8) : "—"} mono />
              <Stat label="Travel check" value={risk.device_and_geo.travel_flag ? "Impossible travel" : "Normal"} />
            </div>
          </ModuleCard>
        )}

        {/* 7. Fraud network */}
        {risk.fraud_network && (
          <ModuleCard
            index={idx()}
            icon={Network}
            title="Fraud Network"
            description="Shared devices, phones and document numbers"
            state={networkState}
            summary={
              <span className={`font-display text-sm font-semibold ${risk.fraud_network.flagged ? "text-signal-crimson" : "text-signal-emerald"}`}>
                {risk.fraud_network.flagged ? `${risk.fraud_network.linked_count} linked identities` : "Clean"}
              </span>
            }
          >
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Fraud network</span>
              <span
                className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                  risk.fraud_network.flagged ? "bg-signal-crimson/15 text-signal-crimson" : "bg-signal-emerald/15 text-signal-emerald"
                }`}
              >
                {risk.fraud_network.flagged ? `${risk.fraud_network.linked_count} linked identities` : "Clean"}
              </span>
            </div>
          </ModuleCard>
        )}

        {/* 8. AI Risk Assessment */}
        <ModuleCard
          index={idx()}
          icon={Gauge}
          title="AI Risk Assessment"
          description="Composite fraud risk score & recommendation"
          state={modulesState.risk}
          defaultOpen
          summary={<span className={`font-display text-lg font-semibold ${riskColor}`}>{risk.risk_score ?? "—"} <span className="text-xs uppercase">· {risk.risk_band ?? "n/a"}</span></span>}
        >
          <Meter label="Overall risk score" value={risk.risk_score ?? 0} display={`${risk.risk_score ?? "—"} / 100`} colorClass={riskBarColor} />

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Stat label="OCR confidence" value={risk.factors.ocr_confidence?.toFixed(0)} />
            <Stat label="Forgery score" value={risk.factors.forgery_score} />
            <Stat label="Face match" value={risk.factors.face_match_score?.toFixed(0)} />
            <Stat label="Liveness" value={risk.factors.liveness_score?.toFixed(0)} />
            <Stat label="24h velocity" value={risk.factors.velocity_last_24h} />
            <Stat label="Prior flags" value={risk.factors.prior_flagged_verifications} />
          </div>
          <NotAvailableList items={risk.not_available} />
        </ModuleCard>

        {/* 9. Trust */}
        {risk.trust_engine && (
          <ModuleCard
            index={idx()}
            icon={Sparkles}
            title="Digital Identity Trust"
            description="Rule-by-rule trust breakdown"
            state={trustState}
            defaultOpen
            summary={
              <span
                className={`font-display text-2xl font-semibold ${
                  risk.trust_engine.trust_score >= 70 ? "text-signal-emerald" : risk.trust_engine.trust_score >= 40 ? "text-signal-amber" : "text-signal-crimson"
                }`}
              >
                {Math.round(risk.trust_engine.trust_score)}
                <span className="text-sm font-normal text-ink-500">/100</span>
              </span>
            }
          >
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink-50">Digital identity trust score</h4>
                <span
                  className={`font-display text-3xl font-semibold ${
                    risk.trust_engine.trust_score >= 70 ? "text-signal-emerald" : risk.trust_engine.trust_score >= 40 ? "text-signal-amber" : "text-signal-crimson"
                  }`}
                >
                  {Math.round(risk.trust_engine.trust_score)}
                  <span className="text-sm font-normal text-ink-500">/100</span>
                </span>
              </div>
              <ul className="mt-4 divide-y divide-white/[0.04]">
                {risk.trust_engine.breakdown.map((rule, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="text-ink-300">{rule.label}</span>
                    <span className={rule.delta < 0 ? "font-mono font-semibold text-signal-crimson" : "font-mono text-ink-500"}>
                      {rule.delta === 0 ? "—" : rule.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ModuleCard>
        )}

        {/* 10. Risk-based step-up flow */}
        {step_up && (
          <ModuleCard
            index={idx()}
            icon={step_up.action === "video_kyc" ? Video : Gauge}
            title="Risk-Based Step-Up"
            description="Routes each verification to the right amount of friction"
            state={modulesState.stepUp}
            defaultOpen={step_up.action !== "none"}
            summary={
              <span className="font-display text-sm font-semibold capitalize text-ink-50">
                {step_up.action === "none" ? "Instant approval" : `${step_up.action.replaceAll("_", " ")} · ${step_up.status.replaceAll("_", " ")}`}
              </span>
            }
          >
            <p className="text-sm text-ink-300">{step_up.reason}</p>
            {step_up.action !== "none" && (
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Stat label="Action" value={step_up.action.replaceAll("_", " ")} />
                <Stat label="Status" value={step_up.status.replaceAll("_", " ")} />
                <Stat label="Method" value={step_up.method || "—"} />
                {step_up.action === "video_kyc" && (
                  <Stat label="Queue status" value={step_up.video_kyc_queue_status?.replaceAll("_", " ") || "not queued yet"} />
                )}
              </div>
            )}
            {step_up.action === "second_factor" && step_up.status === "pending" && (
              <p className="mt-4 text-xs text-signal-amber">
                This verification needs a second factor (OTP or a repeat selfie) before it can be approved -
                complete it from the verification flow.
              </p>
            )}
            {step_up.action === "video_kyc" && step_up.status !== "completed" && (
              <p className="mt-4 text-xs text-signal-amber">
                Routed to a live video-KYC call with a human agent instead of an automatic rejection - queue and
                completion are managed from the admin console.
              </p>
            )}
          </ModuleCard>
        )}

        {/* 11. Decision */}
        <ModuleCard
          index={idx()}
          icon={Gavel}
          title="Decision"
          description="Engine recommendation"
          state={decisionState}
          defaultOpen
          last
          summary={
            <span
              className={`font-display text-sm font-semibold uppercase ${
                risk.status === "approved" ? "text-signal-emerald" : risk.status === "rejected" ? "text-signal-crimson" : "text-signal-amber"
              }`}
            >
              {risk.status === "approved" ? "Approve" : risk.status === "rejected" ? "Reject" : "Manual review"}
            </span>
          }
        >
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Recommendation</span>
            <span
              className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
                risk.status === "approved"
                  ? "bg-signal-emerald/15 text-signal-emerald"
                  : risk.status === "rejected"
                  ? "bg-signal-crimson/15 text-signal-crimson"
                  : "bg-signal-amber/15 text-signal-amber"
              }`}
            >
              {risk.status === "approved" ? "Approve" : risk.status === "rejected" ? "Reject" : "Manual review"}
            </span>
          </div>
        </ModuleCard>
      </ol>
    </PageShell>
  );
}
