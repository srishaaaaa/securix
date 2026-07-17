/**
 * Additional Module 2 - passive device fingerprint collection.
 *
 * Everything here is metadata the browser already exposes - no tracking
 * pixels, no third-party script. It's sent once per verification to
 * /api/kyc/{id}/device-signal, where the backend hashes it and pairs it
 * with an IP-based geolocation lookup for the impossible-travel check.
 */
export function collectDeviceFingerprint() {
  const nav = window.navigator;
  const scr = window.screen;

  let canvasHash = "unavailable";
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillText("securix-fp", 2, 2);
    canvasHash = canvas.toDataURL().slice(-32);
  } catch {
    // canvas fingerprinting can be blocked by privacy extensions - fine,
    // the rest of the fingerprint still works
  }

  return {
    user_agent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: (nav.languages || []).join(","),
    hardware_concurrency: nav.hardwareConcurrency || null,
    device_memory: nav.deviceMemory || null,
    screen_resolution: `${scr.width}x${scr.height}`,
    color_depth: scr.colorDepth,
    pixel_ratio: window.devicePixelRatio || 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_offset_minutes: new Date().getTimezoneOffset(),
    canvas_hash: canvasHash,
  };
}
