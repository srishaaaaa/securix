import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, ShieldAlert, Gauge, ListChecks, ChevronDown, Check, X, Clock, ScrollText, Flag, UserCog, Network,
  Plug, Key, Copy, Trash2, Bell, Video,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";

const BAND_COLORS = { low: "#5b6ef5", medium: "#f0a63a", high: "#f2495c" };
const STATUS_COLORS = { approved: "#2fd487", under_review: "#f0a63a", rejected: "#f2495c", pending: "#727a90" };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("verifications");
  const [auditLogs, setAuditLogs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooksList, setWebhooksList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [videoKycQueue, setVideoKycQueue] = useState([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyReveal, setNewKeyReveal] = useState(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookKeyId, setNewWebhookKeyId] = useState("");
  const [newWebhookReveal, setNewWebhookReveal] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    Promise.all([api.adminStats(), api.adminVerifications(statusFilter)]).then(([s, v]) => {
      setStats(s.data);
      setVerifications(v.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (tab === "audit") {
      api.adminAuditLogs(100).then((res) => setAuditLogs(res.data));
    }
    if (tab === "review") {
      api.listReviews().then((res) => setReviews(res.data));
    }
    if (tab === "integrations") {
      refreshIntegrations();
    }
    if (tab === "video_kyc") {
      api.listVideoKycQueue().then((res) => setVideoKycQueue(res.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const refreshIntegrations = () => {
    api.listApiKeys().then((res) => setApiKeys(res.data));
    api.listWebhooks().then((res) => setWebhooksList(res.data));
    api.notificationLog().then((res) => setNotifications(res.data));
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await api.createApiKey(newKeyName.trim());
    setNewKeyReveal(res.data); // shown once - the raw key is never retrievable again
    setNewKeyName("");
    refreshIntegrations();
  };

  const createWebhook = async () => {
    if (!newWebhookKeyId || !newWebhookUrl.trim()) return;
    const res = await api.createWebhook(newWebhookKeyId, newWebhookUrl.trim());
    setNewWebhookReveal(res.data); // shown once - the signing secret is never retrievable again
    setNewWebhookUrl("");
    refreshIntegrations();
  };

  const decide = async (id, status) => {
    await api.adminDecision(id, status, `Manually set to ${status} by admin`);
    loadData();
    setSelected(null);
  };

  const queueForReview = async (id) => {
    await api.createReview(id, "Flagged from verifications list", "medium");
    if (tab === "review") api.listReviews().then((res) => setReviews(res.data));
  };

  const advanceReview = async (reviewId, status) => {
    await api.updateReview(reviewId, { status });
    api.listReviews().then((res) => setReviews(res.data));
  };

  const refreshVideoKyc = () => api.listVideoKycQueue().then((res) => setVideoKycQueue(res.data));

  const assignVideoKyc = async (entryId) => {
    await api.assignVideoKyc(entryId);
    refreshVideoKyc();
  };

  const completeVideoKyc = async (entryId, decision) => {
    const notes = window.prompt(`Notes for this ${decision} decision (optional):`, "") || "";
    await api.completeVideoKyc(entryId, decision, notes);
    refreshVideoKyc();
    loadData();
  };

  const bandData = stats ? Object.entries(stats.by_risk_band).map(([name, value]) => ({ name, value })) : [];
  const statusData = stats ? Object.entries(stats.by_status).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="mb-10">
        <h1 className="font-display text-2xl font-semibold text-ink-100 sm:text-3xl">Admin console</h1>
        <p className="mt-1.5 text-sm text-ink-300">Fraud monitoring, risk breakdown, and manual review queue.</p>
      </div>

      {/* stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={stats?.total_users ?? "—"} Icon={Users} color="#5b6ef5" />
        <StatCard label="Verifications" value={stats?.total_verifications ?? "—"} Icon={ListChecks} color="#5b6ef5" />
        <StatCard label="Avg. risk score" value={stats?.average_risk_score ?? "—"} Icon={Gauge} color="#f0a63a" />
        <StatCard label="Fraud flags" value={stats?.fraud_flag_count ?? "—"} Icon={ShieldAlert} color="#f2495c" />
      </div>

      {/* charts */}
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl glass-panel p-6 shadow-soft">
          <h3 className="mb-4 font-display text-sm font-semibold text-ink-100">Risk band distribution</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={160}>
              <PieChart>
                <Pie data={bandData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {bandData.map((entry) => (
                    <Cell key={entry.name} fill={BAND_COLORS[entry.name] || "#727a90"} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#181c28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {bandData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BAND_COLORS[d.name] }} />
                  <span className="capitalize text-ink-300">{d.name}</span>
                  <span className="font-medium text-ink-100">{d.value}</span>
                </div>
              ))}
              {bandData.length === 0 && <p className="text-xs text-ink-500">No data yet</p>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass-panel p-6 shadow-soft">
          <h3 className="mb-4 font-display text-sm font-semibold text-ink-100">Decisions by status</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#727a90", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#727a90", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#181c28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#727a90"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-void-800/60 p-1 ring-1 ring-white/[0.05]">
        <TabButton active={tab === "verifications"} onClick={() => setTab("verifications")}>Verifications</TabButton>
        <TabButton active={tab === "audit"} onClick={() => setTab("audit")}>
          <ScrollText className="h-3.5 w-3.5" /> Audit log
        </TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")}>
          <UserCog className="h-3.5 w-3.5" /> Review queue
        </TabButton>
        <TabButton active={tab === "video_kyc"} onClick={() => setTab("video_kyc")}>
          <Video className="h-3.5 w-3.5" /> Video-KYC queue
        </TabButton>
        <TabButton active={tab === "integrations"} onClick={() => setTab("integrations")}>
          <Plug className="h-3.5 w-3.5" /> Integrations
        </TabButton>
      </div>

      {tab === "verifications" ? (
        <div className="rounded-2xl glass-panel p-2 shadow-soft">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <span className="text-sm font-medium text-ink-100">All verifications</span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none rounded-lg border border-white/[0.08] bg-void-800 py-1.5 pl-3 pr-8 text-xs text-ink-300 outline-none focus:border-accent/40"
              >
                <option value="">All statuses</option>
                <option value="approved">Approved</option>
                <option value="under_review">Under review</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Risk score</th>
                  <th className="px-4 py-3 font-medium">Band</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {verifications.map((v) => (
                  <tr key={v.id} className="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 capitalize text-ink-300">{v.document_type?.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-ink-100">{v.ocr_name || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink-100">{v.risk_score?.toFixed(1)}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: BAND_COLORS[v.risk_band] || "#727a90" }}>
                      {v.risk_band || "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} size="sm" /></td>
                    <td className="px-4 py-3">
                      {(v.duplicate_identity_flag || v.manipulation_flag) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-signal-crimson">
                          <ShieldAlert className="h-3.5 w-3.5" /> flagged
                        </span>
                      ) : (
                        <span className="text-xs text-ink-500">clean</span>
                      )}
                      {v.forgery_score >= 60 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-signal-amber" title={v.forgery_indicators}>
                          <Flag className="h-3.5 w-3.5" /> forgery signals
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <ActionIcon title="Approve" onClick={() => decide(v.id, "approved")} color="#2fd487" Icon={Check} />
                        <ActionIcon title="Under review" onClick={() => decide(v.id, "under_review")} color="#f0a63a" Icon={Clock} />
                        <ActionIcon title="Reject" onClick={() => decide(v.id, "rejected")} color="#f2495c" Icon={X} />
                        <ActionIcon title="Queue for manual review" onClick={() => queueForReview(v.id)} color="#5b6ef5" Icon={UserCog} />
                        <ActionIcon title="View fraud network" onClick={() => navigate(`/fraud-network/${v.id}`)} color="#b794f7" Icon={Network} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && verifications.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-ink-500">No verifications match this filter.</p>
            )}
          </div>
        </div>
      ) : tab === "audit" ? (
        <div className="rounded-2xl glass-panel p-2 shadow-soft">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="sticky top-0 bg-void-800/95 backdrop-blur">
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l) => (
                  <tr key={l.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-accent-soft">{l.action}</td>
                    <td className="px-4 py-3 text-ink-300">{l.detail}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "review" ? (
        <div className="rounded-2xl glass-panel p-2 shadow-soft">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 bg-void-800/95 backdrop-blur">
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-medium">Verification</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Queued</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-xs text-ink-300">{r.verification_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-ink-300">{r.reason || "—"}</td>
                    <td className="px-4 py-3 capitalize text-ink-100">{r.priority}</td>
                    <td className="px-4 py-3 capitalize text-ink-100">{r.status.replace("_", " ")}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.status !== "in_progress" && (
                          <ActionIcon title="Start review" onClick={() => advanceReview(r.id, "in_progress")} color="#f0a63a" Icon={Clock} />
                        )}
                        {r.status !== "completed" && (
                          <ActionIcon title="Mark completed" onClick={() => advanceReview(r.id, "completed")} color="#2fd487" Icon={Check} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reviews.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-ink-500">No verifications queued for manual review.</p>
            )}
          </div>
        </div>
      ) : tab === "video_kyc" ? (
        <div className="rounded-2xl glass-panel p-2 shadow-soft">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <span className="text-sm font-medium text-ink-100">Live video-KYC queue</span>
            <span className="text-xs text-ink-500">High-risk verifications routed here instead of an automatic rejection</span>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 bg-void-800/95 backdrop-blur">
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-medium">Verification</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Agent notes</th>
                  <th className="px-4 py-3 font-medium">Queued</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {videoKycQueue.map((q) => (
                  <tr key={q.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/verification-progress/${q.verification_id}`)}
                        className="font-mono text-xs text-accent-soft hover:underline"
                      >
                        {q.verification_id.slice(0, 8)}…
                      </button>
                    </td>
                    <td className="px-4 py-3 capitalize text-ink-100">{q.status.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-ink-300">{q.agent_notes || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{new Date(q.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {q.status === "waiting" && (
                          <ActionIcon title="Assign to me / start call" onClick={() => assignVideoKyc(q.id)} color="#5b6ef5" Icon={Video} />
                        )}
                        {q.status !== "completed" && q.status !== "cancelled" && (
                          <>
                            <ActionIcon title="Approve after call" onClick={() => completeVideoKyc(q.id, "approved")} color="#2fd487" Icon={Check} />
                            <ActionIcon title="Reject after call" onClick={() => completeVideoKyc(q.id, "rejected")} color="#f2495c" Icon={X} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {videoKycQueue.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-ink-500">No verifications currently in the video-KYC queue.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* API keys */}
          <div className="rounded-2xl glass-panel p-6 shadow-soft">
            <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-ink-100">
              <Key className="h-4 w-4 text-accent-soft" /> API keys
            </h3>
            <p className="mb-4 text-xs text-ink-500">
              Partners authenticate to <span className="font-mono">/api/v1/verifications</span> with an{" "}
              <span className="font-mono">X-API-Key</span> header using one of these.
            </p>

            <div className="mb-4 flex gap-2">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name, e.g. Acme Bank sandbox"
                className="flex-1 rounded-lg border border-white/[0.08] bg-void-800/50 px-3.5 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:border-accent/40 focus:outline-none"
              />
              <button
                onClick={createKey}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2 text-sm font-semibold text-white shadow-glow hover:brightness-110"
              >
                <Key className="h-3.5 w-3.5" /> Create key
              </button>
            </div>

            {newKeyReveal && (
              <div className="mb-4 rounded-lg bg-signal-emerald/10 p-3.5 ring-1 ring-inset ring-signal-emerald/25">
                <p className="mb-1.5 text-xs font-semibold text-signal-emerald">
                  Copy this now — it won't be shown again:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-void-950 px-2.5 py-1.5 text-xs text-ink-100">
                    {newKeyReveal.api_key}
                  </code>
                  <button onClick={() => navigator.clipboard.writeText(newKeyReveal.api_key)} title="Copy">
                    <Copy className="h-3.5 w-3.5 text-ink-500 hover:text-ink-100" />
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Prefix</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Last used</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id} className="border-t border-white/[0.04]">
                    <td className="py-2 text-ink-100">{k.name}</td>
                    <td className="py-2 font-mono text-xs text-ink-500">{k.key_prefix}…</td>
                    <td className="py-2 text-ink-300">{k.is_active ? "Active" : "Revoked"}</td>
                    <td className="py-2 text-xs text-ink-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</td>
                    <td className="py-2 text-right">
                      {k.is_active && (
                        <ActionIcon title="Revoke" onClick={() => api.revokeApiKey(k.id).then(refreshIntegrations)} color="#f2495c" Icon={Trash2} />
                      )}
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-ink-500">No API keys yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Webhooks */}
          <div className="rounded-2xl glass-panel p-6 shadow-soft">
            <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-ink-100">
              <Plug className="h-4 w-4 text-violet-soft" /> Webhooks
            </h3>
            <p className="mb-4 text-xs text-ink-500">
              Fires a signed <span className="font-mono">verification.completed</span> /{" "}
              <span className="font-mono">verification.status_changed</span> POST, signed with HMAC-SHA256 in the{" "}
              <span className="font-mono">X-Securix-Signature</span> header.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={newWebhookKeyId}
                onChange={(e) => setNewWebhookKeyId(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-void-800/50 px-3 py-2 text-sm text-ink-100 focus:border-accent/40 focus:outline-none"
              >
                <option value="">Select API key…</option>
                {apiKeys.filter((k) => k.is_active).map((k) => (
                  <option key={k.id} value={k.id}>{k.name} ({k.key_prefix}…)</option>
                ))}
              </select>
              <input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://partner.example.com/webhooks/securix"
                className="min-w-[240px] flex-1 rounded-lg border border-white/[0.08] bg-void-800/50 px-3.5 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:border-accent/40 focus:outline-none"
              />
              <button
                onClick={createWebhook}
                className="flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                <Plug className="h-3.5 w-3.5" /> Register
              </button>
            </div>

            {newWebhookReveal && (
              <div className="mb-4 rounded-lg bg-signal-emerald/10 p-3.5 ring-1 ring-inset ring-signal-emerald/25">
                <p className="mb-1.5 text-xs font-semibold text-signal-emerald">
                  Signing secret — copy this now, it won't be shown again:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-void-950 px-2.5 py-1.5 text-xs text-ink-100">
                    {newWebhookReveal.secret}
                  </code>
                  <button onClick={() => navigator.clipboard.writeText(newWebhookReveal.secret)} title="Copy">
                    <Copy className="h-3.5 w-3.5 text-ink-500 hover:text-ink-100" />
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="py-2 font-medium">URL</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooksList.map((w) => (
                  <tr key={w.id} className="border-t border-white/[0.04]">
                    <td className="py-2 font-mono text-xs text-ink-300">{w.url}</td>
                    <td className="py-2 text-ink-300">{w.is_active ? "Active" : "Revoked"}</td>
                    <td className="py-2 text-right">
                      {w.is_active && (
                        <ActionIcon title="Revoke" onClick={() => api.revokeWebhook(w.id).then(refreshIntegrations)} color="#f2495c" Icon={Trash2} />
                      )}
                    </td>
                  </tr>
                ))}
                {webhooksList.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-xs text-ink-500">No webhooks registered yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Notification log */}
          <div className="rounded-2xl glass-panel p-6 shadow-soft">
            <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-ink-100">
              <Bell className="h-4 w-4 text-signal-amber" /> Status notifications
            </h3>
            <p className="mb-4 text-xs text-ink-500">
              Email/SMS sent on status changes. Without SMTP/Twilio credentials configured on the server,
              attempts are logged as <span className="font-mono">skipped_not_configured</span> rather than failing silently.
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="py-2 font-medium">Channel</th>
                  <th className="py-2 font-medium">Recipient</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Detail</th>
                  <th className="py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} className="border-t border-white/[0.04]">
                    <td className="py-2 uppercase text-ink-300">{n.channel}</td>
                    <td className="py-2 text-ink-300">{n.recipient || "—"}</td>
                    <td className={`py-2 ${n.status === "sent" ? "text-signal-emerald" : n.status === "failed" ? "text-signal-crimson" : "text-ink-500"}`}>
                      {n.status.replaceAll("_", " ")}
                    </td>
                    <td className="py-2 text-xs text-ink-500">{n.detail || "—"}</td>
                    <td className="py-2 text-xs text-ink-500">{new Date(n.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {notifications.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-ink-500">No notifications sent yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, color }) {
  return (
    <div className="rounded-2xl glass-panel p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="mt-2.5 font-display text-2xl font-semibold text-ink-100">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
        active ? "bg-accent/15 text-accent-soft" : "text-ink-500 hover:text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

function ActionIcon({ title, onClick, color, Icon }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/[0.08] transition hover:ring-white/[0.2]"
      style={{ color }}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
