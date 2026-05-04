/**
 * FirebaseConnect3DPage — Cinematic 3D walkthrough of Firebase ↔ Orlode connection.
 * Scroll-driven camera fly-through across 5 stages with floating UI mockups,
 * animated 3D arrows, particle starfield, and glassmorphic stage cards.
 */
import { useRef, useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls, useScroll, Html, Float, Stars, Environment,
  RoundedBox, Text, MeshTransmissionMaterial, Sparkles,
} from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Database, Key, FileJson, CheckCircle2, Zap, ArrowRight, Bot } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// PALETTE
// ═════════════════════════════════════════════════════════════════════════════

const PAL = {
  firebase:  '#FFCA28',
  fbDeep:    '#F57F17',
  green:     '#0A4F3C',
  cream:     '#FFFAF0',
  gold:      '#D4A017',
  violet:    '#7C3AED',
  cyan:      '#06B6D4',
  emerald:   '#10B981',
  ink:       '#0A2A20',
  inkSoft:   '#5A6B62',
};

const STAGES = [
  { id: 1, title: 'Firebase Console',     subtitle: 'Sélectionner votre projet',         color: PAL.firebase, z: 0,    icon: Database },
  { id: 2, title: 'Service Account',      subtitle: 'Générer la clé privée JSON',        color: PAL.gold,     z: -10,  icon: Key },
  { id: 3, title: 'Coller dans Orlode',   subtitle: 'Connecteurs → Firebase',            color: PAL.violet,   z: -20,  icon: FileJson },
  { id: 4, title: 'Collections',          subtitle: 'Choisir ce que les agents voient',  color: PAL.cyan,     z: -30,  icon: Bot },
  { id: 5, title: 'Sync activée',         subtitle: '48 agents · temps réel',            color: PAL.emerald,  z: -40,  icon: Zap },
];

// ═════════════════════════════════════════════════════════════════════════════
// 3D STAGE — floating glassmorphic card with Firebase-page mockup
// ═════════════════════════════════════════════════════════════════════════════

interface StageProps {
  stage: typeof STAGES[number];
  scrollOffset: number;
}

function Stage({ stage, scrollOffset }: StageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cardRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Subtle floating
    groupRef.current.position.y = Math.sin(t * 0.4 + stage.id) * 0.15;
    groupRef.current.rotation.y = Math.sin(t * 0.2 + stage.id) * 0.05;
  });

  const isActive = Math.abs(scrollOffset - (-stage.z / 40)) < 0.15;

  return (
    <group ref={groupRef} position={[0, 0, stage.z]}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.3}>
        {/* Glow halo */}
        <mesh position={[0, 0, -0.5]}>
          <planeGeometry args={[7, 5]} />
          <meshBasicMaterial color={stage.color} transparent opacity={isActive ? 0.18 : 0.08} />
        </mesh>

        {/* Glass card */}
        <RoundedBox ref={cardRef} args={[5.6, 3.6, 0.15]} radius={0.18} smoothness={6}>
          <MeshTransmissionMaterial
            backside
            samples={4}
            thickness={0.6}
            roughness={0.15}
            chromaticAberration={0.04}
            anisotropy={0.4}
            distortion={0.05}
            distortionScale={0.5}
            color={stage.color}
            transmission={0.85}
          />
        </RoundedBox>

        {/* Neon border */}
        <mesh>
          <torusGeometry args={[3.2, 0.015, 16, 100]} />
          <meshBasicMaterial color={stage.color} />
        </mesh>

        {/* Stage number — floating in front */}
        <Float speed={2} rotationIntensity={0} floatIntensity={0.4}>
          <Text
            position={[-2.5, 1.4, 0.5]}
            fontSize={0.7}
            color={stage.color}
            anchorX="left"
            anchorY="middle"
          >
            {`0${stage.id}`}
          </Text>
        </Float>

        {/* HTML mockup projected onto card */}
        <Html
          position={[0, 0, 0.12]}
          transform
          occlude="blending"
          distanceFactor={4}
          style={{ width: 720, height: 460, pointerEvents: 'none' }}
        >
          <StageContent stage={stage} active={isActive} />
        </Html>

        {/* Sparkles around active card */}
        {isActive && (
          <Sparkles count={40} scale={[6, 4, 1]} size={3} speed={0.6} color={stage.color} />
        )}
      </Float>
    </group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// HTML MOCKUPS — recreated Firebase / Orlode UI panels
// ═════════════════════════════════════════════════════════════════════════════

function StageContent({ stage, active }: { stage: typeof STAGES[number]; active: boolean }) {
  if (stage.id === 1) return <FirebaseConsolePanel active={active} />;
  if (stage.id === 2) return <ServiceAccountPanel active={active} />;
  if (stage.id === 3) return <OrlodePastePanel active={active} />;
  if (stage.id === 4) return <CollectionsPanel active={active} />;
  return <SyncSuccessPanel active={active} />;
}

function PanelChrome({ host, children, accent }: { host: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 720, height: 460, borderRadius: 14, overflow: 'hidden',
      background: '#FFFFFF', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.4)',
      fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column',
      border: `2px solid ${accent}`,
    }}>
      <div style={{
        background: '#F5F5F5', padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #E0E0E0',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
        </div>
        <div style={{
          flex: 1, background: '#fff', borderRadius: 6, padding: '4px 12px',
          fontSize: 11, color: '#5F6368', textAlign: 'center',
        }}>{host}</div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function FirebaseConsolePanel({ active }: { active: boolean }) {
  return (
    <PanelChrome host="console.firebase.google.com" accent={PAL.firebase}>
      <div style={{ background: '#FFCA28', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#F57F17' }}>F</div>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1F2937' }}>Firebase</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#1F2937' }}>nguessan.adelin@ouihope.org</span>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#202124', margin: '0 0 16px' }}>Vos projets Firebase</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <ProjectCard name="ouihope-prod" id="ouihope-prod-9c7f" highlight={active} />
          <ProjectCard name="orlode-staging" id="orlode-stg-44a" />
        </div>
        {active && (
          <div style={{
            marginTop: 18, padding: 12, background: '#E8F0FE', borderRadius: 10,
            border: '2px solid #1A73E8', display: 'flex', alignItems: 'center', gap: 10,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            <ChevronDown size={18} color="#1A73E8" />
            <span style={{ fontSize: 13, color: '#1A73E8', fontWeight: 600 }}>
              Sélectionnez "ouihope-prod" pour continuer →
            </span>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.02)} }`}</style>
    </PanelChrome>
  );
}

function ProjectCard({ name, id, highlight }: { name: string; id: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: 16, borderRadius: 10,
      border: highlight ? '2px solid #FFCA28' : '1px solid #DADCE0',
      background: highlight ? '#FFF8E1' : '#fff',
      boxShadow: highlight ? '0 0 24px rgba(255,202,40,0.5)' : 'none',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#FFCA28,#F57F17)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, marginBottom: 10 }}>F</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>{name}</div>
      <div style={{ fontSize: 11, color: '#5F6368', fontFamily: 'monospace' }}>{id}</div>
    </div>
  );
}

function ServiceAccountPanel({ active }: { active: boolean }) {
  return (
    <PanelChrome host="console.firebase.google.com/project/.../settings/serviceaccounts" accent={PAL.gold}>
      <div style={{ background: '#FFCA28', padding: 10, fontSize: 12, color: '#1F2937', display: 'flex', gap: 6 }}>
        <span style={{ opacity: 0.7 }}>Project settings</span>
        <span style={{ opacity: 0.5 }}>→</span>
        <strong>Service accounts</strong>
      </div>
      <div style={{ padding: '20px 28px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, color: '#202124', margin: 0 }}>Firebase Admin SDK</h2>
        <p style={{ fontSize: 12, color: '#5F6368', margin: '6px 0 18px' }}>
          Generate a new private key to authenticate Orlode as a backend service.
        </p>

        <div style={{
          padding: 16, background: '#F8F9FA', borderRadius: 8,
          border: '1px solid #DADCE0', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Key size={16} color="#5F6368" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>firebase-adminsdk-xyz@ouihope-prod.iam.gserviceaccount.com</span>
          </div>
          <code style={{ fontSize: 11, color: '#5F6368', fontFamily: 'monospace' }}>
            roles/firebase.admin · roles/datastore.user
          </code>
        </div>

        <button style={{
          background: active ? '#FFCA28' : '#1A73E8', color: active ? '#1F2937' : '#fff',
          border: 'none', padding: '10px 22px', borderRadius: 6, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: active ? '0 0 0 4px rgba(255,202,40,0.3)' : 'none',
          transition: 'all 0.3s',
        }}>
          <Key size={14} /> Generate new private key
        </button>

        {active && (
          <div style={{
            marginTop: 16, padding: 10, background: '#E8F5E9', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <CheckCircle2 size={16} color="#10B981" />
            <span style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>
              ouihope-prod-firebase-adminsdk-key.json téléchargé
            </span>
          </div>
        )}
      </div>
    </PanelChrome>
  );
}

function OrlodePastePanel({ active }: { active: boolean }) {
  return (
    <PanelChrome host="orlode.ai/admin/connectors" accent={PAL.violet}>
      <div style={{ background: PAL.green, padding: 10, fontSize: 12, color: PAL.cream, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#7C3AED,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'Fraunces,serif' }}>O</span>
        <strong>Orlode</strong>
        <span style={{ opacity: 0.5 }}>→</span>
        <span style={{ opacity: 0.7 }}>Connecteurs</span>
        <span style={{ opacity: 0.5 }}>→</span>
        <strong>Firebase</strong>
      </div>
      <div style={{ padding: '18px 24px', background: '#FFFAF0', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: '#FFF8E1', color: '#FFCA28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, fontFamily: 'Fraunces,serif', border: '1.5px solid rgba(255,202,40,0.3)' }}>F</div>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: PAL.ink }}>Firebase</div>
            <div style={{ fontSize: 11, color: PAL.inkSoft }}>● Données · Sync temps réel</div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: PAL.inkSoft, letterSpacing: '0.1em' }}>SERVICE ACCOUNT JSON</div>
        <textarea readOnly style={{
          flex: 1, background: '#F5EDD6', borderRadius: 10, padding: 12,
          fontFamily: 'monospace', fontSize: 10, color: PAL.ink, resize: 'none',
          border: active ? '2px solid #10B981' : '1px solid rgba(10,42,32,0.1)',
          boxShadow: active ? '0 0 0 4px rgba(16,185,129,0.2)' : 'none',
          transition: 'all 0.3s',
        }} value={`{
  "type": "service_account",
  "project_id": "ouihope-prod",
  "private_key_id": "8c4b...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkq...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "firebase-adminsdk-xyz@ouihope-prod.iam.gserviceaccount.com",
  "client_id": "112233445566778899",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth"
}`} />

        <button style={{
          background: `linear-gradient(135deg, ${PAL.firebase}, ${PAL.fbDeep})`,
          color: '#1F2937', border: 'none', borderRadius: 10, padding: '11px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {active ? <><CheckCircle2 size={14} /> Connexion validée</> : <>→ Tester la connexion</>}
        </button>
      </div>
    </PanelChrome>
  );
}

function CollectionsPanel({ active }: { active: boolean }) {
  const colls = [
    { name: 'users',      docs: '12 478', selected: true },
    { name: 'customers',  docs: '3 421',  selected: true },
    { name: 'orders',     docs: '8 812',  selected: true },
    { name: 'products',   docs: '512',    selected: true },
    { name: 'logs',       docs: '240 K',  selected: false },
    { name: '_internal',  docs: 'privé',  selected: false },
  ];
  return (
    <PanelChrome host="orlode.ai/admin/connectors/firebase/collections" accent={PAL.cyan}>
      <div style={{ padding: 18, background: '#FFFAF0', flex: 1 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: PAL.ink }}>
            Sélectionnez les collections
          </div>
          <div style={{ fontSize: 12, color: PAL.inkSoft }}>Vos agents IA verront uniquement ce qui est coché.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {colls.map((c) => (
            <div key={c.name} style={{
              background: c.selected ? '#ECFDF5' : '#FFFAF0',
              border: c.selected ? '1.5px solid #10B981' : '1.5px solid rgba(10,42,32,0.08)',
              borderRadius: 10, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: c.selected ? '#10B981' : '#fff', border: '1.5px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {c.selected && <CheckCircle2 size={11} color="#fff" />}
              </div>
              <strong style={{ fontSize: 13, color: PAL.ink }}>{c.name}</strong>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: PAL.inkSoft, fontFamily: 'monospace' }}>{c.docs}</span>
            </div>
          ))}
        </div>
        {active && (
          <div style={{
            marginTop: 14, padding: 12, background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
            borderRadius: 10, border: '1.5px solid #10B981',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontSize: 12, color: '#065F46', fontWeight: 700 }}>
              4 collections · 25 223 documents prêts à indexer
            </span>
          </div>
        )}
      </div>
    </PanelChrome>
  );
}

function SyncSuccessPanel({ active }: { active: boolean }) {
  return (
    <PanelChrome host="orlode.ai/admin/connectors" accent={PAL.emerald}>
      <div style={{ padding: 24, background: 'linear-gradient(135deg, #FFFAF0, #F5EDD6)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: 'linear-gradient(135deg, #10B981, #065F46)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, color: '#fff',
          boxShadow: '0 12px 40px -8px rgba(16,185,129,0.6)',
          animation: active ? 'bounce 1s ease-out' : 'none',
        }}>
          <CheckCircle2 size={50} strokeWidth={2.5} />
        </div>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 800, color: PAL.ink, margin: 0, letterSpacing: '-0.02em' }}>
          Firebase <em style={{ fontStyle: 'italic', color: '#065F46' }}>connecté</em> !
        </h2>
        <p style={{ fontSize: 13, color: PAL.inkSoft, margin: '8px 0 16px' }}>
          25 223 documents indexés · Sync temps réel actif
        </p>

        <div style={{
          background: '#fff', borderRadius: 12, padding: 14,
          border: `1px solid ${PAL.emerald}30`, width: '100%',
          boxShadow: '0 8px 24px -8px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: PAL.violet, letterSpacing: '0.1em', marginBottom: 8 }}>AGENTS BOOSTÉS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Sales', 'Support', 'Knowledge', 'Marketing', 'Compta', '+43'].map((a) => (
              <span key={a} style={{
                padding: '5px 12px', borderRadius: 100,
                background: '#F3E8FF', color: '#5B21B6',
                fontSize: 11, fontWeight: 700,
                border: '1px solid #C4B5FD',
              }}>{a}</span>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce { 0% { transform: scale(0.5); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }`}</style>
    </PanelChrome>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3D ARROWS — animated curves connecting stages
// ═════════════════════════════════════════════════════════════════════════════

function FlowArrow({ from, to, color }: { from: [number, number, number]; to: [number, number, number]; color: string }) {
  const lineRef = useRef<THREE.Line>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 1.2, 0));
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [from, to]);

  const points = useMemo(() => curve.getPoints(40), [curve]);
  const positions = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    return arr;
  }, [points]);

  useFrame(({ clock }) => {
    if (headRef.current) {
      const t = (Math.sin(clock.getElapsedTime() * 0.7) + 1) / 2;
      const pos = curve.getPoint(0.1 + t * 0.8);
      const tangent = curve.getTangent(0.1 + t * 0.8);
      headRef.current.position.copy(pos);
      headRef.current.lookAt(pos.clone().add(tangent));
    }
  });

  return (
    <group>
      {/* @ts-expect-error R3F line */}
      <line ref={lineRef as unknown as React.Ref<THREE.Line>}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.5} />
      </line>
      <mesh ref={headRef}>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CAMERA RIG — scroll-driven fly-through
// ═════════════════════════════════════════════════════════════════════════════

function CameraRig({ onProgress }: { onProgress: (offset: number) => void }) {
  const scroll = useScroll();
  useFrame((state) => {
    const offset = scroll.offset;
    onProgress(offset);
    const targetZ = 8 + offset * -45;
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.08);
    state.camera.position.y = Math.sin(offset * Math.PI * 2) * 0.4;
    state.camera.position.x = Math.sin(offset * Math.PI * 4) * 0.3;
    state.camera.lookAt(0, 0, targetZ - 5);
  });
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE
// ═════════════════════════════════════════════════════════════════════════════

function Scene({ onProgress }: { onProgress: (offset: number) => void }) {
  const [scrollOffset, setScrollOffset] = useState(0);

  return (
    <>
      <CameraRig onProgress={(o) => { setScrollOffset(o); onProgress(o); }} />

      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color={PAL.gold} />
      <pointLight position={[-10, -5, -20]} intensity={0.8} color={PAL.cyan} />
      <pointLight position={[0, 5, -40]} intensity={1} color={PAL.emerald} />

      <Stars radius={80} depth={50} count={3000} factor={4} saturation={0.5} fade speed={0.5} />

      <Suspense fallback={null}>
        <Environment preset="night" />

        {STAGES.map((s) => (
          <Stage key={s.id} stage={s} scrollOffset={scrollOffset} />
        ))}

        {/* Arrows between consecutive stages */}
        {STAGES.slice(0, -1).map((s, i) => (
          <FlowArrow
            key={`arrow-${s.id}`}
            from={[2.8, 0, s.z]}
            to={[-2.8, 0, STAGES[i + 1].z]}
            color={s.color}
          />
        ))}

        {/* Big floating title at the start */}
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
          <Text
            position={[0, 3, 4]}
            fontSize={0.9}
            color={PAL.cream}
            anchorX="center"
            anchorY="middle"
          >
            FIREBASE → ORLODE
          </Text>
          <Text
            position={[0, 2, 4]}
            fontSize={0.3}
            color={PAL.gold}
            anchorX="center"
            anchorY="middle"
          >
            5 étapes · scroll pour avancer
          </Text>
        </Float>
      </Suspense>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2D HUD OVERLAY — current step indicator
// ═════════════════════════════════════════════════════════════════════════════

function HUD({ scrollOffset }: { scrollOffset: number }) {
  const currentStage = Math.min(STAGES.length - 1, Math.floor(scrollOffset * STAGES.length));
  const stage = STAGES[currentStage];
  const Icon = stage.icon;

  return (
    <>
      {/* Top-left brand */}
      <div style={{
        position: 'fixed', top: 24, left: 24, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(10,42,32,0.6)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,160,23,0.3)',
        borderRadius: 14, padding: '10px 16px',
        color: PAL.cream,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${PAL.violet}, ${PAL.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'Fraunces, serif' }}>O</div>
        <div>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 14 }}>Orlode</div>
          <div style={{ fontSize: 10, color: PAL.gold, letterSpacing: '0.1em' }}>FIREBASE 3D · TUTORIEL</div>
        </div>
      </div>

      {/* Bottom-center — current step */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(10,42,32,0.75)', backdropFilter: 'blur(24px)',
            border: `1.5px solid ${stage.color}50`,
            borderRadius: 18, padding: '14px 22px',
            display: 'flex', alignItems: 'center', gap: 14,
            color: PAL.cream, minWidth: 380,
            boxShadow: `0 12px 40px -8px ${stage.color}80`,
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: `linear-gradient(135deg, ${stage.color}, ${stage.color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1F2937', flexShrink: 0,
          }}>
            <Icon size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: stage.color, letterSpacing: '0.1em' }}>
              ÉTAPE {String(stage.id).padStart(2, '0')} / {String(STAGES.length).padStart(2, '0')}
            </div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700 }}>{stage.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.8)' }}>{stage.subtitle}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Right — progress bar */}
      <div style={{
        position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)',
        zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {STAGES.map((s, i) => {
          const isActive = i === currentStage;
          const isPast = i < currentStage;
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: isPast ? 0.5 : 1,
              transition: 'all 0.3s',
            }}>
              <div style={{
                width: isActive ? 28 : 8, height: 8, borderRadius: 100,
                background: isActive ? s.color : (isPast ? PAL.gold : 'rgba(255,250,240,0.3)'),
                boxShadow: isActive ? `0 0 14px ${s.color}` : 'none',
                transition: 'all 0.3s',
              }} />
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  0{s.id}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Top-right — overall progress */}
      <div style={{
        position: 'fixed', top: 24, right: 24, zIndex: 10,
        background: 'rgba(10,42,32,0.6)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,160,23,0.3)',
        borderRadius: 14, padding: '8px 14px',
        color: PAL.cream, fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11, fontWeight: 700,
      }}>
        {String(Math.floor(scrollOffset * 100)).padStart(3, '0')}%
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function FirebaseConnect3DPage() {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative',
      background: 'radial-gradient(circle at 50% 50%, #042A1F 0%, #000 70%)',
    }}>
      <Canvas
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 0, 8], fov: 55, far: 200 }}
        dpr={[1, 2]}
      >
        <ScrollControls pages={STAGES.length + 0.5} damping={0.25}>
          <Scene onProgress={setScrollOffset} />
        </ScrollControls>
      </Canvas>

      <HUD scrollOffset={scrollOffset} />

      {/* Initial scroll hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, 120px)',
              zIndex: 5,
              color: PAL.gold,
              fontFamily: 'Fraunces, serif',
              fontSize: 16,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight size={28} style={{ transform: 'rotate(90deg)' }} />
            </motion.div>
            <span style={{ fontStyle: 'italic' }}>scroll pour démarrer</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
