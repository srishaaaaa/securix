import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("securix_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  register: (payload) => client.post("/api/auth/register", payload),
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return client.post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  me: () => client.get("/api/auth/me"),

  uploadDocument: (documentType, file, phoneNumber) => {
    const form = new FormData();
    form.append("document_type", documentType);
    form.append("file", file);
    if (phoneNumber) form.append("phone_number", phoneNumber);
    return client.post("/api/kyc/document", form);
  },
  verifyFace: (verificationId, frameBlobs) => {
    const form = new FormData();
    frameBlobs.forEach((blob, i) => form.append("frames", blob, `frame_${i}.jpg`));
    return client.post(`/api/kyc/face/${verificationId}`, form);
  },
  finalize: (verificationId) => client.post(`/api/kyc/finalize/${verificationId}`),
  mine: () => client.get("/api/kyc/mine"),
  getVerification: (id) => client.get(`/api/kyc/${id}`),
  getFullReport: (id) => client.get(`/api/kyc/${id}/full-report`),

  // Aadhaar Secure QR module (additional)
  getAadhaarQr: (id) => client.get(`/api/kyc/${id}/aadhaar-qr`),

  // Risk-based step-up flow (additional)
  getStepUp: (id) => client.get(`/api/kyc/${id}/step-up`),
  requestStepUpOtp: (id) => client.post(`/api/kyc/${id}/step-up/otp/request`),
  verifyStepUpOtp: (id, otp) => client.post(`/api/kyc/${id}/step-up/otp/verify`, { otp }),
  submitStepUpSelfie: (id, frameBlobs) => {
    const form = new FormData();
    frameBlobs.forEach((blob, i) => form.append("frames", blob, `frame_${i}.jpg`));
    return client.post(`/api/kyc/${id}/step-up/selfie`, form);
  },
  requestVideoKyc: (id) => client.post(`/api/kyc/${id}/step-up/video-kyc/request`),

  // Module 2 - device fingerprint + geo-velocity
  sendDeviceSignal: (verificationId, deviceFingerprint, phoneNumber) =>
    client.post(`/api/kyc/${verificationId}/device-signal`, {
      device_fingerprint: deviceFingerprint,
      phone_number: phoneNumber || null,
    }),

  // Module 1 - challenge-response liveness
  getChallenge: (verificationId) => client.get(`/api/kyc/${verificationId}/challenge`),
  submitChallenge: (verificationId, challengeType, framesBase64) =>
    client.post(`/api/kyc/${verificationId}/challenge`, {
      challenge_type: challengeType,
      frames_base64: framesBase64,
    }),

  // Module 3 - fraud network (admin only)
  getFraudNetwork: (verificationId) => client.get(`/api/fraud/${verificationId}/network`),

  adminStats: () => client.get("/api/admin/stats"),
  adminVerifications: (status) =>
    client.get("/api/admin/verifications", { params: status ? { status } : {} }),
  adminDecision: (id, status, admin_note) =>
    client.post(`/api/admin/verifications/${id}/decision`, { status, admin_note }),
  adminAuditLogs: (limit = 50) => client.get("/api/admin/audit-logs", { params: { limit } }),
  adminUsers: () => client.get("/api/admin/users"),

  // Manual review queue (additional module)
  listReviews: (status) => client.get("/api/reviews", { params: status ? { status } : {} }),
  createReview: (verificationId, reason, priority = "medium") =>
    client.post("/api/reviews", { verification_id: verificationId, reason, priority }),
  updateReview: (reviewId, payload) => client.patch(`/api/reviews/${reviewId}`, payload),

  // Video-KYC queue (additional module - risk-based step-up flow, admin side)
  listVideoKycQueue: (status) => client.get("/api/admin/video-kyc", { params: status ? { status } : {} }),
  assignVideoKyc: (entryId, agentId) => client.post(`/api/admin/video-kyc/${entryId}/assign`, { agent_id: agentId || null }),
  completeVideoKyc: (entryId, decision, notes) => client.post(`/api/admin/video-kyc/${entryId}/complete`, { decision, notes }),
  cancelVideoKyc: (entryId) => client.post(`/api/admin/video-kyc/${entryId}/cancel`),

  // KYC-as-a-service: API keys + webhooks (admin only)
  createApiKey: (name) => client.post("/api/integrations/api-keys", { name }),
  listApiKeys: () => client.get("/api/integrations/api-keys"),
  revokeApiKey: (id) => client.delete(`/api/integrations/api-keys/${id}`),
  createWebhook: (apiKeyId, url) => client.post("/api/integrations/webhooks", { api_key_id: apiKeyId, url }),
  listWebhooks: () => client.get("/api/integrations/webhooks"),
  revokeWebhook: (id) => client.delete(`/api/integrations/webhooks/${id}`),
  webhookDeliveries: (id) => client.get(`/api/integrations/webhooks/${id}/deliveries`),

  // Status notifications log (admin only)
  notificationLog: () => client.get("/api/integrations/notifications"),
};

export default client;
