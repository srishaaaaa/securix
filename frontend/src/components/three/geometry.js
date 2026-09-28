import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Point material: soft round sprites that twinkle and brighten as the */
/* scan plane (uScan, world-space y) passes through them.              */
/* ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScan;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vTw;
  varying float vScan;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    vScan = smoothstep(0.2, 0.0, abs(world.y - uScan));
    vTw = 0.55 + 0.45 * sin(uTime * 1.2 + aSeed * 6.2831);
    gl_PointSize = uSize * uPixelRatio * (1.0 + vScan * 1.4) / max(0.5, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uScanColor;
  uniform float uOpacity;
  varying float vTw;
  varying float vScan;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float a = smoothstep(0.5, 0.05, r);
    vec3 col = mix(uColor, uScanColor, vScan);
    gl_FragColor = vec4(col, a * uOpacity * (vTw * 0.75 + vScan * 0.9));
  }
`;

export function makePointMaterial({ color, scanColor, size = 20, opacity = 1 }) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uScan: { value: 99 },
      uSize: { value: size },
      uPixelRatio: { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2) },
      uColor: { value: new THREE.Color(color) },
      uScanColor: { value: new THREE.Color(scanColor) },
      uOpacity: { value: opacity },
    },
  });
}

function withSeeds(geo, n) {
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) seeds[i] = Math.random();
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geo;
}

export function pointsGeometry(positions) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return withSeeds(geo, positions.length / 3);
}

/* ------------------------------------------------------------------ */
/* Fibonacci sphere shell                                               */
/* ------------------------------------------------------------------ */

export function fibonacciSphere(n, radius) {
  const pos = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const jitter = 1 + (Math.random() - 0.5) * 0.03;
    pos[i * 3] = Math.cos(theta) * r * radius * jitter;
    pos[i * 3 + 1] = y * radius * jitter;
    pos[i * 3 + 2] = Math.sin(theta) * r * radius * jitter;
  }
  return pointsGeometry(pos);
}

/* ------------------------------------------------------------------ */
/* Ambient dust                                                         */
/* ------------------------------------------------------------------ */

export function dustField(n, spread) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 3 + Math.random() * (spread - 3);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 2;
  }
  return pointsGeometry(pos);
}

/* ------------------------------------------------------------------ */
/* Procedural face: a lattice over an egg-shaped contour, sculpted in   */
/* depth (nose, brow ridge, eye sockets, lips), plus landmark points.   */
/* ------------------------------------------------------------------ */

const FACE_A = 0.64; // half width
const FACE_B = 0.9; // half height

function halfWidthAt(y) {
  // narrower toward the chin, slightly narrower at the crown
  const t = y / FACE_B;
  const chin = t < 0 ? 1 - 0.42 * t * t : 1 - 0.12 * t * t;
  return FACE_A * chin * Math.sqrt(Math.max(0, 1 - t * t * 0.55));
}

export function faceInside(x, y) {
  if (Math.abs(y) > FACE_B) return false;
  const w = halfWidthAt(y);
  return Math.abs(x) <= w * Math.sqrt(Math.max(0, 1 - Math.pow(y / FACE_B, 8)));
}

const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

export function faceDepth(x, y) {
  const w = Math.max(halfWidthAt(y), 0.001);
  const base = 0.5 * Math.sqrt(Math.max(0, 1 - (x / w) ** 2 * 0.92 - (y / FACE_B) ** 2 * 0.55));
  let z = base;
  z += 0.2 * g2(x, y, 0, -0.04, 0.075, 0.2); // nose bridge + body
  z += 0.08 * g2(x, y, 0, -0.2, 0.09, 0.07); // nose tip
  z -= 0.075 * (g2(x, y, 0.22, 0.14, 0.12, 0.07) + g2(x, y, -0.22, 0.14, 0.12, 0.07)); // eye sockets
  z += 0.035 * (g2(x, y, 0.22, 0.27, 0.16, 0.04) + g2(x, y, -0.22, 0.27, 0.16, 0.04)); // brow ridge
  z += 0.04 * g2(x, y, 0, -0.43, 0.16, 0.05); // lips
  z += 0.03 * (g2(x, y, 0.33, -0.12, 0.12, 0.14) + g2(x, y, -0.33, -0.12, 0.12, 0.14)); // cheekbones
  z += 0.03 * g2(x, y, 0, -0.74, 0.14, 0.08); // chin
  return z;
}

function landmarkXY() {
  const pts = [];
  // jaw contour (17)
  for (let i = 0; i < 17; i++) {
    const t = -Math.PI * 0.08 - (i / 16) * Math.PI * 0.84;
    const y = Math.sin(t) * 0.84 + 0.12;
    const x = Math.cos(t) * halfWidthAt(y) * 0.98;
    pts.push([x, y]);
  }
  // brows (5 + 5)
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) pts.push([s * (0.1 + i * 0.055), 0.28 + Math.sin((i / 4) * Math.PI) * 0.035]);
  // nose bridge (4) + base (5)
  for (let i = 0; i < 4; i++) pts.push([0, 0.18 - i * 0.1]);
  for (let i = 0; i < 5; i++) pts.push([(i - 2) * 0.045, -0.22 + Math.abs(i - 2) * 0.012]);
  // eyes (6 + 6)
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push([s * 0.22 + Math.cos(a) * 0.075, 0.14 + Math.sin(a) * 0.03]);
    }
  // mouth (12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push([Math.cos(a) * 0.16, -0.43 + Math.sin(a) * 0.045]);
  }
  return pts;
}

export function faceLattice(res = 40) {
  const cols = res;
  const rows = Math.round(res * 1.35);
  const idx = new Map();
  const pos = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = -FACE_A + (i / cols) * FACE_A * 2;
      const y = -FACE_B + (j / rows) * FACE_B * 2;
      if (!faceInside(x, y)) continue;
      idx.set(`${i},${j}`, pos.length / 3);
      pos.push(x, y, faceDepth(x, y));
    }
  }
  const seg = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const a = idx.get(`${i},${j}`);
      if (a === undefined) continue;
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const b = idx.get(`${i + di},${j + dj}`);
        if (b === undefined) continue;
        seg.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]);
      }
    }
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));

  const lm = landmarkXY();
  const lmPos = new Float32Array(lm.length * 3);
  lm.forEach(([x, y], k) => {
    lmPos[k * 3] = x;
    lmPos[k * 3 + 1] = y;
    lmPos[k * 3 + 2] = faceDepth(x, y) + 0.02;
  });

  return { points: pointsGeometry(new Float32Array(pos)), lines, landmarks: pointsGeometry(lmPos), landmarkXY: lm };
}
