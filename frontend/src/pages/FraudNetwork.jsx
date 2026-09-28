import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ShieldAlert, ShieldCheck, Smartphone, Phone, FileText, Loader2, X } from "lucide-react";
import { api } from "../api/client";
import Stage3D from "../components/three/Stage3D";
import { PageShell, SysLabel } from "../components/ui/motion";

const KIND_COLOR = { verification: "#5b6ef5", device: "#f0a63a", phone: "#b794f7", document: "#f2495c" };
const KIND_ICON = { device: Smartphone, phone: Phone, document: FileText };

/**
 * Additional Module 3 - Fraud Network.
 *
 * A small, self-contained force-directed layout (no external graph library)
 * that lays out nodes with a simple repulsion/spring simulation, then
 * renders as SVG. The anchor verification "explodes" outward into every
 * device/phone/document-number it shares with other verifications.
 */
export default function FraudNetwork() {
  const { id } = useParams();
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");
  const [positions, setPositions] = useState({});
  const svgSize = 640;

  useEffect(() => {
    api
      .getFraudNetwork(id)
      .then((res) => setGraph(res.data))
      .catch((err) => setError(err?.response?.data?.detail || "Couldn't load the fraud network."));
  }, [id]);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;
    setPositions(simulate(graph.nodes, graph.edges, svgSize));
  }, [graph]);

  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const selectedNode = graph?.nodes.find((n) => n.id === selectedId) || null;
  const neighbours = selectedNode
    ? graph.edges
        .filter((e) => e.source === selectedId || e.target === selectedId)
        .map((e) => graph.nodes.find((n) => n.id === (e.source === selectedId ? e.target : e.source)))
        .filter(Boolean)
    : [];

  return (
    <PageShell className="relative">
      <div className="relative mx-auto h-[calc(100svh-4.5rem)] min-h-[560px] max-w-[1800px] px-3 pb-3 sm:h-[calc(100svh-5rem)] sm:px-5 sm:pb-5">
        <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-void-950/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_45%,rgba(100,120,255,0.1),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 grid-overlay opacity-30" />

          {/* graph stage */}
          {graph && graph.nodes.length > 0 && (
            <Stage3D
              scene="network"
              interactive
              className="absolute inset-0"
              sceneProps={{
                graph,
                positions,
                size: svgSize,
                kindColor: KIND_COLOR,
                hoveredId,
                selectedId,
                onHover: setHoveredId,
                onSelect: setSelectedId,
              }}
              fallback={
                <div className="absolute inset-0 flex items-center justify-center p-6 pt-40 sm:p-16 sm:pt-32">
                  <svg viewBox={`0 0 ${svgSize} ${svgSize * 0.72}`} className="h-full w-full">
                    {graph.edges.map((e, i) => {
                      const s = positions[e.source];
                      const t = positions[e.target];
                      if (!s || !t) return null;
                      return (
                        <motion.line
                          key={i}
                          x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                          stroke="rgba(255,255,255,0.14)" strokeWidth={1.5}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ duration: 0.6, delay: i * 0.03 }}
                        />
                      );
                    })}
                    {graph.nodes.map((n, i) => {
                      const p = positions[n.id];
                      if (!p) return null;
                      const r = n.is_anchor ? 16 : 6 + Math.min(n.degree, 8);
                      return (
                        <motion.g
                          key={n.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 14, delay: i * 0.04 }}
                          onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <circle
                            cx={p.x} cy={p.y} r={r}
                            fill={KIND_COLOR[n.kind] || "#94a3b8"}
                            fillOpacity={n.is_anchor ? 0.9 : 0.55}
                            stroke={n.is_anchor || n.id === selectedId ? "#fff" : "none"}
                            strokeWidth={n.is_anchor || n.id === selectedId ? 2 : 0}
                          />
                          <title>{`${n.kind}: ${n.label}`}</title>
                        </motion.g>
                      );
                    })}
                  </svg>
                </div>
              }
            />
          )}

          {/* header overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-4 bg-gradient-to-b from-void-950/90 via-void-950/50 to-transparent p-5 pb-12 sm:flex-row sm:items-start sm:justify-between sm:p-7">
            <div className="pointer-events-auto">
              <Link to="/admin" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-ink-100">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
              </Link>
              <h1 className="mt-3 font-display text-big font-semibold uppercase text-ink-50">Identity network</h1>
              <p className="mt-1.5 max-w-md text-xs text-ink-300 sm:text-sm">
                Verifications sharing a device, phone number, or document number with this one.
              </p>
            </div>
            {graph && graph.nodes.length > 0 && (
              <div className="pointer-events-auto flex flex-col items-start gap-3 sm:items-end">
                {graph.flagged ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-signal-crimson/10 px-3.5 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-signal-crimson ring-1 ring-inset ring-signal-crimson/30">
                    <ShieldAlert className="h-3.5 w-3.5" /> {graph.linked_count} linked verifications — worth a look
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-signal-emerald/10 px-3.5 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-signal-emerald ring-1 ring-inset ring-signal-emerald/30">
                    <ShieldCheck className="h-3.5 w-3.5" /> {graph.linked_count} linked verifications — within normal range
                  </span>
                )}
                <div className="flex gap-5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  <span><span className="font-display text-base text-ink-50">{graph.nodes.length}</span> nodes</span>
                  <span><span className="font-display text-base text-ink-50">{graph.edges.length}</span> links</span>
                </div>
              </div>
            )}
          </div>

          {/* states */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p role="alert" className="alert-danger max-w-md justify-center text-center">
                {error}
              </p>
            </div>
          )}

          {!graph && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-7 w-7 animate-spin text-accent-soft" />
              <SysLabel live>Resolving identity graph</SysLabel>
            </div>
          )}

          {graph && graph.nodes.length === 0 && !error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="max-w-sm text-center text-sm text-ink-500">
                No device, phone, or document-number links found for this verification yet.
              </p>
            </div>
          )}

          {/* legend + hint */}
          {graph && graph.nodes.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-void-950/90 to-transparent p-5 pt-12 sm:flex-row sm:items-end sm:justify-between sm:p-7">
              <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
                <Legend color={KIND_COLOR.verification} label="Verification" />
                <Legend color={KIND_COLOR.device} label="Shared device" />
                <Legend color={KIND_COLOR.phone} label="Shared phone" />
                <Legend color={KIND_COLOR.document} label="Shared document #" />
              </div>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-700">
                <span className="hidden sm:inline">Drag to orbit · scroll to zoom · right-drag to pan · click a node</span>
                <span className="sm:hidden">Drag · pinch · tap a node</span>
              </p>
            </div>
          )}

          {/* selected node panel */}
          <AnimatePresence>
            {selectedNode && (
              <motion.aside
                key={selectedNode.id}
                initial={{ opacity: 0, x: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 24, filter: "blur(6px)" }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="glass-panel absolute bottom-24 left-3 right-3 max-h-[45%] overflow-y-auto rounded-2xl p-5 sm:bottom-auto sm:left-auto sm:right-6 sm:top-40 sm:w-80 sm:max-h-[60%]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10" style={{ color: KIND_COLOR[selectedNode.kind] || "#94a3b8" }}>
                      {(() => {
                        const Icon = KIND_ICON[selectedNode.kind] || ShieldCheck;
                        return <Icon className="h-4.5 w-4.5" />;
                      })()}
                    </span>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: KIND_COLOR[selectedNode.kind] || "#94a3b8" }}>
                        {selectedNode.kind}
                        {selectedNode.is_anchor ? " · anchor" : ""}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-ink-50">{selectedNode.label}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="rounded-full p-1.5 text-ink-500 transition hover:bg-white/5 hover:text-ink-50" aria-label="Close node details">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                    <p className="font-display text-xl font-semibold text-ink-50">{selectedNode.degree}</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Connections</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                    <p className="font-display text-xl font-semibold text-ink-50">{neighbours.length}</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Direct links</p>
                  </div>
                </div>
                {neighbours.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {neighbours.map((nb) => (
                      <li key={nb.id}>
                        <button
                          onClick={() => setSelectedId(nb.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
                        >
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: KIND_COLOR[nb.kind] || "#94a3b8" }} />
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">{nb.kind}</span>
                          <span className="truncate font-mono text-[11px] text-ink-100">{nb.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: color, color }} />
      {label}
    </span>
  );
}

/**
 * Minimal force-directed layout: repulsion between all nodes + spring
 * attraction along edges, run for a fixed number of ticks. Deliberately
 * simple (no external dependency) - fine for the small graphs this
 * feature produces (a handful to a few dozen nodes).
 */
function simulate(nodes, edges, size) {
  const pos = {};
  const cx = size / 2, cy = size * 0.36;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    pos[n.id] = { x: cx + Math.cos(angle) * 120, y: cy + Math.sin(angle) * 120 };
  });

  const anchor = nodes.find((n) => n.is_anchor);
  if (anchor) pos[anchor.id] = { x: cx, y: cy };

  for (let tick = 0; tick < 200; tick++) {
    const forces = {};
    nodes.forEach((n) => (forces[n.id] = { x: 0, y: 0 }));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = pos[a.id].x - pos[b.id].x;
        const dy = pos[a.id].y - pos[b.id].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const repel = 1800 / (dist * dist);
        forces[a.id].x += (dx / dist) * repel;
        forces[a.id].y += (dy / dist) * repel;
        forces[b.id].x -= (dx / dist) * repel;
        forces[b.id].y -= (dy / dist) * repel;
      }
    }

    edges.forEach((e) => {
      const a = pos[e.source], b = pos[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const targetDist = 90;
      const pull = (dist - targetDist) * 0.02;
      forces[e.source].x += (dx / dist) * pull;
      forces[e.source].y += (dy / dist) * pull;
      forces[e.target].x -= (dx / dist) * pull;
      forces[e.target].y -= (dy / dist) * pull;
    });

    nodes.forEach((n) => {
      if (n.is_anchor) return; // keep the anchor fixed at center
      pos[n.id].x += forces[n.id].x;
      pos[n.id].y += forces[n.id].y;
      pos[n.id].x = Math.max(30, Math.min(size - 30, pos[n.id].x));
      pos[n.id].y = Math.max(30, Math.min(size * 0.72 - 30, pos[n.id].y));
    });
  }

  return pos;
}
