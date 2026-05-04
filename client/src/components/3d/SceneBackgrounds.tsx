/**
 * SceneBackgrounds — Reusable 3D background components for Orlode pages
 * Lightweight, performant scenes that render behind page content
 */
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ─── PARTICLE GLOBE (Landing Hero) ──────────────────────────────────────────

function Particles({ count = 2000, color1 = '#2B4AFF', color2 = '#FF9B00' }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 2.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      const t = i / count;
      c.lerpColors(new THREE.Color(color1), new THREE.Color(color2), t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, [count, color1, color2]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.08;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.05) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} vertexColors transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function Rings({ colors = ['#2B4AFF', '#FF9B00', '#6B8AFF'] }) {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (refs[0].current) { refs[0].current.rotation.x = t * 0.2; refs[0].current.rotation.z = t * 0.08; }
    if (refs[1].current) { refs[1].current.rotation.y = t * 0.15; refs[1].current.rotation.x = t * 0.1; }
    if (refs[2].current) { refs[2].current.rotation.z = t * 0.18; refs[2].current.rotation.y = t * 0.06; }
  });
  return (
    <>
      {[3.2, 3.6, 4.0].map((r, i) => (
        <mesh key={i} ref={refs[i]}>
          <torusGeometry args={[r, 0.008, 16, 100]} />
          <meshBasicMaterial color={colors[i]} transparent opacity={0.15 + i * 0.05} />
        </mesh>
      ))}
    </>
  );
}

/** Full-screen 3D globe for Landing page hero */
export function HeroGlobeScene() {
  return (
    <div className="absolute inset-0 z-0" style={{ pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Particles count={2500} color1="#2B4AFF" color2="#FF9B00" />
        <Rings />
        <Stars radius={40} depth={40} count={600} factor={2} fade speed={0.3} />
      </Canvas>
    </div>
  );
}

// ─── MORPHING SPHERE (Login page) ───────────────────────────────────────────

function MorphSphere({ color = '#0050FF', speed = 1.5, distort = 0.35 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.2;
    ref.current.rotation.z = clock.getElapsedTime() * 0.1;
  });
  return (
    <mesh ref={ref} scale={2.2}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshDistortMaterial color={color} metalness={0.15} roughness={0.25} distort={distort} speed={speed} transparent opacity={0.6} />
    </mesh>
  );
}

function FloatingOrbs() {
  return (
    <>
      {[
        { pos: [2.5, 1.5, -1] as [number, number, number], color: '#0092FF', size: 0.3 },
        { pos: [-2, -1.5, 0.5] as [number, number, number], color: '#00DBFF', size: 0.2 },
        { pos: [1, -2, -0.5] as [number, number, number], color: '#6B8AFF', size: 0.15 },
      ].map((o, i) => (
        <Float key={i} speed={1.5 + i * 0.5} floatIntensity={0.8} rotationIntensity={0.3}>
          <mesh position={o.pos}>
            <sphereGeometry args={[o.size, 32, 32]} />
            <meshBasicMaterial color={o.color} transparent opacity={0.4} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

/** 3D background for Login/Auth pages */
export function LoginScene() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 3, 3]} intensity={0.8} />
        <MorphSphere />
        <FloatingOrbs />
        <Stars radius={30} depth={30} count={300} factor={1.5} fade speed={0.3} />
      </Canvas>
    </div>
  );
}

// ─── AGENT CHAT AVATAR (pulsating sphere) ───────────────────────────────────

function PulsingCore({ color = '#3b82f6' }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.08;
    ref.current.scale.set(s, s, s);
    ref.current.rotation.y = clock.getElapsedTime() * 0.5;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 48, 48]} />
      <MeshDistortMaterial color={color} metalness={0.2} roughness={0.2} distort={0.25} speed={3} transparent opacity={0.85} />
    </mesh>
  );
}

function OrbitalDots({ count = 20, radius = 1.1, color = '#60a5fa' }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return pos;
  }, [count, radius]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.8;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.2;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color={color} transparent opacity={0.6} />
    </points>
  );
}

/** Inline 3D avatar for agent chat — small, lightweight */
export function AgentAvatar3D({ color = '#3b82f6', size = 48 }: { color?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 2.5], fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 2, 2]} intensity={0.8} />
        <PulsingCore color={color} />
        <OrbitalDots color={color} />
      </Canvas>
    </div>
  );
}

// ─── DASHBOARD FLOATING ORBS (subtle background) ───────────────────────────

function DashOrbs() {
  return (
    <>
      {[
        { pos: [-3, 2, -2] as [number, number, number], color: '#3b82f6', size: 0.8 },
        { pos: [3, -1, -3] as [number, number, number], color: '#8b5cf6', size: 0.6 },
        { pos: [0, 3, -4] as [number, number, number], color: '#06b6d4', size: 0.5 },
        { pos: [-2, -2, -2] as [number, number, number], color: '#10b981', size: 0.4 },
      ].map((o, i) => (
        <Float key={i} speed={0.8 + i * 0.3} floatIntensity={1} rotationIntensity={0.2}>
          <mesh position={o.pos}>
            <sphereGeometry args={[o.size, 32, 32]} />
            <meshBasicMaterial color={o.color} transparent opacity={0.06} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

/** Subtle floating orbs for Dashboard background */
export function DashboardScene() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1]} gl={{ antialias: false, alpha: true }} style={{ background: 'transparent' }}>
        <DashOrbs />
      </Canvas>
    </div>
  );
}
