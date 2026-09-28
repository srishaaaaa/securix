import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { dustField, makePointMaterial } from "./geometry";

const Z_BY_KIND = { verification: 0, device: 1.0, phone: -1.0, document: 0.5 };

/** 2D force-layout positions (from the page's simulate()) -> 3D space. */
function to3D(p, kind, i, size) {
  const cx = size / 2;
  const cy = size * 0.36;
  const z = (Z_BY_KIND[kind] ?? 0) * (i % 2 ? 1 : -0.6);
  return new THREE.Vector3((p.x - cx) / 46, -(p.y - cy) / 46, z);
}

function Graph({ graph, positions, size, kindColor, hoveredId, selectedId, onHover, onSelect, tier, command }) {
  const controls = useRef();
  const nodeRefs = useRef({});
  const born = useRef(null);
  const focusMove = useRef({ pending: false, until: 0, target: new THREE.Vector3() });
  const desiredPos = useRef(null);
  const { camera } = useThree();

  const layout = useMemo(() => {
    const map = {};
    graph.nodes.forEach((n, i) => {
      const p = positions[n.id];
      if (p) map[n.id] = to3D(p, n.kind, i, size);
    });
    return map;
  }, [graph, positions, size]);

  const edges = useMemo(
    () => graph.edges.map((e) => ({ ...e, a: layout[e.source], b: layout[e.target] })).filter((e) => e.a && e.b),
    [graph, layout]
  );

  const anchorId = useMemo(() => graph.nodes.find((n) => n.is_anchor)?.id, [graph]);

  useEffect(() => {
    focusMove.current.target.copy(selectedId && layout[selectedId] ? layout[selectedId] : new THREE.Vector3());
    focusMove.current.pending = true;
  }, [selectedId, layout]);

  // control-panel commands: reset / zoom in / zoom out / focus anchor
  useEffect(() => {
    if (!command || !controls.current) return;
    const target = controls.current.target.clone();
    const dir = camera.position.clone().sub(target);
    const len = dir.length();
    if (command.type === "zoom-in" || command.type === "zoom-out") {
      const next = THREE.MathUtils.clamp(len * (command.type === "zoom-in" ? 0.72 : 1.35), 3, 22);
      desiredPos.current = target.clone().add(dir.normalize().multiplyScalar(next));
    } else if (command.type === "reset") {
      focusMove.current.target.set(0, 0, 0);
      focusMove.current.pending = true;
      desiredPos.current = new THREE.Vector3(0, 1.2, tier === "phone" ? 11.5 : 9);
    } else if (command.type === "focus") {
      const anchor = graph.nodes.find((n) => n.is_anchor);
      if (anchor && layout[anchor.id]) {
        focusMove.current.target.copy(layout[anchor.id]);
        focusMove.current.pending = true;
        desiredPos.current = layout[anchor.id].clone().add(new THREE.Vector3(0, 0.8, tier === "phone" ? 7 : 5.5));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);
  const focusId = hoveredId || selectedId;

  const edgeGeo = useMemo(() => {
    const arr = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      arr.set([e.a.x, e.a.y, e.a.z, e.b.x, e.b.y, e.b.z], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const col = new Float32Array(edges.length * 6);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [edges]);

  // edge colours: risk-highlight links touching the anchor when flagged,
  // brighten links touching the focused node
  useEffect(() => {
    const col = edgeGeo.getAttribute("color");
    const base = new THREE.Color("#b4bbd0");
    const risk = new THREE.Color("#d61f45");
    const focus = new THREE.Color("#4338ca");
    edges.forEach((e, i) => {
      let c = base;
      if (graph.flagged && (e.source === anchorId || e.target === anchorId)) c = risk.clone().multiplyScalar(0.8);
      if (focusId && (e.source === focusId || e.target === focusId)) c = focus;
      col.setXYZ(i * 2, c.r, c.g, c.b);
      col.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }, [edges, edgeGeo, focusId, graph.flagged, anchorId]);

  const flowData = useMemo(() => {
    const perEdge = tier === "phone" ? 1 : 2;
    const n = Math.max(1, edges.length * perEdge);
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = makePointMaterial({ color: graph.flagged ? "#d61f45" : "#4f46e5", scanColor: "#07080d", size: 26, opacity: 0.9 });
    return { g, mat, perEdge, offsets: Array.from({ length: n }, () => Math.random()) };
  }, [edges, tier, graph.flagged]);

  const dust = useMemo(() => dustField(tier === "phone" ? 220 : 480, 14), [tier]);
  const dustMat = useMemo(() => makePointMaterial({ color: "#a5b4fc", scanColor: "#a5b4fc", size: 14, opacity: 0.4 }), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (born.current === null) born.current = t;
    const age = t - born.current;
    const dt = Math.min(delta, 0.05);

    // staggered node entrance
    graph.nodes.forEach((n, i) => {
      const m = nodeRefs.current[n.id];
      if (!m) return;
      const k = THREE.MathUtils.clamp((age - i * 0.05) / 0.6, 0, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      const focus = n.id === focusId ? 1.35 : 1;
      m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, ease * focus, 10, dt));
    });

    // particles flowing along links
    const attr = flowData.g.getAttribute("position");
    edges.forEach((e, i) => {
      for (let k = 0; k < flowData.perEdge; k++) {
        const idx = i * flowData.perEdge + k;
        const p = (flowData.offsets[idx] + t * 0.22) % 1;
        attr.setXYZ(idx, e.a.x + (e.b.x - e.a.x) * p, e.a.y + (e.b.y - e.a.y) * p, e.a.z + (e.b.z - e.a.z) * p);
      }
    });
    attr.needsUpdate = true;
    flowData.mat.uniforms.uTime.value = t;
    dustMat.uniforms.uTime.value = t;

    // camera focus transition toward the selected node - only for a short
    // window after a selection changes, so it never fights manual panning
    if (focusMove.current.pending) {
      focusMove.current.pending = false;
      focusMove.current.until = t + 1.4;
    }
    if (controls.current && t < focusMove.current.until) {
      const target = focusMove.current.target;
      controls.current.target.x = THREE.MathUtils.damp(controls.current.target.x, target.x, 4, dt);
      controls.current.target.y = THREE.MathUtils.damp(controls.current.target.y, target.y, 4, dt);
      controls.current.target.z = THREE.MathUtils.damp(controls.current.target.z, target.z, 4, dt);
      controls.current.update();
    }
    if (desiredPos.current) {
      camera.position.lerp(desiredPos.current, 1 - Math.exp(-5 * dt));
      if (camera.position.distanceTo(desiredPos.current) < 0.02) desiredPos.current = null;
      controls.current?.update();
    } else if (age < 2.2) {
      // intro dolly-in
      const z = THREE.MathUtils.lerp(tier === "phone" ? 16 : 13, tier === "phone" ? 11.5 : 9, 1 - Math.pow(1 - Math.min(age / 2.2, 1), 3));
      camera.position.setLength(z);
    }
  });

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 5, 6]} intensity={40} color="#4f46e5" />
      <pointLight position={[-6, -3, 4]} intensity={25} color="#8d6bff" />

      <points geometry={dust} material={dustMat} />
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
      </lineSegments>
      <points geometry={flowData.g} material={flowData.mat} />

      {graph.nodes.map((n) => {
        const p = layout[n.id];
        if (!p) return null;
        const r = (n.is_anchor ? 16 : 6 + Math.min(n.degree, 8)) / 62 * 1.25;
        const color = kindColor[n.kind] || "#94a3b8";
        const isFocus = n.id === focusId;
        return (
          <group key={n.id} position={p}>
            <mesh
              ref={(el) => (nodeRefs.current[n.id] = el)}
              scale={0}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover(n.id);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                onHover(null);
                document.body.style.cursor = "";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id === selectedId ? null : n.id);
              }}
            >
              <sphereGeometry args={[r, 32, 32]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={n.is_anchor || isFocus ? 0.9 : 0.35}
                roughness={0.35}
                metalness={0.1}
                transparent
                opacity={n.is_anchor ? 1 : 0.85}
              />
            </mesh>
            {(n.is_anchor || isFocus) && (
              <mesh scale={n.is_anchor ? 2.2 : 1.9}>
                <sphereGeometry args={[r, 24, 24]} />
                <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} blending={THREE.NormalBlending} />
              </mesh>
            )}
            {n.is_anchor && (
              <mesh rotation={[Math.PI / 2.4, 0, 0]}>
                <torusGeometry args={[r * 2.6, 0.008, 8, 96]} />
                <meshBasicMaterial color="#07080d" transparent opacity={0.45} />
              </mesh>
            )}
            {isFocus && (
              <Html center distanceFactor={9} position={[0, r + 0.35, 0]} style={{ pointerEvents: "none" }}>
                <div className="whitespace-nowrap rounded-full border border-white/10 bg-void-900/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-100 backdrop-blur">
                  <span style={{ color }}>{n.kind}</span> · {String(n.label).slice(0, 26)}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        screenSpacePanning
        minDistance={3}
        maxDistance={22}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.82}
      />
    </>
  );
}

export default function NetworkGraph({ tier, budget, graph, positions, size, kindColor, hoveredId, selectedId, onHover, onSelect, command }) {
  return (
    <Canvas
      className="!h-full !w-full touch-none"
      dpr={budget.dpr}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 1.2, tier === "phone" ? 16 : 13], fov: 42 }}
      onPointerMissed={() => onSelect(null)}
    >
      <Graph
        graph={graph}
        positions={positions}
        size={size}
        kindColor={kindColor}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onHover={onHover}
        onSelect={onSelect}
        tier={tier}
        command={command}
      />
    </Canvas>
  );
}
