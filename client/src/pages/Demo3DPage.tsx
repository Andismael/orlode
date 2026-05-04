/**
 * Demo3DPage — Showcase of 3D capabilities with Three.js / React Three Fiber
 * 4 interactive demos: Particle Globe, 3D Agent Cards, Animated Logo, Data Viz
 */
import { useState, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Float, Text3D, Center, RoundedBox, MeshDistortMaterial, Environment, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Box, Globe2, CreditCard, Type, BarChart3 } from 'lucide-react';

// ─── 1. PARTICLE GLOBE ─────────────────────────────────────────────────────

function ParticleGlobe() {
  const meshRef = useRef<THREE.Points>(null);
  const count = 3000;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 2;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Color gradient: blue to cyan
      const t = i / count;
      color.setHSL(0.55 + t * 0.1, 0.8, 0.5 + t * 0.3);
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    return [pos, col];
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.15;
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.1;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} vertexColors transparent opacity={0.9} sizeAttenuation />
    </points>
  );
}

function GlobeConnections() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const count = 200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      // Random connections on sphere surface
      for (let j = 0; j < 2; j++) {
        const phi = Math.random() * Math.PI;
        const theta = Math.random() * Math.PI * 2;
        const r = 2;
        pos[i * 6 + j * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 6 + j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 6 + j * 3 + 2] = r * Math.cos(phi);
      }
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    lineRef.current.rotation.y = clock.getElapsedTime() * 0.15;
    lineRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.1;
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#3b82f6" transparent opacity={0.08} />
    </lineSegments>
  );
}

function FloatingRings() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring1.current) { ring1.current.rotation.x = t * 0.3; ring1.current.rotation.z = t * 0.1; }
    if (ring2.current) { ring2.current.rotation.y = t * 0.2; ring2.current.rotation.x = t * 0.15; }
    if (ring3.current) { ring3.current.rotation.z = t * 0.25; ring3.current.rotation.y = t * 0.1; }
  });

  return (
    <>
      <mesh ref={ring1}>
        <torusGeometry args={[2.8, 0.01, 16, 100]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[3.2, 0.008, 16, 100]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} />
      </mesh>
      <mesh ref={ring3}>
        <torusGeometry args={[3.5, 0.006, 16, 100]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.15} />
      </mesh>
    </>
  );
}

function GlobeScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <ParticleGlobe />
      <GlobeConnections />
      <FloatingRings />
      <Stars radius={50} depth={50} count={1000} factor={3} fade speed={1} />
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
    </>
  );
}

// ─── 2. 3D AGENT CARDS ─────────────────────────────────────────────────────

function AgentCard3D({ position, color, name, icon, delay }: {
  position: [number, number, number];
  color: string;
  name: string;
  icon: string;
  delay: number;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.8 + delay) * 0.15;
    meshRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5 + delay) * 0.1;
  });

  return (
    <group ref={meshRef} position={position}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
        <RoundedBox
          args={[1.6, 2.2, 0.15]}
          radius={0.12}
          smoothness={4}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          scale={hovered ? 1.08 : 1}
        >
          <meshPhysicalMaterial
            color={color}
            metalness={0.1}
            roughness={0.2}
            transparent
            opacity={0.92}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </RoundedBox>
        {/* Icon */}
        <Html position={[0, 0.3, 0.09]} center transform distanceFactor={4}>
          <div style={{
            fontSize: '32px',
            textAlign: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {icon}
          </div>
        </Html>
        {/* Name */}
        <Html position={[0, -0.5, 0.09]} center transform distanceFactor={4}>
          <div style={{
            color: 'white',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {name}
          </div>
        </Html>
      </Float>
    </group>
  );
}

function CardsScene() {
  const agents = [
    { name: 'Reception', color: '#1e40af', icon: '\u{1F3E2}', pos: [-3.5, 0, 0] as [number, number, number] },
    { name: 'IT Support', color: '#7c3aed', icon: '\u{1F4BB}', pos: [-1.2, 0.5, 0.5] as [number, number, number] },
    { name: 'Ventes', color: '#059669', icon: '\u{1F4C8}', pos: [1.2, 0, 0.3] as [number, number, number] },
    { name: 'Marketing', color: '#dc2626', icon: '\u{1F4E3}', pos: [3.5, 0.3, 0] as [number, number, number] },
  ];

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <pointLight position={[-5, 3, -5]} intensity={0.5} color="#818cf8" />
      {agents.map((a, i) => (
        <AgentCard3D key={a.name} position={a.pos} color={a.color} name={a.name} icon={a.icon} delay={i * 1.2} />
      ))}
      <Environment preset="city" />
      <OrbitControls enableZoom={false} maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 3} />
    </>
  );
}

// ─── 3. ANIMATED LOGO / MORPHING SPHERE ─────────────────────────────────────

function MorphingSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.15;
  });

  return (
    <mesh ref={meshRef} scale={2}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshDistortMaterial
        color="#3b82f6"
        metalness={0.3}
        roughness={0.15}
        distort={0.4}
        speed={2}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function LogoText() {
  return (
    <Center position={[0, 0, 2.5]}>
      <Text3D
        font="/fonts/inter-bold.json"
        size={0.6}
        height={0.15}
        bevelEnabled
        bevelSize={0.02}
        bevelThickness={0.01}
        letterSpacing={0.05}
      >
        Orlode
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.8}
          roughness={0.1}
          clearcoat={1}
          emissive="#3b82f6"
          emissiveIntensity={0.15}
        />
      </Text3D>
    </Center>
  );
}

function LogoScene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <pointLight position={[-5, -5, 5]} intensity={0.8} color="#8b5cf6" />
      <pointLight position={[5, -5, -5]} intensity={0.5} color="#06b6d4" />
      <MorphingSphere />
      <Stars radius={30} depth={30} count={500} factor={2} fade speed={0.5} />
      <Environment preset="night" />
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} />
    </>
  );
}

// ─── 4. 3D DATA VISUALIZATION ──────────────────────────────────────────────

function Bar3D({ position, height, color, label }: {
  position: [number, number, number];
  height: number;
  color: string;
  label: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const targetHeight = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    // Animate height on mount
    targetHeight.current = THREE.MathUtils.lerp(targetHeight.current, height, 0.03);
    meshRef.current.scale.y = targetHeight.current;
    meshRef.current.position.y = targetHeight.current / 2;
    // Subtle pulse when hovered
    if (hovered) {
      meshRef.current.scale.x = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.05;
      meshRef.current.scale.z = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.05;
    }
  });

  return (
    <group position={position}>
      <RoundedBox
        ref={meshRef}
        args={[0.6, 1, 0.6]}
        radius={0.05}
        smoothness={4}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshPhysicalMaterial
          color={hovered ? '#f59e0b' : color}
          metalness={0.2}
          roughness={0.3}
          clearcoat={0.5}
          emissive={hovered ? '#f59e0b' : color}
          emissiveIntensity={hovered ? 0.3 : 0.05}
        />
      </RoundedBox>
      {/* Label */}
      <Html position={[0, -0.3, 0]} center>
        <div style={{
          color: '#94a3b8',
          fontSize: '10px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {label}
        </div>
      </Html>
      {/* Value */}
      {hovered && (
        <Html position={[0, height + 0.3, 0]} center>
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {Math.round(height * 25)}
          </div>
        </Html>
      )}
    </group>
  );
}

function GridFloor() {
  return (
    <gridHelper args={[20, 20, '#1e293b', '#0f172a']} position={[0, -0.01, 0]} />
  );
}

function DataScene() {
  const data = [
    { label: 'Lun', height: 2.8, color: '#3b82f6' },
    { label: 'Mar', height: 3.5, color: '#6366f1' },
    { label: 'Mer', height: 2.2, color: '#8b5cf6' },
    { label: 'Jeu', height: 4.1, color: '#a855f7' },
    { label: 'Ven', height: 3.0, color: '#06b6d4' },
    { label: 'Sam', height: 1.5, color: '#14b8a6' },
    { label: 'Dim', height: 0.8, color: '#10b981' },
  ];

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <pointLight position={[-3, 5, -3]} intensity={0.4} color="#8b5cf6" />
      {data.map((d, i) => (
        <Bar3D
          key={d.label}
          position={[(i - 3) * 1.1, 0, 0]}
          height={d.height}
          color={d.color}
          label={d.label}
        />
      ))}
      <GridFloor />
      <OrbitControls enableZoom={false} maxPolarAngle={Math.PI / 2.2} minPolarAngle={Math.PI / 4} />
    </>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

const demos = [
  { id: 'globe', label: 'Globe Particules', icon: Globe2, description: 'Globe 3D avec 3000 particules, connexions et anneaux orbitaux' },
  { id: 'cards', label: 'Cartes 3D Agents', icon: CreditCard, description: 'Cartes flottantes avec materiaux glass et reflexions' },
  { id: 'logo', label: 'Logo Morphing', icon: Type, description: 'Sphere morphing avec distortion et texte 3D' },
  { id: 'data', label: 'Data Viz 3D', icon: BarChart3, description: 'Graphique barres 3D interactif avec hover effects' },
] as const;

type DemoId = typeof demos[number]['id'];

export default function Demo3DPage() {
  const [active, setActive] = useState<DemoId>('globe');

  const renderScene = () => {
    switch (active) {
      case 'globe': return <GlobeScene />;
      case 'cards': return <CardsScene />;
      case 'logo': return <LogoScene />;
      case 'data': return <DataScene />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Box className="text-blue-500" size={28} />
              Demo 3D — Three.js + React Three Fiber
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Interactif : cliquez et glissez pour tourner, scrollez pour zoomer
            </p>
          </div>
          <a
            href="/reception"
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <RotateCcw size={14} /> Retour
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Demo selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {demos.map((demo) => {
            const Icon = demo.icon;
            const isActive = active === demo.id;
            return (
              <motion.button
                key={demo.id}
                onClick={() => setActive(demo.id)}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon size={20} className={isActive ? 'text-blue-400' : 'text-gray-500'} />
                <p className={`font-semibold mt-2 text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
                  {demo.label}
                </p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{demo.description}</p>
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-blue-500"
                    layoutId="activeBorder"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* 3D Canvas */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-950"
            style={{ height: '65vh', minHeight: 500 }}
          >
            <Canvas
              camera={{ position: [0, 2, 6], fov: 50 }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
            >
              <Suspense fallback={null}>
                {renderScene()}
              </Suspense>
            </Canvas>

            {/* Overlay info */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">
                {demos.find(d => d.id === active)?.description}
              </p>
            </div>

            {/* FPS-like badge */}
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-300 font-mono">WebGL 2.0</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Tech stack badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {['Three.js', 'React Three Fiber', '@react-three/drei', 'WebGL 2.0', 'Framer Motion', 'GLSL Shaders'].map(tech => (
            <span key={tech} className="px-3 py-1 text-xs font-mono bg-gray-900 border border-gray-800 rounded-full text-gray-400">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
