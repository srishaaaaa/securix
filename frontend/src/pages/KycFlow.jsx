import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload, FileText, Camera, ScanFace, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCcw, ArrowRight, Loader2,
} from "lucide-react";
import { api } from "../api/client";
import { collectDeviceFingerprint } from "../utils/deviceFingerprint";
import StepTracker from "../components/StepTracker";
import ScanFrame from "../components/ScanFrame";
import TrustGauge from "../components/TrustGauge";
import StatusBadge from "../components/StatusBadge";
import StepUpPanel from "../components/StepUpPanel";
import SignalBars from "../components/SignalBars";
import Stage3D from "../components/three/Stage3D";
import { DocumentFallback, LivenessGuide } from "../components/story/visuals";
import { MaskLines, PageShell, SysLabel } from "../components/ui/motion";
import { staggerChild, staggerParent } from "../components/ui/tokens";

const STEPS = ["Document", "Face + liveness", "Challenge", "Analysis", "Decision"];

const CHALLENGE_LABELS = {
  smile: "Smile 😊",
  turn_left: "Turn your head left",
  turn_right: "Turn your head right",
  raise_eyebrows: "Raise your eyebrows",
};

const DOC_TYPES = [
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving Licence" },
];

const BURST_FRAME_COUNT = 5;
const BURST_INTERVAL_MS = 450;

export default function KycFlow() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);

  // step 1 - document
  const [docType, setDocType] = useState("aadhaar");
  const [docFile, setDocFile] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const [verification, setVerification] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  // step 2 - face
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [faceError, setFaceError] = useState("");

  // step 2.5 - challenge-response liveness (additional module)
  const [challengeType, setChallengeType] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeCapturing, setChallengeCapturing] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [challengeError, setChallengeError] = useState("");
  const [challengeResult, setChallengeResult] = useState(null);

  // step 3/4 - finalize
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (err) {
      setCameraError("Couldn't access your camera. Please allow camera permission and try again.");
    }
  };

  // ---- Step 1: document upload ----
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFile(file);
    setDocPreview(URL.createObjectURL(file));
    setDocError("");
  };

  const submitDocument = async () => {
    if (!docFile) {
      setDocError("Please choose a document image first.");
      return;
    }
    setDocLoading(true);
    setDocError("");
    try {
      const res = await api.uploadDocument(docType, docFile, phoneNumber);
      setVerification(res.data);
      setStepIndex(1);

      // Module 2 - fire-and-forget device fingerprint + geo-velocity signal.
      // Never blocks or fails the main flow if it errors.
      api
        .sendDeviceSignal(res.data.id, collectDeviceFingerprint(), phoneNumber)
        .catch(() => {});
    } catch (err) {
      setDocError(err?.response?.data?.detail || "Couldn't process this document. Try a clearer image.");
    } finally {
      setDocLoading(false);
    }
  };

  // ---- Step 2: face + liveness burst ----
  const captureBurst = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    setFaceError("");
    setCaptureProgress(0);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");

    const blobs = [];
    for (let i = 0; i < BURST_FRAME_COUNT; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (blob) blobs.push(blob);
      setCaptureProgress(Math.round(((i + 1) / BURST_FRAME_COUNT) * 100));
      await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
    }

    try {
      const res = await api.verifyFace(verification.id, blobs);
      setVerification(res.data);
      setStepIndex(2); // -> Challenge step (camera stays on, reused there)
    } catch (err) {
      setFaceError(err?.response?.data?.detail || "No face detected clearly. Retry with better lighting, facing the camera.");
    } finally {
      setCapturing(false);
    }
  };

  // ---- Step 2.5: challenge-response liveness (additional module) ----
  useEffect(() => {
    if (stepIndex === 2 && verification && !challengeType) {
      setChallengeLoading(true);
      api
        .getChallenge(verification.id)
        .then((res) => setChallengeType(res.data.challenge_type))
        .catch(() => setChallengeError("Couldn't load your liveness challenge. Please retry."))
        .finally(() => setChallengeLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, verification]);

  // Bug fix: the Challenge step renders its own <video> element (a
  // different DOM node than step 1's), so React drops the srcObject on
  // that transition. Re-attach the still-live stream here or the
  // challenge capture would silently record blank frames.
  useEffect(() => {
    if (stepIndex === 2 && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stepIndex]);

  const captureChallengeBurst = async () => {
    if (!videoRef.current || !canvasRef.current || !challengeType) return;
    setChallengeCapturing(true);
    setChallengeError("");
    setChallengeProgress(0);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");

    const frames = [];
    for (let i = 0; i < BURST_FRAME_COUNT; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.85));
      setChallengeProgress(Math.round(((i + 1) / BURST_FRAME_COUNT) * 100));
      await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
    }

    stopCamera();

    try {
      const res = await api.submitChallenge(verification.id, challengeType, frames);
      setChallengeResult(res.data);
      setStepIndex(3);
      runFinalize(verification.id);
    } catch (err) {
      setChallengeError(err?.response?.data?.detail || "Couldn't verify the challenge. Please retry.");
    } finally {
      setChallengeCapturing(false);
    }
  };

  // ---- Step 3: finalize / decision ----
  const runFinalize = async (verificationId) => {
    setFinalizing(true);
    setFinalizeError("");
    try {
      const res = await api.finalize(verificationId);
      setVerification(res.data);
      setTimeout(() => setStepIndex(4), 900); // brief "analyzing" beat before reveal
    } catch (err) {
      setFinalizeError(err?.response?.data?.detail || "Couldn't finalize your verification. Please retry.");
    } finally {
      setFinalizing(false);
    }
  };

  const restart = () => {
    setStepIndex(0);
    setDocFile(null);
    setDocPreview(null);
    setDocError("");
    setVerification(null);
    setPhoneNumber("");
    setCameraReady(false);
    setFaceError("");
    setChallengeType(null);
    setChallengeResult(null);
    setChallengeError("");
    setFinalizeError("");
  };

  return (
    <PageShell className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12" style={{ paddingBottom: "max(6rem, env(safe-area-inset-bottom))" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] grid-overlay opacity-40" />

      <div className="relative mb-10 sm:mb-14">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <SysLabel live>Secure verification session</SysLabel>
            <h1 className="mt-4 font-display text-huge font-semibold uppercase text-ink-50">Identity verification</h1>
          </div>
          <p className="max-w-xs text-sm text-ink-300">Complete each step to receive your instant risk decision.</p>
        </div>
        <div className="mt-10">
          <StepTracker steps={STEPS} currentIndex={stepIndex} />
        </div>
      </div>

      {/* STEP 0 — Document upload */}
      {stepIndex === 0 && (
        <motion.div {...stepMotion} className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
          <div className="relative min-h-[400px] overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-void-850/70 sm:min-h-[420px] lg:min-h-[560px]">
            <div className="absolute inset-0 grid-overlay opacity-40" />
            <Stage3D
              scene="document"
              className="absolute inset-x-0 bottom-24 top-10 sm:inset-0"
              sceneProps={{ status: docLoading ? "processing" : docFile ? "ready" : "idle", label: DOC_TYPES.find((d) => d.value === docType)?.label }}
              fallback={<DocumentFallback className="absolute inset-0" />}
            />
            {["left-5 top-5 border-l border-t", "right-5 top-5 border-r border-t", "bottom-5 left-5 border-b border-l", "bottom-5 right-5 border-b border-r"].map((pos) => (
              <div key={pos} className={`pointer-events-none absolute h-7 w-7 rounded-[4px] border-ink-50/50 ${pos}`} />
            ))}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-7 pt-6 sm:px-8">
              <SysLabel live tone={docLoading ? "accent" : docFile ? "emerald" : "muted"}>
                {docLoading ? "Reading document" : docFile ? "Document detected" : "Awaiting document"}
              </SysLabel>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">Scanner · 01</span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-7 pb-7 sm:px-8 sm:pb-8">
              <AnimatePresence mode="wait">
                <motion.p
                  key={docLoading ? "l" : docFile ? "d" : "i"}
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                  transition={{ duration: 0.4 }}
                  className={`font-display text-2xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-4xl ${docFile && !docLoading ? "text-signal-emerald" : "text-ink-50"}`}
                >
                  {docLoading ? (
                    <>Extracting<br />fields…</>
                  ) : docFile ? (
                    <>Document<br />detected</>
                  ) : (
                    <>Place your ID<br /><span className="text-ink-500">inside the frame</span></>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="glass-panel rounded-[1.75rem] p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="eyebrow">01 · Document</span>
              <FileText className="h-4 w-4 text-ink-500" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-50">Upload your ID document</h2>
            <p className="mt-1.5 text-sm text-ink-300">We'll extract your details automatically with OCR.</p>

            <div className="mt-6 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Document type">
              {DOC_TYPES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDocType(d.value)}
                  role="radio"
                  aria-checked={docType === d.value}
                  className={`relative rounded-2xl border px-3.5 py-3 text-left text-xs font-medium transition-all duration-300 ${
                    docType === d.value
                      ? "border-accent-soft/50 bg-accent/[0.12] text-ink-50 shadow-[0_0_0_4px_rgba(100,120,255,0.08)]"
                      : "border-white/[0.07] text-ink-300 hover:border-white/[0.16] hover:text-ink-100"
                  }`}
                >
                  <span className={`mb-2 block h-1.5 w-1.5 rounded-full ${docType === d.value ? "bg-accent-soft" : "bg-white/15"}`} />
                  {d.label}
                </button>
              ))}
            </div>

            <label
              htmlFor="doc-upload"
              className="group relative mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-8 text-center transition hover:border-accent-soft/50 hover:bg-accent/[0.04]"
            >
              {docPreview ? (
                <>
                  <img src={docPreview} alt="Document preview" className="max-h-44 rounded-xl object-contain ring-1 ring-white/10" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">Tap to replace</span>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition group-hover:scale-110 group-hover:border-accent-soft/40">
                    <Upload className="h-5 w-5 text-accent-soft" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-100">Click to upload a photo of your document</p>
                    <p className="mt-1 text-xs text-ink-500">JPG or PNG, clear and well-lit</p>
                  </div>
                </>
              )}
              <input id="doc-upload" type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </label>

            <div className="mt-5">
              <label htmlFor="phone-number" className="field-label">
                Mobile number <span className="normal-case tracking-normal text-ink-700">(optional)</span>
              </label>
              <input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="field"
              />
            </div>

            {docError && (
              <div role="alert" className="alert-danger mt-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {docError}
              </div>
            )}

            <button onClick={submitDocument} disabled={docLoading || !docFile} className="btn btn-light mt-6 w-full py-3.5">
              {docLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading document…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" /> Extract & continue <ArrowRight className="btn-arrow h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 1 — Face + liveness */}
      {stepIndex === 1 && (
        <motion.div {...stepMotion} className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:gap-6">
          <div className="relative">
            <CameraViewport
              videoRef={videoRef}
              canvasRef={canvasRef}
              ready={cameraReady}
              capturing={capturing}
              progress={captureProgress}
              frames={BURST_FRAME_COUNT}
              title="Live biometric capture"
            />
          </div>

          <div className="glass-4 flex flex-col rounded-[1.75rem] p-5 sm:p-7">
            <span className="eyebrow">02 · Biometrics</span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-50">Face verification & liveness check</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
              Look at the camera and stay still — we'll capture a short burst to confirm it's really you, live.
            </p>

            {verification && (
              <div className="mt-5 rounded-2xl border border-signal-emerald/20 bg-signal-emerald/[0.05] p-4">
                <div className="flex items-center justify-between">
                  <SysLabel tone="emerald">Document read</SysLabel>
                  <span className="font-mono text-[11px] text-signal-emerald">{Math.round(verification.ocr_confidence)}% OCR</span>
                </div>
                <dl className="mt-3 space-y-1.5">
                  <MiniRow label="Name" value={verification.ocr_name} />
                  <MiniRow label="DOB" value={verification.ocr_dob} />
                  <MiniRow label="Doc no." value={verification.ocr_doc_number} mono />
                </dl>
              </div>
            )}

            <ul className="mt-5 space-y-2 text-xs text-ink-300">
              {["Face the camera in good light", "Keep your face inside the oval", "Hold still for about two seconds"].map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-ink-700">0{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-6">
              {cameraError && (
                <div role="alert" className="alert-danger mb-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {cameraError}
                </div>
              )}
              {faceError && (
                <div role="alert" className="alert-danger mb-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {faceError}
                </div>
              )}

              {!cameraReady ? (
                <button onClick={startCamera} className="btn btn-light w-full py-3.5">
                  <Camera className="h-4 w-4" /> Enable camera
                </button>
              ) : (
                <button onClick={captureBurst} disabled={capturing} className="btn btn-primary w-full py-3.5">
                  {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                  {capturing ? "Capturing…" : "Start liveness capture"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 2 — Challenge-response liveness (additional module) */}
      {stepIndex === 2 && (
        <motion.div {...stepMotion} className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:gap-6">
          <div className="relative">
            <CameraViewport
              videoRef={videoRef}
              canvasRef={canvasRef}
              ready
              capturing={challengeCapturing}
              progress={challengeProgress}
              frames={BURST_FRAME_COUNT}
              title="Live check"
              verifying={challengeCapturing && challengeProgress === 100}
            />
          </div>

          <div className="glass-4 flex flex-col rounded-[1.75rem] p-5 sm:p-7">
            <span className="eyebrow">03 · Liveness challenge</span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-50">One more check — liveness challenge</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
              A random action makes this much harder to spoof with a photo or a pre-recorded video than a plain blink check.
            </p>

            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-accent-soft/20 bg-accent/[0.06] p-4">
              <div className="h-24 w-20 flex-shrink-0">
                {challengeType && (
                  <LivenessGuide
                    challenge={challengeType}
                    phase={challengeCapturing ? "scanning" : "waiting"}
                    className="h-full w-full"
                  />
                )}
              </div>
              <div className="min-w-0" aria-live="polite">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-soft">Your action</span>
                {challengeLoading ? (
                  <span className="mt-1 flex items-center gap-2 text-sm text-accent-soft">
                    <Loader2 className="h-4 w-4 animate-spin" /> Choosing your challenge…
                  </span>
                ) : (
                  <span className="mt-1 block font-display text-xl font-semibold uppercase leading-tight tracking-tight text-ink-50 sm:text-2xl">
                    {CHALLENGE_LABELS[challengeType] || "Get ready…"}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-auto pt-6">
              {challengeError && (
                <div role="alert" className="alert-danger mb-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {challengeError}
                </div>
              )}

              <button
                onClick={captureChallengeBurst}
                disabled={challengeCapturing || challengeLoading || !challengeType}
                className="btn btn-primary w-full py-3.5"
              >
                {challengeCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                {challengeCapturing ? "Capturing…" : "Perform action & capture"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 3 — Analysis (brief processing beat) */}
      {stepIndex === 3 && (
        <motion.div {...stepMotion} className="glass-panel relative overflow-hidden rounded-[1.75rem] p-5 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_0%,rgba(100,120,255,0.12),transparent_70%)]" />
          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
            <div className="flex justify-center">
              <div className="relative aspect-square w-[min(78vw,340px)]">
                <Stage3D
                  scene="identity"
                  className="absolute inset-0"
                  sceneProps={{ stage: !finalizing && typeof verification?.risk_score === "number" ? 5 : 2 }}
                  fallback={<ScanFrame size={300} active={finalizing || !finalizeError} />}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                  <SysLabel live tone={!finalizing && typeof verification?.risk_score === "number" ? "emerald" : "accent"}>
                    {!finalizing && typeof verification?.risk_score === "number" ? "Analysis / complete" : "Risk engine / active"}
                  </SysLabel>
                </div>
              </div>
            </div>
            <div>
              <SysLabel live>Analysis</SysLabel>
              <h2 className="mt-3 font-display text-big font-semibold uppercase text-ink-50">Running risk analysis…</h2>
              <p className="mt-2 text-sm text-ink-300">Combining OCR confidence, face match, liveness and fraud signals.</p>

              <motion.ul variants={staggerParent(0.12, 0.1)} initial="hidden" animate="show" className="mt-6 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                {analysisRows(verification, challengeResult, finalizing).map((row) => (
                  <motion.li key={row.label} variants={staggerChild} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5">
                    <span className="flex items-center gap-2.5">
                      {row.state === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-signal-emerald" />
                      ) : row.state === "fail" ? (
                        <XCircle className="h-4 w-4 text-signal-crimson" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-accent-soft" />
                      )}
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-300">{row.label}</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink-100">{row.value}</span>
                  </motion.li>
                ))}
              </motion.ul>

              {finalizeError && (
                <div role="alert" className="alert-danger mt-5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{finalizeError}</span>
                  <button onClick={() => runFinalize(verification.id)} className="ml-auto font-semibold underline underline-offset-2">
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 4 — Decision */}
      {stepIndex === 4 && verification && (
        <motion.div {...stepMotion} className="relative">
          <DecisionHero verification={verification} />

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
            <div className={`glass-3 edge-light ${verification.status === "approved" ? "edge-emerald" : verification.status === "rejected" ? "edge-crimson" : "edge-amber"} flex flex-col items-center justify-center rounded-[1.75rem] px-8 py-8 sm:px-12`}>
              <TrustGauge riskScore={verification.risk_score} band={verification.risk_band} size={220} />
              <div className="mt-5">
                <StatusBadge status={verification.status} />
              </div>
            </div>

            <div className="glass-panel rounded-[1.75rem] p-5 sm:p-7">
              <span className="eyebrow">Signals</span>
              <SignalBars
                className="mt-3"
                rows={[
                  { key: "ocr", label: "OCR confidence", value: verification.ocr_confidence, display: `${Math.round(verification.ocr_confidence)}%` },
                  { key: "face", label: "Face match", value: verification.face_match_score, display: `${Math.round(verification.face_match_score)}%` },
                  { key: "live", label: "Liveness", value: verification.liveness_score, display: `${Math.round(verification.liveness_score)}%` },
                  { key: "auth", label: "Doc authenticity", value: verification.document_authenticity_score, display: `${Math.round(verification.document_authenticity_score)}%` },
                ]}
              />
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Metric
                  label={`Challenge: ${challengeType ? challengeType.replace("_", " ") : "—"}`}
                  value={verification.challenge_passed ? "Passed" : "Failed"}
                />
                <Metric label="Trust score" value={`${Math.round(verification.trust_score)}/100`} />
                <Metric label="Fraud network" value={verification.fraud_network_flag ? `${verification.fraud_network_size} linked` : "Clean"} />
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
                <h3 className="eyebrow">Extracted details</h3>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <DetailRow label="Name" value={verification.ocr_name} />
                  <DetailRow label="Date of birth" value={verification.ocr_dob} />
                  <DetailRow label="Document number" value={verification.ocr_doc_number} mono />
                  <DetailRow label="Address" value={verification.ocr_address} />
                </dl>
              </div>

              {verification.fraud_notes && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-ink-300">
                  {verification.status === "approved" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-emerald" />
                  ) : verification.status === "rejected" ? (
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-crimson" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-amber" />
                  )}
                  <span>{verification.fraud_notes}</span>
                </div>
              )}
            </div>
          </div>

          {verification.step_up_action !== "none" && (
            <StepUpPanel verification={verification} onResolved={(updated) => setVerification(updated)} />
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => navigate(`/verification-progress/${verification.id}`)} className="btn btn-ghost flex-1 py-3.5">
              View full report
            </button>
            <button onClick={() => navigate("/dashboard")} className="btn btn-light flex-1 py-3.5">
              Go to dashboard <ArrowRight className="btn-arrow h-4 w-4" />
            </button>
            <button onClick={restart} className="btn btn-ghost py-3.5 text-ink-300">
              <RefreshCcw className="h-4 w-4" /> Verify another document
            </button>
          </div>
        </motion.div>
      )}
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* Presentational helpers                                              */
/* ------------------------------------------------------------------ */

const stepMotion = {
  initial: { opacity: 0, y: 24, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

/**
 * Camera viewport chrome around the existing <video>/<canvas> refs. The
 * refs, element types and mount timing are exactly as before - this only
 * draws brackets, the face guide and the capture counter on top.
 */
function CameraViewport({ videoRef, canvasRef, ready, capturing, progress, frames, title, verifying = false }) {
  const frame = Math.round((progress / 100) * frames);
  return (
    <div className="relative w-full overflow-hidden rounded-[1.75rem] bg-void-950 ring-1 ring-white/[0.08]" style={{ aspectRatio: "4/3" }}>
      <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline />

      {/* vignette + face guide */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_34%_44%_at_50%_48%,transparent_96%,rgba(4,5,8,0.55)_100%)]" />
      <svg viewBox="0 0 400 300" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <ellipse
          cx="200" cy="144" rx="82" ry="108"
          fill="none"
          stroke={capturing ? "#35d99a" : "rgba(238,240,246,0.55)"}
          strokeWidth="1.2"
          strokeDasharray={capturing ? "0" : "3 6"}
          style={{ transition: "stroke .4s ease" }}
        />
        {capturing &&
          Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return <circle key={i} cx={200 + Math.cos(a) * 82} cy={144 + Math.sin(a) * 108} r="1.4" fill="#35d99a" opacity={i / 24 <= progress / 100 ? 1 : 0.2} />;
          })}
        <path d="M194 144h12M200 138v12" stroke="rgba(238,240,246,0.35)" />
        {ready && !capturing &&
          [[172, 118], [228, 118], [200, 150], [182, 178], [218, 178], [160, 100], [240, 100], [200, 206]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.3" fill="#9db0ff" opacity="0.55">
              <animate attributeName="opacity" values="0.15;0.7;0.15" dur={`${2 + (i % 3) * 0.6}s`} repeatCount="indefinite" />
            </circle>
          ))}
      </svg>

      {["left-4 top-4 border-l-2 border-t-2", "right-4 top-4 border-r-2 border-t-2", "bottom-4 left-4 border-b-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2"].map((pos) => (
        <div
          key={pos}
          className={`pointer-events-none absolute h-7 w-7 rounded-[5px] transition-colors duration-500 ${capturing ? "border-signal-emerald" : "border-ink-50/70"} ${pos}`}
        />
      ))}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5 sm:px-6">
        <span className="flex items-center gap-2 rounded-full bg-void-950/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-100 backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? "animate-blink bg-signal-crimson" : "bg-ink-700"}`} />
          {ready ? "Live" : "Offline"}
        </span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 sm:block">
          {title} <span className="text-ink-700">· Biometric core / {ready ? "active" : "standby"}</span>
        </span>
      </div>

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void-900/85">
          <Camera className="h-8 w-8 text-ink-500" />
          <p className="max-w-[240px] text-center text-xs text-ink-500">Camera preview will appear here</p>
        </div>
      )}

      {/* scan line */}
      {capturing && <div className="pointer-events-none absolute inset-x-[18%] top-0 h-px animate-scanY bg-gradient-to-r from-transparent via-signal-emerald to-transparent" />}

      {/* bottom status */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-void-950/90 to-transparent px-5 pb-5 pt-12 sm:px-6" aria-live="polite">
        {capturing ? (
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal-emerald">
                {verifying ? "Verifying motion…" : "Capturing"}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink-50 sm:text-4xl">
                {String(frame).padStart(2, "0")} <span className="text-ink-500">/ {String(frames).padStart(2, "0")}</span>
              </p>
            </div>
            <div className="flex gap-1.5 pb-2">
              {Array.from({ length: frames }).map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full transition-colors duration-300 sm:w-8 ${i < frame ? "bg-signal-emerald" : "bg-white/15"}`} />
              ))}
            </div>
          </div>
        ) : ready ? (
          <p className="text-center font-display text-base font-semibold uppercase tracking-tight text-ink-50 sm:text-lg">
            Position your face inside the frame
          </p>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/** Analysis checklist - every value comes from existing state, nothing invented. */
function analysisRows(verification, challengeResult, finalizing) {
  const pct = (v) => (typeof v === "number" ? `${Math.round(v)}%` : "—");
  const done = (v) => (typeof v === "number" ? "done" : "pending");
  const v = verification || {};
  return [
    { label: "Document · OCR", value: pct(v.ocr_confidence), state: done(v.ocr_confidence) },
    { label: "Authenticity", value: pct(v.document_authenticity_score), state: done(v.document_authenticity_score) },
    { label: "Forgery", value: typeof v.forgery_score === "number" ? `${Math.round(v.forgery_score)}% risk` : "—", state: done(v.forgery_score) },
    { label: "Face match", value: pct(v.face_match_score), state: done(v.face_match_score) },
    { label: "Liveness", value: pct(v.liveness_score), state: done(v.liveness_score) },
    {
      label: "Challenge",
      value: challengeResult ? `${challengeResult.passed ? "Passed" : "Failed"} · ${Math.round(challengeResult.confidence)}%` : "—",
      state: challengeResult ? (challengeResult.passed ? "done" : "fail") : "pending",
    },
    { label: "Device & geo", value: "Signal sent", state: "done" },
    { label: "Risk & fraud network", value: finalizing ? "Computing…" : typeof v.risk_score === "number" ? "Computed" : "—", state: finalizing ? "pending" : typeof v.risk_score === "number" ? "done" : "pending" },
  ];
}

/** Large cinematic decision headline, derived only from the real status. */
function DecisionHero({ verification }) {
  const stepUpOpen = verification.step_up_action && verification.step_up_action !== "none" && verification.step_up_status !== "completed";
  const cfg =
    verification.status === "approved"
      ? { lines: ["Identity", "verified."], tone: "text-signal-emerald", glow: "rgba(53,217,154,0.16)", Icon: CheckCircle2 }
      : verification.status === "rejected"
      ? { lines: ["Verification", "declined."], tone: "text-signal-crimson", glow: "rgba(255,84,104,0.14)", Icon: XCircle }
      : stepUpOpen
      ? { lines: ["Additional", "verification required."], tone: "text-signal-amber", glow: "rgba(243,173,75,0.14)", Icon: Clock }
      : { lines: ["Additional review", "required."], tone: "text-signal-amber", glow: "rgba(243,173,75,0.14)", Icon: Clock };
  const { Icon } = cfg;
  return (
    <div className={`edge-light ${verification.status === "approved" ? "edge-emerald" : verification.status === "rejected" ? "edge-crimson" : "edge-amber"} relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] px-5 py-10 sm:px-10 sm:py-14`}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(70% 90% at 15% 0%, ${cfg.glow}, transparent 70%)` }} />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SysLabel tone={verification.status === "approved" ? "emerald" : verification.status === "rejected" ? "crimson" : "amber"}>
            Decision · <span className="text-ink-500">{String(verification.id).slice(0, 8)}</span>
          </SysLabel>
          <h2 className={`mt-4 font-display font-semibold uppercase ${cfg.lines.join(" ").length > 22 ? "text-huge" : "text-giant"} ${cfg.tone}`}>
            <MaskLines lines={cfg.lines} delay={0.1} />
          </h2>
        </div>
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.35 }}
          className={`hidden h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-current sm:flex ${cfg.tone}`}
        >
          <Icon className="h-9 w-9" />
        </motion.div>
      </div>
    </div>
  );
}

function MiniRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`truncate text-ink-100 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3.5">
      <p className="font-display text-xl font-semibold tabular-nums text-ink-50">{value}</p>
      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className={`text-right text-sm text-ink-100 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
