import { useEffect, useRef, useState } from "react";
import { KeyRound, Camera, Video, CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import { api } from "../api/client";

const BURST_FRAME_COUNT = 5;
const BURST_INTERVAL_MS = 400;

/**
 * Additional module - risk-based step-up flow.
 *
 * Shown on the KYC decision screen whenever the finalized verification's
 * `step_up_action` isn't "none": lets the user clear a "second_factor"
 * requirement via OTP or a repeat selfie, or shows their position for a
 * "video_kyc" call. Purely additive - the base decision screen above it
 * is untouched and still renders exactly as before for anyone who didn't
 * need a step-up.
 */
export default function StepUpPanel({ verification, onResolved }) {
  const [method, setMethod] = useState(null); // "otp" | "selfie" | null
  const [status, setStatus] = useState(verification.step_up_status);
  const [reason] = useState(verification.step_up_reason);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState(null);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Selfie state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [selfieError, setSelfieError] = useState("");

  // Video KYC state
  const [queueEntry, setQueueEntry] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  if (verification.step_up_action === "none" || status === "completed") {
    return status === "completed" ? (
      <div role="status" className="mt-6 flex items-center gap-3 rounded-2xl border border-signal-emerald/25 bg-signal-emerald/[0.07] px-5 py-4 text-sm text-signal-emerald">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-signal-emerald/15">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="font-medium">Step-up verification complete — decision updated.</span>
      </div>
    ) : null;
  }

  const requestOtp = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await api.requestStepUpOtp(verification.id);
      setOtpSent(true);
      setDevOtp(res.data.dev_otp || null);
    } catch (err) {
      setOtpError(err?.response?.data?.detail || "Couldn't send an OTP right now.");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await api.verifyStepUpOtp(verification.id, otpValue);
      setStatus("completed");
      onResolved?.(res.data.verification);
    } catch (err) {
      setOtpError(err?.response?.data?.detail || "Incorrect or expired OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const startCamera = async () => {
    setSelfieError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setSelfieError("Couldn't access your camera. Please allow camera permission and try again.");
    }
  };

  const captureAndSubmitSelfie = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    setSelfieError("");

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
      await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
    }

    try {
      const res = await api.submitStepUpSelfie(verification.id, blobs);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (res.data.passed) {
        setStatus("completed");
        onResolved?.(res.data.verification);
      } else {
        setSelfieError(res.data.detail);
        setStatus("failed");
      }
    } catch (err) {
      setSelfieError(err?.response?.data?.detail || "Couldn't verify the repeat selfie. Please retry with better lighting.");
    } finally {
      setCapturing(false);
    }
  };

  const requestVideoKyc = async () => {
    setQueueLoading(true);
    try {
      const res = await api.requestVideoKyc(verification.id);
      setQueueEntry(res.data);
    } catch (err) {
      setSelfieError(err?.response?.data?.detail || "Couldn't join the video-KYC queue.");
    } finally {
      setQueueLoading(false);
    }
  };

  return (
    <div className="relative mt-6 overflow-hidden rounded-[1.4rem] border border-signal-amber/25 bg-gradient-to-b from-signal-amber/[0.07] to-transparent p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-signal-amber/10 blur-3xl" />
      <div className="relative flex items-start gap-3.5">
        <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-signal-amber/15 ring-1 ring-inset ring-signal-amber/30">
          <AlertTriangle className="h-4 w-4 text-signal-amber" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal-amber">Checkpoint</p>
          <h3 className="mt-1 font-display text-lg font-semibold uppercase tracking-tight text-ink-50">Additional verification required</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{reason}</p>
        </div>
      </div>

      {/* ---- second_factor: choose OTP or repeat selfie ---- */}
      {verification.step_up_action === "second_factor" && status !== "failed" && (
        <div className="relative mt-5">
          {!method && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button onClick={() => setMethod("otp")} className="btn btn-accent-ghost w-full rounded-2xl py-3.5">
                <KeyRound className="h-4 w-4" /> Verify with OTP
              </button>
              <button onClick={() => setMethod("selfie")} className="btn btn-accent-ghost w-full rounded-2xl py-3.5">
                <Camera className="h-4 w-4" /> Retake selfie
              </button>
            </div>
          )}

          {method === "otp" && (
            <div className="mt-1">
              {!otpSent ? (
                <button onClick={requestOtp} disabled={otpLoading} className="btn btn-primary">
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Send OTP
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  {devOtp && (
                    <p className="text-xs text-ink-500">
                      No SMS/email provider configured in this build — your test OTP is{" "}
                      <span className="font-mono text-accent-soft">{devOtp}</span>.
                    </p>
                  )}
                  <div className="flex flex-col gap-2 xs:flex-row">
                    <input
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit OTP"
                      aria-label="One-time password"
                      inputMode="numeric"
                      className="field font-mono tracking-[0.4em] xs:w-44"
                    />
                    <button onClick={verifyOtp} disabled={otpLoading || otpValue.length < 4} className="btn btn-primary">
                      {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                </div>
              )}
              {otpError && <p role="alert" className="mt-2.5 text-xs text-signal-crimson">{otpError}</p>}
            </div>
          )}

          {method === "selfie" && (
            <div className="mt-1 flex flex-col items-center gap-4">
              <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-void-850 ring-1 ring-white/[0.08]" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline />
                {["left-3 top-3 border-l border-t", "right-3 top-3 border-r border-t", "bottom-3 left-3 border-b border-l", "bottom-3 right-3 border-b border-r"].map((pos) => (
                  <div key={pos} className={`pointer-events-none absolute h-5 w-5 rounded-[3px] border-ink-50/60 ${pos}`} />
                ))}
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-void-900/85">
                    <Camera className="h-6 w-6 text-ink-500" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Camera offline</span>
                  </div>
                )}
                {capturing && (
                  <div className="absolute inset-x-6 top-0 h-px animate-scanY bg-gradient-to-r from-transparent via-ink-50 to-transparent" />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              {!cameraReady ? (
                <button onClick={startCamera} className="btn btn-primary">
                  <Camera className="h-4 w-4" /> Enable camera
                </button>
              ) : (
                <button onClick={captureAndSubmitSelfie} disabled={capturing} className="btn btn-primary">
                  {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {capturing ? "Capturing…" : "Capture & verify"}
                </button>
              )}
              {selfieError && <p role="alert" className="text-center text-xs text-signal-crimson">{selfieError}</p>}
            </div>
          )}
        </div>
      )}

      {status === "failed" && (
        <p role="alert" className="relative mt-4 text-xs text-signal-crimson">
          {selfieError || "This step-up attempt didn't pass. This verification is now held for manual/admin review."}
        </p>
      )}

      {/* ---- video_kyc ---- */}
      {verification.step_up_action === "video_kyc" && (
        <div className="relative mt-5">
          {!queueEntry ? (
            <button onClick={requestVideoKyc} disabled={queueLoading} className="btn btn-primary">
              {queueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Join video-KYC queue
            </button>
          ) : (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 text-sm text-ink-300">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-amber" />
              <span>
                You're in the queue ({queueEntry.status.replace("_", " ")}) — an agent will call you shortly. You'll be
                notified once the call is complete.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
