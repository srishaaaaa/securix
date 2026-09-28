import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, ShieldAlert, Gauge, ChevronDown, Check, X, Clock, ScrollText, Flag, UserCog, Network,
  Plug, Key, Copy, Trash2, Bell, Video, CheckCircle2, XCircle, Activity, ArrowUpRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Counter, LitCard, MaskLines, PageShell, Reveal, SysLabel } from "../components/ui/motion";

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
    <PageShell className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 grid-overlay opacity-40" />

      <div className="relative mb-10 flex flex-col justify-between gap-6 sm:mb-12 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <SysLabel live>SECURIX / Security operations</SysLabel>
            <SysLabel tone="muted">Risk engine / active</SysLabel>
          </div>
          <h1 className="mt-4 font-display text-huge font-semibold uppercase text-ink-50">
            <MaskLines lines={["Security", <span key="c" className="text-ink-500">operations.</span>]} delay={0.1} />
          </h1>
        </div>
        <p className="max-w-sm text-sm text-ink-300">Fraud monitoring, risk breakdown, and manual review queue.</p>
      </div>

      {/* operations counters (derived from stats.by_status / stats.by_risk_band) */}
      <div className="relative mb-3 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        <StatCard label="Total verifications" value={stats?.total_verifications ?? "—"} Icon={Activity} color="#9db0ff" edge />
        <StatCard label="Approved" value={stats ? stats.by_status?.approved ?? 0 : "—"} Icon={CheckCircle2} color="#35d99a" />
        <StatCard label="Review" value={stats ? stats.by_status?.under_review ?? 0 : "—"} Icon={Clock} color="#f3ad4b" />
        <StatCard label="Rejected" value={stats ? stats.by_status?.rejected ?? 0 : "—"} Icon={XCircle} color="#ff5468" />
        <StatCard label="High risk" value={stats ? stats.by_risk_band?.high ?? 0 : "—"} Icon={ShieldAlert} color="#ff5468" />
      </div>

      {/* stat cards */}
      <div className="relative mb-5 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total users" value={stats?.total_users ?? "—"} Icon={Users} color="#9db0ff" />
        <StatCard label="Avg. risk score" value={stats?.average_risk_score ?? "—"} Icon={Gauge} color="#f3ad4b" />
        <StatCard label="Fraud flags" value={stats?.fraud_flag_count ?? "—"} Icon={ShieldAlert} color="#ff5468" />
      </div>

      {/* charts */}
      <div className="relative mb-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal className="glass-panel rounded-[1.5rem] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="eyebrow">Risk band distribution</h3>
            <span className="font-mono text-[10px] text-ink-700">RISK / BAND</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-8">
            <ResponsiveContainer width="55%" height={170}>
              <PieChart>
                <Pie data={bandData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={74} paddingAngle={3} strokeWidth={0}>
                  {bandData.map((entry) => (
                    <Cell key={entry.name} fill={BAND_COLORS[entry.name] || "#737b91"} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#eef0f6" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {bandData.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAND_COLORS[d.name] }} />
                  <span className="w-16 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">{d.name}</span>
                  <span className="font-display text-lg font-semibold text-ink-50">{d.value}</span>
                </div>
              ))}
              {bandData.length === 0 && <p className="text-xs text-ink-500">No data yet</p>}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="glass-panel rounded-[1.5rem] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="eyebrow">Decisions by status</h3>
            <span className="font-mono text-[10px] text-ink-700">STATUS / COUNT</span>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#737b91", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#737b91", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#eef0f6" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={48}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#737b91"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Reveal>
      </div>

      {/* tabs */}
      <div className="no-scrollbar relative -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-full border border-white/[0.07] bg-void-850/70 p-1 backdrop-blur" role="tablist">
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
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "verifications" ? (
            <div className="glass-panel overflow-hidden rounded-[1.5rem]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
                <span className="text-sm font-medium text-ink-50">All verifications</span>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by status"
                    className="appearance-none rounded-full border border-white/[0.1] bg-void-850 py-2 pl-4 pr-9 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-300 outline-none transition focus:border-accent-soft/50"
                  >
                    <option value="">All statuses</option>
                    <option value="approved">Approved</option>
                    <option value="under_review">Under review</option>
                    <option value="rejected">Rejected</option>
                    <option value="pending">Pending</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
                </div>
              </div>

              {/* desktop / laptop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                      <th className="px-5 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Risk score</th>
                      <th className="px-4 py-3 font-medium">Band</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Flags</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((v) => (
                      <Fragment key={v.id}>
                        <motion.tr
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: Math.min(verifications.indexOf(v), 12) * 0.04 }}
                          className={`group cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.025] ${selected === v.id ? "bg-white/[0.03]" : ""}`}
                          onClick={() => setSelected(selected === v.id ? null : v.id)}
                        >
                          <td className="px-5 py-3.5 capitalize text-ink-300">
                            <span className="flex items-center gap-2">
                              <ChevronDown className={`h-3.5 w-3.5 text-ink-700 transition-transform ${selected === v.id ? "rotate-180 text-ink-300" : ""}`} />
                              {v.document_type?.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-ink-50">{v.ocr_name || "—"}</td>
                          <td className="px-4 py-3.5">
                            <RiskCell score={v.risk_score} band={v.risk_band} />
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: BAND_COLORS[v.risk_band] || "#737b91" }}>
                            {v.risk_band || "—"}
                          </td>
                          <td className="px-4 py-3.5"><StatusBadge status={v.status} size="sm" /></td>
                          <td className="px-4 py-3.5"><FlagCells v={v} /></td>
                          <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <RowActions v={v} decide={decide} queueForReview={queueForReview} navigate={navigate} />
                          </td>
                        </motion.tr>
                        <AnimatePresence initial={false}>
                          {selected === v.id && (
                            <tr>
                              <td colSpan={7} className="p-0">
                                <RowDetail v={v} />
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* phone cards */}
              <div className="divide-y divide-white/[0.05] md:hidden">
                {verifications.map((v) => (
                  <div key={v.id} className="px-4 py-4">
                    <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setSelected(selected === v.id ? null : v.id)} aria-expanded={selected === v.id}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-50">{v.ocr_name || "—"}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{v.document_type?.replace("_", " ")}</p>
                      </div>
                      <RiskCell score={v.risk_score} band={v.risk_band} />
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={v.status} size="sm" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: BAND_COLORS[v.risk_band] || "#737b91" }}>
                        {v.risk_band || "—"}
                      </span>
                      <FlagCells v={v} />
                    </div>
                    <AnimatePresence initial={false}>{selected === v.id && <RowDetail v={v} />}</AnimatePresence>
                    <div className="mt-3">
                      <RowActions v={v} decide={decide} queueForReview={queueForReview} navigate={navigate} align="start" />
                    </div>
                  </div>
                ))}
              </div>

              {!loading && verifications.length === 0 && (
                <p className="px-4 py-12 text-center text-sm text-ink-500">No verifications match this filter.</p>
              )}
            </div>
          ) : tab === "audit" ? (
            <div className="glass-panel overflow-hidden rounded-[1.5rem]">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="sticky top-0 bg-void-850/95 backdrop-blur">
                    <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                      <th className="px-5 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                      <th className="px-5 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((l) => (
                      <tr key={l.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent-soft">{l.action}</td>
                        <td className="px-4 py-3 text-ink-300">{l.detail}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-ink-500">{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === "review" ? (
            <div className="glass-panel overflow-hidden rounded-[1.5rem]">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="sticky top-0 bg-void-850/95 backdrop-blur">
                    <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                      <th className="px-5 py-3 font-medium">Verification</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Queued</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((r) => (
                      <tr key={r.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-mono text-xs text-ink-300">{r.verification_id.slice(0, 8)}…</td>
                        <td className="px-4 py-3 text-ink-300">{r.reason || "—"}</td>
                        <td className="px-4 py-3 capitalize text-ink-50">{r.priority}</td>
                        <td className="px-4 py-3 capitalize text-ink-50">{r.status.replace("_", " ")}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-ink-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1.5">
                            {r.status !== "in_progress" && (
                              <ActionIcon title="Start review" onClick={() => advanceReview(r.id, "in_progress")} color="#f3ad4b" Icon={Clock} />
                            )}
                            {r.status !== "completed" && (
                              <ActionIcon title="Mark completed" onClick={() => advanceReview(r.id, "completed")} color="#35d99a" Icon={Check} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reviews.length === 0 && (
                  <p className="px-4 py-12 text-center text-sm text-ink-500">No verifications queued for manual review.</p>
                )}
              </div>
            </div>
          ) : tab === "video_kyc" ? (
            <div className="glass-panel overflow-hidden rounded-[1.5rem]">
              <div className="flex flex-col gap-1 border-b border-white/[0.06] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-ink-50">Live video-KYC queue</span>
                <span className="text-xs text-ink-500">High-risk verifications routed here instead of an automatic rejection</span>
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="sticky top-0 bg-void-850/95 backdrop-blur">
                    <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                      <th className="px-5 py-3 font-medium">Verification</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Agent notes</th>
                      <th className="px-4 py-3 font-medium">Queued</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videoKycQueue.map((q) => (
                      <tr key={q.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3">
                          <button
                            onClick={() => navigate(`/verification-progress/${q.verification_id}`)}
                            className="font-mono text-xs text-accent-soft underline-offset-4 hover:underline"
                          >
                            {q.verification_id.slice(0, 8)}…
                          </button>
                        </td>
                        <td className="px-4 py-3 capitalize text-ink-50">{q.status.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-ink-300">{q.agent_notes || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-ink-500">{new Date(q.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1.5">
                            {q.status === "waiting" && (
                              <ActionIcon title="Assign to me / start call" onClick={() => assignVideoKyc(q.id)} color="#9db0ff" Icon={Video} />
                            )}
                            {q.status !== "completed" && q.status !== "cancelled" && (
                              <>
                                <ActionIcon title="Approve after call" onClick={() => completeVideoKyc(q.id, "approved")} color="#35d99a" Icon={Check} />
                                <ActionIcon title="Reject after call" onClick={() => completeVideoKyc(q.id, "rejected")} color="#ff5468" Icon={X} />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {videoKycQueue.length === 0 && (
                  <p className="px-4 py-12 text-center text-sm text-ink-500">No verifications currently in the video-KYC queue.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* API keys */}
              <div className="glass-panel rounded-[1.5rem] p-5 sm:p-6">
                <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-ink-50">
                  <Key className="h-4 w-4 text-accent-soft" /> API keys
                </h3>
                <p className="mb-5 text-xs text-ink-500">
                  Partners authenticate to <span className="font-mono">/api/v1/verifications</span> with an{" "}
                  <span className="font-mono">X-API-Key</span> header using one of these.
                </p>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name, e.g. Acme Bank sandbox"
                    aria-label="API key name"
                    className="field flex-1 !py-2.5"
                  />
                  <button onClick={createKey} className="btn btn-primary">
                    <Key className="h-3.5 w-3.5" /> Create key
                  </button>
                </div>

                {newKeyReveal && (
                  <div className="mb-4 rounded-2xl border border-signal-emerald/25 bg-signal-emerald/[0.07] p-4">
                    <p className="mb-2 text-xs font-semibold text-signal-emerald">
                      Copy this now — it won't be shown again:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded-lg bg-void-950 px-3 py-2 text-xs text-ink-50">
                        {newKeyReveal.api_key}
                      </code>
                      <button onClick={() => navigator.clipboard.writeText(newKeyReveal.api_key)} title="Copy" aria-label="Copy API key" className="rounded-lg p-2 text-ink-500 transition hover:bg-white/[0.05] hover:text-ink-50">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                        <th className="py-2 font-medium">Name</th>
                        <th className="py-2 font-medium">Prefix</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 font-medium">Last used</th>
                        <th className="py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((k) => (
                        <tr key={k.id} className="border-t border-white/[0.04]">
                          <td className="py-2.5 text-ink-50">{k.name}</td>
                          <td className="py-2.5 font-mono text-xs text-ink-500">{k.key_prefix}…</td>
                          <td className="py-2.5 text-ink-300">{k.is_active ? "Active" : "Revoked"}</td>
                          <td className="py-2.5 font-mono text-[11px] text-ink-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</td>
                          <td className="py-2.5 text-right">
                            {k.is_active && (
                              <span className="inline-flex">
                                <ActionIcon title="Revoke" onClick={() => api.revokeApiKey(k.id).then(refreshIntegrations)} color="#ff5468" Icon={Trash2} />
                              </span>
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
              </div>

              {/* Webhooks */}
              <div className="glass-panel rounded-[1.5rem] p-5 sm:p-6">
                <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-ink-50">
                  <Plug className="h-4 w-4 text-violet-soft" /> Webhooks
                </h3>
                <p className="mb-5 text-xs text-ink-500">
                  Fires a signed <span className="font-mono">verification.completed</span> /{" "}
                  <span className="font-mono">verification.status_changed</span> POST, signed with HMAC-SHA256 in the{" "}
                  <span className="font-mono">X-Securix-Signature</span> header.
                </p>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <select
                    value={newWebhookKeyId}
                    onChange={(e) => setNewWebhookKeyId(e.target.value)}
                    aria-label="API key for webhook"
                    className="field !w-auto !py-2.5"
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
                    aria-label="Webhook URL"
                    className="field min-w-0 flex-1 !py-2.5 sm:min-w-[240px]"
                  />
                  <button onClick={createWebhook} className="btn btn-accent-ghost">
                    <Plug className="h-3.5 w-3.5" /> Register
                  </button>
                </div>

                {newWebhookReveal && (
                  <div className="mb-4 rounded-2xl border border-signal-emerald/25 bg-signal-emerald/[0.07] p-4">
                    <p className="mb-2 text-xs font-semibold text-signal-emerald">
                      Signing secret — copy this now, it won't be shown again:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded-lg bg-void-950 px-3 py-2 text-xs text-ink-50">
                        {newWebhookReveal.secret}
                      </code>
                      <button onClick={() => navigator.clipboard.writeText(newWebhookReveal.secret)} title="Copy" aria-label="Copy signing secret" className="rounded-lg p-2 text-ink-500 transition hover:bg-white/[0.05] hover:text-ink-50">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left text-sm">
                    <thead>
                      <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                        <th className="py-2 font-medium">URL</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhooksList.map((w) => (
                        <tr key={w.id} className="border-t border-white/[0.04]">
                          <td className="py-2.5 font-mono text-xs text-ink-300">{w.url}</td>
                          <td className="py-2.5 text-ink-300">{w.is_active ? "Active" : "Revoked"}</td>
                          <td className="py-2.5 text-right">
                            {w.is_active && (
                              <span className="inline-flex">
                                <ActionIcon title="Revoke" onClick={() => api.revokeWebhook(w.id).then(refreshIntegrations)} color="#ff5468" Icon={Trash2} />
                              </span>
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
              </div>

              {/* Notification log */}
              <div className="glass-panel rounded-[1.5rem] p-5 sm:p-6">
                <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-ink-50">
                  <Bell className="h-4 w-4 text-signal-amber" /> Status notifications
                </h3>
                <p className="mb-5 text-xs text-ink-500">
                  Email/SMS sent on status changes. Without SMTP/Twilio credentials configured on the server,
                  attempts are logged as <span className="font-mono">skipped_not_configured</span> rather than failing silently.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
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
                          <td className="py-2.5 font-mono text-[11px] uppercase text-ink-300">{n.channel}</td>
                          <td className="py-2.5 text-ink-300">{n.recipient || "—"}</td>
                          <td className={`py-2.5 ${n.status === "sent" ? "text-signal-emerald" : n.status === "failed" ? "text-signal-crimson" : "text-ink-500"}`}>
                            {n.status.replaceAll("_", " ")}
                          </td>
                          <td className="py-2.5 text-xs text-ink-500">{n.detail || "—"}</td>
                          <td className="py-2.5 font-mono text-[11px] text-ink-500">{new Date(n.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                      {notifications.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-xs text-ink-500">No notifications sent yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}

const TOOLTIP_STYLE = {
  background: "rgba(14,16,22,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  fontSize: 12,
  fontFamily: "JetBrains Mono",
  color: "#eef0f6",
};

function StatCard({ label, value, Icon, color, edge = false }) {
  return (
    <LitCard className={`${edge ? "glass-4 edge-light" : "glass-panel"} relative overflow-hidden rounded-[1.5rem] p-4 sm:p-6`}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl" style={{ background: `${color}18` }} />
      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="relative mt-4 font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
        <Counter value={value} />
      </p>
    </LitCard>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors ${
        active ? "text-void-900" : "text-ink-500 hover:text-ink-100"
      }`}
    >
      {active && (
        <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-ink-50" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
      )}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

function ActionIcon({ title, onClick, color, Icon }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.04]"
      style={{ color }}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function RiskCell({ score, band }) {
  const color = BAND_COLORS[band] || "#737b91";
  const pct = Math.max(0, Math.min(100, score ?? 0));
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-display text-base font-semibold tabular-nums text-ink-50">{score?.toFixed(1)}</span>
      <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-white/[0.06] sm:block">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  );
}

function FlagCells({ v }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {(v.duplicate_identity_flag || v.manipulation_flag) ? (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-signal-crimson">
          <ShieldAlert className="h-3.5 w-3.5" /> flagged
        </span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500">clean</span>
      )}
      {v.forgery_score >= 60 && (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-signal-amber" title={v.forgery_indicators}>
          <Flag className="h-3.5 w-3.5" /> forgery signals
        </span>
      )}
    </span>
  );
}

function RowActions({ v, decide, queueForReview, navigate, align = "end" }) {
  return (
    <div className={`flex gap-1.5 ${align === "end" ? "justify-end" : "justify-start"}`}>
      <ActionIcon title="Approve" onClick={() => decide(v.id, "approved")} color="#35d99a" Icon={Check} />
      <ActionIcon title="Under review" onClick={() => decide(v.id, "under_review")} color="#f3ad4b" Icon={Clock} />
      <ActionIcon title="Reject" onClick={() => decide(v.id, "rejected")} color="#ff5468" Icon={X} />
      <ActionIcon title="Queue for manual review" onClick={() => queueForReview(v.id)} color="#9db0ff" Icon={UserCog} />
      <ActionIcon title="View fraud network" onClick={() => navigate(`/fraud-network/${v.id}`)} color="#b9a4ff" Icon={Network} />
    </div>
  );
}

/** Expanded row: extra fields already present on the verification object. */
function RowDetail({ v }) {
  const items = [
    ["Verification ID", String(v.id)],
    ["Created", v.created_at ? new Date(v.created_at).toLocaleString() : "—"],
    ["Forgery score", typeof v.forgery_score === "number" ? `${v.forgery_score}%` : "—"],
    ["OCR confidence", typeof v.ocr_confidence === "number" ? `${Math.round(v.ocr_confidence)}%` : "—"],
    ["Face match", typeof v.face_match_score === "number" ? `${Math.round(v.face_match_score)}%` : "—"],
    ["Liveness", typeof v.liveness_score === "number" ? `${Math.round(v.liveness_score)}%` : "—"],
  ];
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="mx-0 my-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.05] bg-void-950/40 p-3 md:mx-5 md:grid-cols-6">
        {items.map(([k, val]) => (
          <div key={k} className="min-w-0 px-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">{k}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-ink-100">{val}</p>
          </div>
        ))}
        {v.forgery_indicators && (
          <p className="col-span-2 px-1 text-[11px] text-signal-amber md:col-span-6">{v.forgery_indicators}</p>
        )}
        {v.fraud_notes && <p className="col-span-2 px-1 text-[11px] text-ink-300 md:col-span-6">{v.fraud_notes}</p>}
        <div className="col-span-2 px-1 pt-1 md:col-span-6">
          <Link to={`/verification-progress/${v.id}`} className="btn btn-ghost btn-sm">
            Open report <ArrowUpRight className="btn-arrow h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
