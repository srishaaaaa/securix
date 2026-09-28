import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { faceLattice, makePointMaterial } from "./geometry";

/**
 * SECURIX world: one particle field fixed behind the whole landing page.
 * It morphs through the story as the page scrolls:
 *   0 identity sphere · 1 ID card · 2 face mesh · 3 identity network
 *   4 trust orb · 5 verification check
 * The active form is read from [data-world] sections in the DOM inside the
 * frame loop (no React state), and each section's data-side decides which
 * side of the screen the form sits on so it never covers the copy.
 */

const rand = (i, n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;

function sphere(N, r) {
  const out = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const t = golden * i;
    out.set([Math.cos(t) * rr * r, y * r, Math.sin(t) * rr * r], i * 3);
  }
  return out;
}

function idCard(N) {
  const W = 3.6, H = 2.28;
  const out = new Float32Array(N * 3);
  const parts = [];
  // outline
  const per = 2 * (W + H);
  for (let k = 0; k < 520; k++) {
    let d = (k / 520) * per;
    let x, y;
    if (d < W) [x, y] = [-W / 2 + d, H / 2];
    else if ((d -= W) < H) [x, y] = [W / 2, H / 2 - d];
    else if ((d -= H) < W) [x, y] = [W / 2 - d, -H / 2];
    else [x, y] = [-W / 2, -H / 2 + (d - W)];
    parts.push([x, y]);
  }
  // photo box
  for (let k = 0; k < 220; k++) {
    const t = k / 220;
    const px = -W / 2 + 0.25, py = 0.55, pw = 0.95, ph = 1.2;
    const side = Math.floor(t * 4), u = (t * 4) % 1;
    parts.push(side === 0 ? [px + u * pw, py] : side === 1 ? [px + pw, py - u * ph] : side === 2 ? [px + pw - u * pw, py - ph] : [px, py - ph + u * ph]);
  }
  // head + shoulders in the photo
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    parts.push([-W / 2 + 0.72 + Math.cos(a) * 0.2, 0.22 + Math.sin(a) * 0.26]);
  }
  // text rows
  const rows = [[0.45, 1.5], [0.2, 1.0], [-0.05, 1.2], [-0.3, 1.9], [-0.45, 1.6]];
  rows.forEach(([y, w]) => {
    for (let k = 0; k < 150; k++) parts.push([-0.25 + (k / 150) * w, y]);
  });
  // MRZ lines
  [-0.78, -0.95].forEach((y) => {
    for (let k = 0; k < 190; k++) parts.push([-W / 2 + 0.25 + (k / 190) * (W - 0.5), y]);
  });
  // header band fill
  for (let k = 0; k < 260; k++) parts.push([-W / 2 + rand(k, 1) * W, H / 2 - 0.05 - rand(k, 2) * 0.22]);
  // chip
  for (let k = 0; k < 80; k++) parts.push([W / 2 - 0.75 + rand(k, 3) * 0.45, 0.35 + rand(k, 4) * 0.32]);
  for (let i = 0; i < N; i++) {
    const [x, y] = parts[i % parts.length];
    const j = i >= parts.length ? 0.012 : 0;
    out.set([x + (rand(i, 5) - 0.5) * j, y + (rand(i, 6) - 0.5) * j, (rand(i, 7) - 0.5) * 0.06], i * 3);
  }
  return out;
}

function face(N) {
  const { points, landmarks } = faceLattice(52);
  const a = points.getAttribute("position").array;
  const l = landmarks.getAttribute("position").array;
  const out = new Float32Array(N * 3);
  const na = a.length / 3, nl = l.length / 3;
  for (let i = 0; i < N; i++) {
    // ~15% of points sit on the landmarks so they read brighter/denser
    const useL = rand(i, 8) < 0.15;
    const src = useL ? l : a;
    const k = useL ? i % nl : i % na;
    out.set([src[k * 3] * 2.3, src[k * 3 + 1] * 2.3, src[k * 3 + 2] * 2.3], i * 3);
  }
  return out;
}

const NET = [
  [0, 0, 0], [1.9, 0.9, 0.4], [-1.8, 1.0, -0.3], [2.1, -1.0, -0.4], [-2.0, -1.1, 0.5], [0.2, 2.0, -0.6], [0.1, -2.1, 0.3],
  [3.2, 0.2, -0.8], [-3.1, 0.1, 0.8], [1.2, 2.6, 0.9], [-1.1, -2.6, -0.9],
];
const NET_E = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 7], [3, 7], [2, 8], [4, 8], [5, 9], [1, 9], [6, 10], [4, 10]];

function network(N) {
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    if (rand(i, 9) < 0.55) {
      const n = NET[i % NET.length];
      const r = (i % NET.length === 0 ? 0.42 : 0.2) * Math.cbrt(rand(i, 10));
      const th = rand(i, 11) * Math.PI * 2, ph = Math.acos(2 * rand(i, 12) - 1);
      out.set([n[0] + r * Math.sin(ph) * Math.cos(th), n[1] + r * Math.cos(ph), n[2] + r * Math.sin(ph) * Math.sin(th)], i * 3);
    } else {
      const [a, b] = NET_E[i % NET_E.length];
      const t = rand(i, 13);
      const A = NET[a], B = NET[b];
      out.set([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t], i * 3);
    }
  }
  return out;
}

function orb(N) {
  const out = new Float32Array(N * 3);
  const inner = sphere(Math.ceil(N * 0.45), 1.1);
  for (let i = 0; i < N; i++) {
    if (i < N * 0.45) {
      out.set([inner[i * 3], inner[i * 3 + 1], inner[i * 3 + 2]], i * 3);
    } else if (i < N * 0.85) {
      const a = rand(i, 14) * Math.PI * 2;
      const r = 1.9 + (rand(i, 15) - 0.5) * 0.08;
      out.set([Math.cos(a) * r, Math.sin(a) * r * 0.32, Math.sin(a) * r], i * 3);
    } else {
      // tick bezel
      const k = i % 60;
      const a = (k / 60) * Math.PI * 2;
      const r = 2.35 + rand(i, 16) * 0.14;
      out.set([Math.cos(a) * r, Math.sin(a) * r, 0], i * 3);
    }
  }
  return out;
}

function check(N) {
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    if (rand(i, 17) < 0.5) {
      // ring
      const a = rand(i, 18) * Math.PI * 2;
      const r = 2.0 + (rand(i, 19) - 0.5) * 0.12;
      out.set([Math.cos(a) * r, Math.sin(a) * r, (rand(i, 20) - 0.5) * 0.1], i * 3);
    } else {
      // check stroke: (-0.9,0) -> (-0.25,-0.7) -> (1.05,0.8)
      const t = rand(i, 21);
      const P = t < 0.33 ? [[-0.95, 0.05], [-0.25, -0.7], t / 0.33] : [[-0.25, -0.7], [1.1, 0.85], (t - 0.33) / 0.67];
      const [[x0, y0], [x1, y1], u] = P;
      const w = (rand(i, 22) - 0.5) * 0.16;
      out.set([x0 + (x1 - x0) * u + w, y0 + (y1 - y0) * u + w, (rand(i, 23) - 0.5) * 0.12], i * 3);
    }
  }
  return out;
}

const COLORS = ["#3d3dff", "#14161f", "#4338ca", "#3d3dff", "#7c3aed", "#047857"];

function Field({ tier }) {
  const pts = useRef();
  const group = useRef();
  const { camera, viewport } = useThree();
  const N = tier === "phone" ? 2200 : tier === "laptop" ? 3600 : 4800;

  const data = useMemo(() => {
    const shapes = [sphere(N, 1.9), idCard(N), face(N), network(N), orb(N), check(N)];
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(shapes[0]);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = rand(i, 24);
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = makePointMaterial({ color: COLORS[0], scanColor: "#3d3dff", size: tier === "phone" ? 17 : 30, opacity: 1.7 });
    return { shapes, geo, pos, mat, colors: COLORS.map((c) => new THREE.Color(c)) };
  }, [N, tier]);

  const state = useRef({ stage: 0, side: 1, sections: [], lastScan: 0 });

  useFrame((st, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = st.clock.elapsedTime;
    const S = state.current;

    // re-scan sections occasionally (they can mount late)
    if (t - S.lastScan > 1 || S.sections.length === 0) {
      S.sections = Array.from(document.querySelectorAll("[data-world]"));
      S.lastScan = t;
    }
    // which section holds the viewport centre, and how far through it
    const mid = window.innerHeight / 2;
    let target = 0;
    let side = 0;
    for (const el of S.sections) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        const idx = Number(el.dataset.world);
        const f = (mid - r.top) / r.height; // 0..1 through the section
        const next = el.dataset.next !== undefined ? Number(el.dataset.next) : idx;
        // hold the form for most of the section, morph in its last 30%
        const m = THREE.MathUtils.smoothstep(f, 0.7, 1);
        target = idx + (next - idx) * m;
        side = el.dataset.side === "left" ? -1 : el.dataset.side === "right" ? 1 : 0;
        break;
      }
    }
    S.stage = THREE.MathUtils.damp(S.stage, target, 4, dt);
    S.side = THREE.MathUtils.damp(S.side, side, 3, dt);

    // morph between the two neighbouring shapes
    const a = Math.floor(S.stage);
    const b = Math.min(a + 1, data.shapes.length - 1);
    const k = S.stage - a;
    const e = k * k * (3 - 2 * k);
    const A = data.shapes[Math.max(0, a)], B = data.shapes[b];
    const P = data.pos;
    for (let i = 0; i < P.length; i++) P[i] = A[i] + (B[i] - A[i]) * e;
    data.geo.getAttribute("position").needsUpdate = true;
    data.mat.uniforms.uColor.value.copy(data.colors[Math.max(0, a)]).lerp(data.colors[b], e);
    data.mat.uniforms.uTime.value = t;
    data.mat.uniforms.uScan.value = Math.sin(t * 0.5) * 2.2;

    if (group.current) {
      const off = tier === "phone" ? 0 : Math.min(viewport.width * 0.24, 3.4);
      group.current.position.x = S.side * off;
      group.current.position.y = tier === "phone" ? 0.9 : 0;
      // forms that read best face-on (card, face, check) turn less
      const flat = [1, 2, 5].includes(Math.round(S.stage));
      const spin = flat ? Math.sin(t * 0.35) * 0.35 : t * 0.12;
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, spin + st.pointer.x * 0.35, 3, dt);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -st.pointer.y * 0.2, 3, dt);
      const sc = tier === "phone" ? 0.62 : tier === "laptop" ? 0.85 : 1;
      group.current.scale.setScalar(sc);
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, st.pointer.x * 0.3, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, st.pointer.y * 0.2, 2, dt);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      <points ref={pts} geometry={data.geo} material={data.mat} />
    </group>
  );
}

export default function WorldScene({ tier, budget, active }) {
  return (
    <Canvas
      className="!h-full !w-full"
      dpr={budget.dpr}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: tier !== "phone", alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 7.2], fov: 40 }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Field tier={tier} />
    </Canvas>
  );
}
