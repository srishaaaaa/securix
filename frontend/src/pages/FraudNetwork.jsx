import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert, ShieldCheck, Smartphone, Phone, FileText, Loader2 } from "lucide-react";
import { api } from "../api/client";

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

  return (
    <div className="relative mx-auto max-w-4xl px-6 py-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-aurora opacity-60" />

      <Link to="/admin" className="relative inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-accent-soft">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
      </Link>

      <div className="relative mt-6 mb-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-100">Fraud network</h1>
        <p className="mt-2 text-sm text-ink-300">
          Verifications sharing a device, phone number, or document number with this one.
        </p>
      </div>

      {error && (
        <p className="relative rounded-xl bg-signal-crimson/10 px-4 py-3 text-center text-sm text-signal-crimson ring-1 ring-inset ring-signal-crimson/20">
          {error}
        </p>
      )}

      {!graph && !error && (
        <div className="relative flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      )}

      {graph && graph.nodes.length > 0 && (
        <div className="relative rounded-2xl glass-panel p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-center gap-2">
            {graph.flagged ? (
              <span className="flex items-center gap-1.5 rounded-full bg-signal-crimson/10 px-3.5 py-1.5 text-xs font-semibold text-signal-crimson ring-1 ring-inset ring-signal-crimson/20">
                <ShieldAlert className="h-3.5 w-3.5" /> {graph.linked_count} linked verifications — worth a look
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-signal-emerald/10 px-3.5 py-1.5 text-xs font-semibold text-signal-emerald ring-1 ring-inset ring-signal-emerald/20">
                <ShieldCheck className="h-3.5 w-3.5" /> {graph.linked_count} linked verifications — within normal range
              </span>
            )}
          </div>

          <svg viewBox={`0 0 ${svgSize} ${svgSize * 0.72}`} className="w-full">
            {graph.edges.map((e, i) => {
              const s = positions[e.source];
              const t = positions[e.target];
              if (!s || !t) return null;
              return (
                <motion.line
                  key={i}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}
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
                >
                  <circle
                    cx={p.x} cy={p.y} r={r}
                    fill={KIND_COLOR[n.kind] || "#94a3b8"}
                    fillOpacity={n.is_anchor ? 0.9 : 0.55}
                    stroke={n.is_anchor ? "#fff" : "none"}
                    strokeWidth={n.is_anchor ? 2 : 0}
                  />
                  <title>{`${n.kind}: ${n.label}`}</title>
                </motion.g>
              );
            })}
          </svg>

          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-ink-500">
            <Legend color={KIND_COLOR.verification} label="Verification" />
            <Legend color={KIND_COLOR.device} label="Shared device" />
            <Legend color={KIND_COLOR.phone} label="Shared phone" />
            <Legend color={KIND_COLOR.document} label="Shared document #" />
          </div>
        </div>
      )}

      {graph && graph.nodes.length === 0 && !error && (
        <p className="py-16 text-center text-sm text-ink-500">
          No device, phone, or document-number links found for this verification yet.
        </p>
      )}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
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
