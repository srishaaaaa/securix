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
      <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-signal-emerald/10 px-4 py-3.5 text-sm text-signal-emerald ring-1 ring-inset ring-signal-emerald/20">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        Step-up verification complete — decision updated.
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
    <div className="mt-5 rounded-2xl border border-signal-amber/20 bg-signal-amber/[0.05] p-5">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-signal-amber/15">
          <AlertTriangle className="h-4 w-4 text-signal-amber" />
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-ink-100">Additional verification required</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-300">{reason}</p>
        </div>
      </div>

      {/* ---- second_factor: choose OTP or repeat selfie ---- */}
      {verification.step_up_action === "second_factor" && status !== "failed" && (
        <div className="mt-4">
          {!method && (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => setMethod("otp")}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent-soft transition hover:bg-accent/15"
              >
                <KeyRound className="h-4 w-4" /> Verify with OTP
              </button>
              <button
                onClick={() => setMethod("selfie")}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent-soft transition hover:bg-accent/15"
              >
                <Camera className="h-4 w-4" /> Retake selfie
              </button>
            </div>
          )}

          {method === "otp" && (
            <div className="mt-1">
              {!otpSent ? (
                <button
                  onClick={requestOtp}
                  disabled={otpLoading}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
                >
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Send OTP
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {devOtp && (
                    <p className="text-xs text-ink-500">
                      No SMS/email provider configured in this build — your test OTP is{" "}
                      <span className="font-mono text-accent-soft">{devOtp}</span>.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit OTP"
                      className="w-32 rounded-lg border border-white/[0.1] bg-void-800 px-3 py-2 text-sm text-ink-100 outline-none transition focus:border-accent/50"
                    />
                    <button
                      onClick={verifyOtp}
                      disabled={otpLoading || otpValue.length < 4}
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                </div>
              )}
              {otpError && <p className="mt-2 text-xs text-signal-crimson">{otpError}</p>}
            </div>
          )}

          {method === "selfie" && (
            <div className="mt-1 flex flex-col items-center gap-3">
              <div className="relative w-full max-w-xs overflow-hidden rounded-xl bg-void-800 ring-1 ring-white/[0.08]" style={{ aspectRatio: "4/3" }}>
                <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-void-900/80">
                    <Camera className="h-6 w-6 text-ink-500" />
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              {!cameraReady ? (
                <button onClick={startCamera} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow">
                  <Camera className="h-4 w-4" /> Enable camera
                </button>
              ) : (
                <button
                  onClick={captureAndSubmitSelfie}
                  disabled={capturing}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
                >
                  {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {capturing ? "Capturing…" : "Capture & verify"}
                </button>
              )}
              {selfieError && <p className="text-xs text-signal-crimson">{selfieError}</p>}
            </div>
          )}
        </div>
      )}

      {status === "failed" && (
        <p className="mt-3 text-xs text-signal-crimson">
          {selfieError || "This step-up attempt didn't pass. This verification is now held for manual/admin review."}
        </p>
      )}

      {/* ---- video_kyc ---- */}
      {verification.step_up_action === "video_kyc" && (
        <div className="mt-4">
          {!queueEntry ? (
            <button
              onClick={requestVideoKyc}
              disabled={queueLoading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
            >
              {queueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Join video-KYC queue
            </button>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg bg-void-800/60 px-4 py-3 text-sm text-ink-300">
              <Clock className="h-4 w-4 flex-shrink-0 text-signal-amber" />
              You're in the queue ({queueEntry.status.replace("_", " ")}) — an agent will call you shortly. You'll be
              notified once the call is complete.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
