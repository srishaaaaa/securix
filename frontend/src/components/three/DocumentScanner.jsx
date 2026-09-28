import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const W = 3.2;
const H = 2.02;

/** ID-card face drawn on a 2D canvas and used as the card texture. */
function cardTexture(label) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 646;
  const g = c.getContext("2d");
  const r = 44;
  g.clearRect(0, 0, c.width, c.height);
  g.save();
  g.beginPath();
  g.roundRect(4, 4, c.width - 8, c.height - 8, r);
  g.clip();
  const bg = g.createLinearGradient(0, 0, c.width, c.height);
  bg.addColorStop(0, "#1a1f2e");
  bg.addColorStop(1, "#0d1017");
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  // guilloche-ish security pattern
  g.strokeStyle = "rgba(157,176,255,0.07)";
  g.lineWidth = 1.2;
  for (let k = 0; k < 26; k++) {
    g.beginPath();
    for (let x = 0; x <= c.width; x += 8) {
      const y = 90 + k * 22 + Math.sin(x / 48 + k * 0.6) * 10;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // header band
  g.fillStyle = "rgba(100,120,255,0.16)";
  g.fillRect(0, 0, c.width, 84);
  g.fillStyle = "#c7d2ff";
  g.font = "600 30px 'Space Grotesk', sans-serif";
  g.fillText((label || "IDENTITY DOCUMENT").toUpperCase(), 48, 54);
  g.fillStyle = "rgba(199,210,255,0.5)";
  g.font = "500 20px 'JetBrains Mono', monospace";
  g.fillText("SECURIX · VERIFY", c.width - 250, 52);
  // photo
  g.fillStyle = "#232a3b";
  g.beginPath();
  g.roundRect(48, 120, 230, 290, 18);
  g.fill();
  g.strokeStyle = "rgba(157,176,255,0.55)";
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(163, 235, 62, 78, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.ellipse(163, 400, 100, 60, 0, Math.PI, 0);
  g.stroke();
  // chip
  g.fillStyle = "rgba(243,173,75,0.55)";
  g.beginPath();
  g.roundRect(c.width - 170, 130, 110, 84, 12);
  g.fill();
  // text fields
  const bar = (x, y, w, a = 0.5) => {
    g.fillStyle = `rgba(169,176,195,${a})`;
    g.beginPath();
    g.roundRect(x, y, w, 16, 8);
    g.fill();
  };
  g.fillStyle = "rgba(115,123,145,0.9)";
  g.font = "500 17px 'JetBrains Mono', monospace";
  g.fillText("NAME", 320, 140);
  bar(320, 152, 380, 0.75);
  g.fillText("DATE OF BIRTH", 320, 214);
  bar(320, 226, 220, 0.6);
  g.fillText("DOCUMENT NO.", 320, 288);
  bar(320, 300, 300, 0.7);
  g.fillText("ADDRESS", 320, 362);
  bar(320, 374, 520, 0.45);
  bar(320, 400, 440, 0.45);
  // MRZ
  g.fillStyle = "rgba(199,210,255,0.35)";
  g.font = "500 26px 'JetBrains Mono', monospace";
  g.fillText("IDIND<<SECURIX<<<<<<<<<<<<<<<<<<<<<", 48, 520);
  g.fillText("8812034M2901017<<<<<<<<<<<<<<<<<<04", 48, 560);
  g.restore();
  g.strokeStyle = "rgba(157,176,255,0.35)";
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(4, 4, c.width - 8, c.height - 8, r);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function beamTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(100,120,255,0)");
  grad.addColorStop(0.82, "rgba(100,120,255,0.35)");
  grad.addColorStop(0.97, "rgba(255,255,255,0.95)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

// field regions in card units (x, y = centre; w, h), matching the texture
const px = (x, y, w, h) => [
  -W / 2 + ((x + w / 2) / 1024) * W,
  H / 2 - ((y + h / 2) / 646) * H,
  (w / 1024) * W,
  (h / 646) * H,
];
const FIELDS = [
  px(40, 112, 246, 306), // photo
  px(312, 124, 400, 54), // name
  px(312, 198, 240, 54), // dob
  px(312, 272, 320, 54), // number
  px(312, 346, 540, 80), // address
  px(40, 490, 900, 86), // MRZ
];

function boxGeometry(w, h) {
  const k = Math.min(w, h) * 0.28;
  const x = w / 2;
  const y = h / 2;
  // corner brackets only
  const v = [
    [-x, y - k, -x, y], [-x, y, -x + k, y],
    [x - k, y, x, y], [x, y, x, y - k],
    [x, -y + k, x, -y], [x, -y, x - k, -y],
    [-x + k, -y, -x, -y], [-x, -y, -x, -y + k],
  ].flatMap(([a, b, c, d]) => [a, b, 0, c, d, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
  return g;
}

function Card({ status, label, tier }) {
  const group = useRef();
  const beam = useRef();
  const boxes = useRef([]);
  const statusAt = useRef(0);
  const clock = useRef(0);

  const tex = useMemo(() => cardTexture(label), [label]);
  const beamTex = useMemo(() => beamTexture(), []);
  const boxGeos = useMemo(() => FIELDS.map(([, , w, h]) => boxGeometry(w, h)), []);
  const boxMats = useMemo(
    () => FIELDS.map(() => new THREE.LineBasicMaterial({ color: "#9db0ff", transparent: true, opacity: 0, depthWrite: false })),
    []
  );
  const edge = useMemo(() => {
    const s = new THREE.Shape();
    const r = 0.13;
    s.moveTo(-W / 2 + r, -H / 2);
    s.lineTo(W / 2 - r, -H / 2);
    s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
    s.lineTo(W / 2, H / 2 - r);
    s.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2);
    s.lineTo(-W / 2 + r, H / 2);
    s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r);
    s.lineTo(-W / 2, -H / 2 + r);
    s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
    return new THREE.BufferGeometry().setFromPoints(s.getPoints(8));
  }, []);

  useEffect(() => {
    statusAt.current = clock.current;
  }, [status]);

  useEffect(() => () => {
    tex.dispose();
    beamTex.dispose();
  }, [tex, beamTex]);

  useFrame((state, delta) => {
    const t = (clock.current = state.clock.elapsedTime);
    const dt = Math.min(delta, 0.05);
    const since = t - statusAt.current;
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.38 + Math.sin(t * 0.4) * 0.08, 3, dt);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.25 - 0.12, 3, dt);
      group.current.position.y = Math.sin(t * 0.8) * 0.06;
    }
    if (beam.current) {
      const speed = status === "processing" ? 1.6 : 0.55;
      const p = (Math.sin(t * speed) + 1) / 2; // 0..1
      beam.current.position.y = H / 2 - p * H;
      beam.current.material.opacity = status === "processing" ? 1 : 0.7;
    }
    FIELDS.forEach((_, i) => {
      const m = boxMats[i];
      let target = 0;
      if (status === "ready") target = since > i * 0.12 ? 0.85 : 0;
      if (status === "processing") target = 0.35 + 0.6 * (Math.sin(t * 5 - i * 0.9) > 0.3 ? 1 : 0);
      m.opacity = THREE.MathUtils.damp(m.opacity, target, 8, dt);
      m.color.set(status === "ready" ? "#35d99a" : "#9db0ff");
      const b = boxes.current[i];
      if (b) b.scale.setScalar(THREE.MathUtils.damp(b.scale.x, target > 0 ? 1 : 1.12, 6, dt));
    });
  });

  // fit the card to whatever aspect the stage has (portrait on laptops,
  // wide on phones) with a little breathing room
  const { viewport } = useThree();
  const scale = Math.min(1, (viewport.width * 0.8) / W, (viewport.height * 0.72) / H) * (tier === "phone" ? 0.95 : 1);

  return (
    <group ref={group} scale={scale}>
      <mesh>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      <lineLoop geometry={edge}>
        <lineBasicMaterial color="#9db0ff" transparent opacity={0.5} />
      </lineLoop>
      {FIELDS.map(([x, y], i) => (
        <lineSegments
          key={i}
          ref={(el) => (boxes.current[i] = el)}
          geometry={boxGeos[i]}
          material={boxMats[i]}
          position={[x, y, 0.01]}
        />
      ))}
      <mesh ref={beam} position={[0, 0, 0.02]}>
        <planeGeometry args={[W * 1.08, 0.5]} />
        <meshBasicMaterial map={beamTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* thin depth slab behind the card */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[W * 0.985, H * 0.975]} />
        <meshBasicMaterial color="#05060a" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Floor() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(14, 28, "#6478ff", "#6478ff");
    g.material.transparent = true;
    g.material.opacity = 0.08;
    g.material.depthWrite = false;
    return g;
  }, []);
  return <primitive object={grid} position={[0, -1.55, 0]} />;
}

export default function DocumentScanner({ tier, budget, active, status = "idle", label }) {
  return (
    <Canvas
      className="!h-full !w-full"
      dpr={budget.dpr}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, tier === "phone" ? 4.6 : 4.1], fov: 40 }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Card status={status} label={label} tier={tier} />
      <Floor />
    </Canvas>
  );
}
