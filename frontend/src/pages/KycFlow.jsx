import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="relative mx-auto max-w-3xl px-6 py-14">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />

      <div className="relative mb-12 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-100 sm:text-3xl">Identity verification</h1>
        <p className="mt-2 text-sm text-ink-300">Complete each step to receive your instant risk decision.</p>
        <div className="mt-8">
          <StepTracker steps={STEPS} currentIndex={stepIndex} />
        </div>
      </div>

      {/* STEP 0 — Document upload */}
      {stepIndex === 0 && (
        <div className="relative rounded-2xl glass-panel p-7">
          <h2 className="font-display text-lg font-semibold text-ink-100">Upload your ID document</h2>
          <p className="mt-1 text-sm text-ink-300">We'll extract your details automatically with OCR.</p>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {DOC_TYPES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDocType(d.value)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition ${
                  docType === d.value
                    ? "border-cyan-glow/50 bg-cyan-glow/10 text-cyan-glow"
                    : "border-white/[0.08] text-ink-300 hover:border-white/[0.15]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <label
            htmlFor="doc-upload"
            className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/[0.1] bg-void-800/50 px-6 py-10 text-center transition hover:border-cyan-glow/30"
          >
            {docPreview ? (
              <img src={docPreview} alt="Document preview" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-glow/10 ring-1 ring-cyan-glow/25">
                  <Upload className="h-5 w-5 text-cyan-glow" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-100">Click to upload a photo of your document</p>
                  <p className="mt-1 text-xs text-ink-500">JPG or PNG, clear and well-lit</p>
                </div>
              </>
            )}
            <input id="doc-upload" type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </label>

          <div className="mt-4">
            <label htmlFor="phone-number" className="text-xs font-medium text-ink-500">
              Mobile number <span className="text-ink-600">(optional)</span>
            </label>
            <input
              id="phone-number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-void-800/50 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-600 focus:border-cyan-glow/40 focus:outline-none"
            />
          </div>

          {docError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-signal-crimson/20">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {docError}
            </div>
          )}

          <button
            onClick={submitDocument}
            disabled={docLoading || !docFile}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-glow px-4 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {docLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading document…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" /> Extract & continue
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 1 — Face + liveness */}
      {stepIndex === 1 && (
        <div className="relative rounded-2xl glass-panel p-7">
          <h2 className="font-display text-lg font-semibold text-ink-100">Face verification & liveness check</h2>
          <p className="mt-1 text-sm text-ink-300">
            Look at the camera and stay still — we'll capture a short burst to confirm it's really you, live.
          </p>

          <div className="mt-6 flex flex-col items-center gap-5">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-void-800 ring-1 ring-white/[0.08]" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline />
              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void-900/80">
                  <Camera className="h-8 w-8 text-ink-500" />
                  <p className="max-w-[220px] text-center text-xs text-ink-500">Camera preview will appear here</p>
                </div>
              )}
              {capturing && (
                <div className="absolute inset-x-0 bottom-0 bg-void-950/70 px-4 py-2 backdrop-blur">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-cyan-glow transition-all duration-300" style={{ width: `${captureProgress}%` }} />
                  </div>
                  <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-cyan-glow">
                    capturing burst {captureProgress}%
                  </p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {cameraError && (
              <div className="flex items-center gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-signal-crimson/20">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {cameraError}
              </div>
            )}
            {faceError && (
              <div className="flex items-center gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-signal-crimson/20">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {faceError}
              </div>
            )}

            {!cameraReady ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 rounded-lg bg-cyan-glow px-5 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90"
              >
                <Camera className="h-4 w-4" /> Enable camera
              </button>
            ) : (
              <button
                onClick={captureBurst}
                disabled={capturing}
                className="flex items-center gap-2 rounded-lg bg-cyan-glow px-5 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90 disabled:opacity-50"
              >
                {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                {capturing ? "Capturing…" : "Start liveness capture"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 2 — Challenge-response liveness (additional module) */}
      {stepIndex === 2 && (
        <div className="relative rounded-2xl glass-panel p-7">
          <h2 className="font-display text-lg font-semibold text-ink-100">One more check — liveness challenge</h2>
          <p className="mt-1 text-sm text-ink-300">
            A random action makes this much harder to spoof with a photo or a pre-recorded video than a plain blink check.
          </p>

          <div className="mt-6 flex flex-col items-center gap-5">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-void-800 ring-1 ring-white/[0.08]" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline />
              {challengeCapturing && (
                <div className="absolute inset-x-0 bottom-0 bg-void-950/70 px-4 py-2 backdrop-blur">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-cyan-glow transition-all duration-300" style={{ width: `${challengeProgress}%` }} />
                  </div>
                  <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-cyan-glow">
                    capturing {challengeProgress}%
                  </p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="rounded-xl bg-cyan-glow/10 px-5 py-3 text-center ring-1 ring-cyan-glow/25">
              {challengeLoading ? (
                <span className="flex items-center gap-2 text-sm text-cyan-glow">
                  <Loader2 className="h-4 w-4 animate-spin" /> Choosing your challenge…
                </span>
              ) : (
                <span className="text-base font-semibold text-cyan-glow">
                  {CHALLENGE_LABELS[challengeType] || "Get ready…"}
                </span>
              )}
            </div>

            {challengeError && (
              <div className="flex items-center gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-signal-crimson/20">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {challengeError}
              </div>
            )}

            <button
              onClick={captureChallengeBurst}
              disabled={challengeCapturing || challengeLoading || !challengeType}
              className="flex items-center gap-2 rounded-lg bg-cyan-glow px-5 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90 disabled:opacity-50"
            >
              {challengeCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
              {challengeCapturing ? "Capturing…" : "Perform action & capture"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Analysis (brief processing beat) */}
      {stepIndex === 3 && (
        <div className="flex flex-col items-center gap-6 rounded-2xl glass-panel p-10 text-center">
          <ScanFrame size={260} active />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-100">Running risk analysis…</h2>
            <p className="mt-1 text-sm text-ink-300">Combining OCR confidence, face match, liveness and fraud signals.</p>
          </div>
          {finalizeError && (
            <div className="flex items-center gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-signal-crimson/20">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {finalizeError}
              <button onClick={() => runFinalize(verification.id)} className="ml-2 underline">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — Decision */}
      {stepIndex === 4 && verification && (
        <div className="rounded-2xl glass-panel p-7">
          <div className="flex flex-col items-center border-b border-white/[0.06] pb-8 text-center">
            <TrustGauge riskScore={verification.risk_score} band={verification.risk_band} size={190} />
            <div className="mt-4">
              <StatusBadge status={verification.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-7 sm:grid-cols-4">
            <Metric label="OCR confidence" value={`${Math.round(verification.ocr_confidence)}%`} />
            <Metric label="Face match" value={`${Math.round(verification.face_match_score)}%`} />
            <Metric label="Liveness" value={`${Math.round(verification.liveness_score)}%`} />
            <Metric label="Doc authenticity" value={`${Math.round(verification.document_authenticity_score)}%`} />
          </div>

          <div className="grid grid-cols-2 gap-4 pb-7 sm:grid-cols-3">
            <Metric
              label={`Challenge: ${challengeType ? challengeType.replace("_", " ") : "—"}`}
              value={verification.challenge_passed ? "Passed" : "Failed"}
            />
            <Metric label="Trust score" value={`${Math.round(verification.trust_score)}/100`} />
            <Metric label="Fraud network" value={verification.fraud_network_flag ? `${verification.fraud_network_size} linked` : "Clean"} />
          </div>

          <div className="rounded-xl bg-void-800/60 p-5">
            <h3 className="font-display text-sm font-semibold text-ink-100">Extracted details</h3>
            <dl className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <DetailRow label="Name" value={verification.ocr_name} />
              <DetailRow label="Date of birth" value={verification.ocr_dob} />
              <DetailRow label="Document number" value={verification.ocr_doc_number} mono />
              <DetailRow label="Address" value={verification.ocr_address} />
            </dl>
          </div>

          {verification.fraud_notes && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-void-800/60 p-4 text-sm text-ink-300">
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

          {verification.step_up_action !== "none" && (
            <StepUpPanel verification={verification} onResolved={(updated) => setVerification(updated)} />
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate(`/verification-progress/${verification.id}`)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-glow/40 bg-cyan-glow/10 px-5 py-3 text-sm font-semibold text-cyan-glow transition hover:bg-cyan-glow/20"
            >
              View full report
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-glow px-5 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90"
            >
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={restart}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-5 py-3 text-sm font-medium text-ink-300 transition hover:border-white/[0.15] hover:text-ink-100"
            >
              <RefreshCcw className="h-4 w-4" /> Verify another document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-void-800/60 px-3 py-3.5 text-center">
      <p className="font-mono text-lg font-semibold text-ink-100">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1.5 last:border-0 sm:last:border-b sm:odd:border-r-0">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={`text-sm text-ink-100 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
