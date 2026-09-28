import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { makePointMaterial, faceLattice, fibonacciSphere, dustField } from "./geometry";

/**
 * Landing hero: a translucent biometric "identity core". A shell of
 * points (the identity sphere) around a lattice face mesh with brighter
 * landmark points, orbit rings, orbiting identity fragments, and a scan
 * plane that sweeps vertically and lights up every point it crosses.
 * Pointer position (read inside the frame loop - never React state)
 * steers rotation, lighting and camera depth.
 */
function Core({ budget, tier, stage = 0 }) {
  const root = useRef();
  const shell = useRef();
  const face = useRef();
  const rings = useRef();
  const fragments = useRef();
  const scanRing = useRef();
  const { camera } = useThree();
  const verifiedColor = useRef(new THREE.Color("#35d99a"));
  const scanColor = useRef(new THREE.Color("#ffffff"));

  const baseZ = tier === "phone" ? 6.6 : tier === "laptop" ? 5.4 : 5.0;

  const data = useMemo(() => {
    const shellGeo = fibonacciSphere(Math.round(1700 * budget.particles), 1.72);
    const { points: faceGeo, lines: faceLines, landmarks } = faceLattice(tier === "phone" ? 30 : 40);
    const dust = dustField(Math.round(520 * budget.particles), 9);

    const shellMat = makePointMaterial({ color: "#8fa2ff", scanColor: "#ffffff", size: 20, opacity: 0.55 });
    const faceMat = makePointMaterial({ color: "#b9c6ff", scanColor: "#35d99a", size: 18, opacity: 0.8 });
    const landmarkMat = makePointMaterial({ color: "#ffffff", scanColor: "#35d99a", size: 42, opacity: 1 });
    const dustMat = makePointMaterial({ color: "#6f7ecf", scanColor: "#6f7ecf", size: 14, opacity: 0.35 });

    const faceLineMat = new THREE.LineBasicMaterial({ color: "#8fa2ff", transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending });
    const faceLineObj = new THREE.LineSegments(faceLines, faceLineMat);

    // orbit rings
    const ringGroup = new THREE.Group();
    const mkRing = (r, color, opacity, dashed, tilt) => {
      const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2);
      const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(220).map((p) => new THREE.Vector3(p.x, 0, p.y)));
      const m = dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.06, gapSize: 0.09, depthWrite: false })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const l = new THREE.LineLoop(g, m);
      if (dashed) l.computeLineDistances();
      l.rotation.set(tilt[0], tilt[1], tilt[2]);
      ringGroup.add(l);
      return l;
    };
    mkRing(2.05, "#9db0ff", 0.28, false, [0.35, 0, 0.18]);
    mkRing(2.32, "#9db0ff", 0.22, true, [-0.5, 0.2, -0.3]);
    mkRing(2.62, "#35d99a", 0.14, false, [1.25, 0, 0.1]);
    mkRing(2.95, "#b9a4ff", 0.12, true, [0.1, 0, -0.62]);

    // scan ring - horizontal, radius follows the sphere cross-section
    const scanGeo = new THREE.BufferGeometry().setFromPoints(
      new THREE.EllipseCurve(0, 0, 1, 1, 0, Math.PI * 2).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y))
    );
    const scanObj = new THREE.LineLoop(scanGeo, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false }));

    // identity fragments: small ID-card outlines + data chips orbiting
    const fragGroup = new THREE.Group();
    const cardShape = (w, h, r) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2 + r, -h / 2);
      s.lineTo(w / 2 - r, -h / 2);
      s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      s.lineTo(w / 2, h / 2 - r);
      s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      s.lineTo(-w / 2 + r, h / 2);
      s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      s.lineTo(-w / 2, -h / 2 + r);
      s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      return new THREE.BufferGeometry().setFromPoints(s.getPoints(6));
    };
    const fragMat = new THREE.LineBasicMaterial({ color: "#c7d2ff", transparent: true, opacity: 0.5, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: "#6478ff", transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
    const count = tier === "phone" ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const w = i % 2 === 0 ? 0.46 : 0.22;
      const h = i % 2 === 0 ? 0.29 : 0.22;
      const g = new THREE.Group();
      const outline = new THREE.LineLoop(cardShape(w, h, 0.03), fragMat);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.92), fillMat);
      g.add(fill, outline);
      if (i % 2 === 0) {
        // photo square + two text bars
        const photo = new THREE.LineLoop(cardShape(0.1, 0.12, 0.012), fragMat);
        photo.position.set(-w / 2 + 0.09, 0.02, 0.001);
        const bars = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.06, 0.05, 0), new THREE.Vector3(0.17, 0.05, 0),
          new THREE.Vector3(-0.06, 0.0, 0), new THREE.Vector3(0.12, 0.0, 0),
          new THREE.Vector3(-0.06, -0.05, 0), new THREE.Vector3(0.15, -0.05, 0),
        ]);
        g.add(photo, new THREE.LineSegments(bars, fragMat));
      }
      const a = (i / count) * Math.PI * 2;
      const r = 2.2 + (i % 3) * 0.28;
      g.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.55, Math.sin(a) * r);
      g.userData = { a, r, speed: 0.05 + (i % 3) * 0.018, bob: i * 1.7 };
      fragGroup.add(g);
    }

    return { shellGeo, faceGeo, landmarks, dust, shellMat, faceMat, landmarkMat, dustMat, faceLineObj, ringGroup, scanObj, fragGroup };
  }, [budget.particles, tier]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const px = state.pointer.x;
    const py = state.pointer.y;
    const dt = Math.min(delta, 0.05);

    // scan plane sweeps top->bottom->top
    const scanY = Math.sin(t * 0.55) * 1.55;
    for (const m of [data.shellMat, data.faceMat, data.landmarkMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uScan.value = scanY;
    }
    data.dustMat.uniforms.uTime.value = t;

    // pipeline state: the scan light shifts to verification green on the
    // final "identity verified" state, and the orbit rings brighten
    const verified = stage >= 5;
    const targetScan = verified ? verifiedColor.current : scanColor.current;
    data.shellMat.uniforms.uScanColor.value.lerp(targetScan, 0.06);
    data.faceMat.uniforms.uScanColor.value.lerp(verified ? verifiedColor.current : new THREE.Color("#35d99a"), 0.06);
    if (rings.current) {
      rings.current.children.forEach((r) => {
        r.material.opacity = THREE.MathUtils.damp(r.material.opacity, verified ? 0.42 : 0.2, 3, dt);
      });
    }
    if (scanRing.current) {
      const rr = Math.sqrt(Math.max(0.0001, 1.72 * 1.72 - scanY * scanY));
      scanRing.current.position.y = scanY;
      scanRing.current.scale.setScalar(rr);
    }

    if (shell.current) shell.current.rotation.y += dt * 0.06;
    if (rings.current) {
      rings.current.children.forEach((r, i) => (r.rotation.y += dt * (0.08 + i * 0.035) * (i % 2 ? -1 : 1)));
    }
    if (fragments.current) {
      fragments.current.children.forEach((g) => {
        const u = g.userData;
        u.a += dt * u.speed;
        g.position.set(Math.cos(u.a) * u.r, Math.sin(t * 0.4 + u.bob) * 0.45, Math.sin(u.a) * u.r);
        g.lookAt(0, g.position.y, 0);
        g.rotateY(Math.PI);
      });
    }
    if (face.current) {
      // subtle "breathing" + a slow micro head-turn, like a live subject
      face.current.rotation.y = Math.sin(t * 0.35) * 0.22;
      face.current.rotation.x = Math.sin(t * 0.27) * 0.05;
    }
    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, px * 0.45, 3, dt);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -py * 0.25, 3, dt);
    }
    camera.position.x = THREE.MathUtils.damp(camera.position.x, px * 0.35, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, py * 0.2, 2, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, baseZ - Math.abs(px) * 0.25, 2, dt);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={root}>
      <points ref={shell} geometry={data.shellGeo} material={data.shellMat} />
      <group ref={face} scale={1.05} position={[0, -0.02, 0]}>
        <primitive object={data.faceLineObj} />
        <points geometry={data.faceGeo} material={data.faceMat} />
        <points geometry={data.landmarks} material={data.landmarkMat} />
      </group>
      <primitive ref={rings} object={data.ringGroup} />
      <primitive ref={scanRing} object={data.scanObj} />
      <primitive ref={fragments} object={data.fragGroup} />
      <points geometry={data.dust} material={data.dustMat} />
    </group>
  );
}

export default function IdentityCore({ tier, budget, active, stage }) {
  return (
    <Canvas
      className="!h-full !w-full"
      dpr={budget.dpr}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: tier !== "phone", alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 5.4], fov: 38, near: 0.1, far: 60 }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Core tier={tier} budget={budget} stage={stage} />
    </Canvas>
  );
}
