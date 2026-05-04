/**
 * CloneAvatar — 3D animated orb with 4 states
 * idle     : gentle float, slow breathing glow
 * listening: subtle pulse, ears-open feel, bright ring
 * thinking : fast morph, spinning particles, color shift
 * speaking : rhythmic pulse, expanding waves, full glow
 */
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'typing';

interface CloneAvatarProps {
  primaryColor?: string;
  accentColor?: string;
  state?: AvatarState;
  /** @deprecated Use state instead */ speaking?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  reducedMotion?: boolean;
}

function resolveState(props: CloneAvatarProps): AvatarState {
  if (props.state) return props.state;
  if (props.speaking) return 'speaking';
  return 'idle';
}

// ══════════════════════════════════════════════════════════════════════════════
// 3D VERSION (Three.js)
// ══════════════════════════════════════════════════════════════════════════════

function AnimatedOrb({ primaryColor, accentColor, avatarState }: { primaryColor: string; accentColor: string; avatarState: AvatarState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<{ distort: number; speed: number }>(null);

  const color1 = useMemo(() => new THREE.Color(primaryColor), [primaryColor]);
  const color2 = useMemo(() => new THREE.Color(accentColor), [accentColor]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!meshRef.current || !materialRef.current) return;

    const m = meshRef.current;
    const mat = materialRef.current;

    switch (avatarState) {
      case 'idle': {
        // Gentle breathing — slow, calm, alive
        const breath = Math.sin(t * 1.2) * 0.015;
        m.scale.setScalar(1 + breath);
        m.rotation.y = t * 0.1;
        m.rotation.x = Math.sin(t * 0.4) * 0.05;
        mat.distort += (0.2 + Math.sin(t * 0.8) * 0.03 - mat.distort) * 0.08;
        mat.speed = 1.5;
        break;
      }
      case 'listening': {
        // Attentive — subtle rhythmic pulse, slightly brighter
        const pulse = Math.sin(t * 3) * 0.03;
        m.scale.setScalar(1.02 + pulse);
        m.rotation.y = t * 0.2;
        m.rotation.x = Math.sin(t * 1) * 0.08;
        mat.distort += (0.3 + Math.sin(t * 4) * 0.05 - mat.distort) * 0.1;
        mat.speed = 3;
        break;
      }
      case 'thinking': {
        // Processing — fast morph, spinning, color shift feel
        m.scale.setScalar(0.98 + Math.sin(t * 5) * 0.04);
        m.rotation.y = t * 0.8;
        m.rotation.x = Math.sin(t * 2) * 0.15;
        mat.distort += (0.45 + Math.sin(t * 6) * 0.1 - mat.distort) * 0.12;
        mat.speed = 6;
        break;
      }
      case 'speaking': {
        // Talking — rhythmic, confident, expanding
        const wave = Math.sin(t * 8) * 0.06;
        m.scale.setScalar(1.05 + wave);
        m.rotation.y = t * 0.4;
        m.rotation.x = Math.sin(t * 1.5) * 0.1;
        mat.distort += (0.5 + Math.sin(t * 10) * 0.12 - mat.distort) * 0.1;
        mat.speed = 5;
        break;
      }
    }
  });

  const emissiveIntensity = avatarState === 'idle' ? 0.1 : avatarState === 'listening' ? 0.2 : avatarState === 'thinking' ? 0.35 : 0.45;

  return (
    <Float
      speed={avatarState === 'thinking' ? 4 : avatarState === 'speaking' ? 3 : avatarState === 'listening' ? 2 : 1.2}
      rotationIntensity={avatarState === 'thinking' ? 0.6 : 0.2}
      floatIntensity={avatarState === 'speaking' ? 0.6 : 0.3}
    >
      <Sphere ref={meshRef} args={[1, 64, 64]}>
        <MeshDistortMaterial
          ref={materialRef as any}
          color={color1}
          emissive={avatarState === 'thinking' ? new THREE.Color('#ffffff') : color2}
          emissiveIntensity={emissiveIntensity}
          roughness={0.15}
          metalness={0.85}
          distort={0.2}
          speed={2}
          envMapIntensity={1.2}
        />
      </Sphere>
      {/* Inner core — brighter when active */}
      <Sphere args={[0.8, 32, 32]}>
        <meshBasicMaterial color={accentColor} transparent opacity={avatarState === 'idle' ? 0.03 : avatarState === 'thinking' ? 0.12 : 0.08} />
      </Sphere>
    </Float>
  );
}

export default function CloneAvatar(props: CloneAvatarProps) {
  const { primaryColor = '#7C3AED', accentColor = '#9333EA', size = 'md', className = '' } = props;
  const avatarState = resolveState(props);
  const sizeMap = { sm: 'w-16 h-16', md: 'w-28 h-28', lg: 'w-44 h-44' };

  return (
    <div className={`${sizeMap[size]} ${className}`}>
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-3, -3, 2]} intensity={0.5} color={accentColor} />
        <AnimatedOrb primaryColor={primaryColor} accentColor={accentColor} avatarState={avatarState} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIGHT VERSION (CSS-only, zero Three.js)
// ══════════════════════════════════════════════════════════════════════════════

export function CloneAvatarLight(props: CloneAvatarProps) {
  const { primaryColor = '#7C3AED', accentColor = '#9333EA', size = 'md', className = '' } = props;
  const avatarState = resolveState(props);
  const sizeMap = { sm: 'w-10 h-10', md: 'w-16 h-16', lg: 'w-24 h-24' };

  // Detect prefers-reduced-motion
  const prefersReduced = props.reducedMotion ?? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

  // Smooth easing transition duration (longer for state changes = smoother)
  const easeDuration = '600ms';
  const easeFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';

  // State-specific values
  const glowOpacity = { idle: '25', listening: '40', thinking: '50', speaking: '55', error: '20', typing: '30' }[avatarState];
  const glowScale = { idle: 'scale(1.1)', listening: 'scale(1.2)', thinking: 'scale(1.3)', speaking: 'scale(1.4)', error: 'scale(1.05)', typing: 'scale(1.12)' }[avatarState];
  const orbScale = { idle: 'scale(1)', listening: 'scale(1.02)', thinking: 'scale(0.97)', speaking: 'scale(1.05)', error: 'scale(0.95)', typing: 'scale(1.01)' }[avatarState];
  const shineOpacity = { idle: 0.25, listening: 0.3, thinking: 0.35, speaking: 0.4, error: 0.1, typing: 0.28 }[avatarState];
  const dotColor = { idle: 'bg-gray-400', listening: 'bg-green-400', thinking: 'bg-yellow-400', speaking: 'bg-blue-400', error: 'bg-red-500', typing: 'bg-green-300' }[avatarState];

  if (prefersReduced) {
    // Reduced motion: static orb with color/dot changes only — no animation
    return (
      <div className={`relative ${sizeMap[size]} ${className}`}>
        <div className="absolute inset-0 rounded-full blur-md" style={{ background: `radial-gradient(circle, ${accentColor}${glowOpacity}, transparent)`, transition: `all ${easeDuration} ${easeFunction}`, transform: glowScale }} />
        <div className="relative w-full h-full rounded-full shadow-lg" style={{ background: `radial-gradient(circle at 30% 30%, ${accentColor}, ${primaryColor})`, transition: `all ${easeDuration} ${easeFunction}`, transform: orbScale }}>
          <div className="absolute inset-2 rounded-full" style={{ background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,${shineOpacity}), transparent)` }} />
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${dotColor}`} style={{ transition: `all ${easeDuration} ${easeFunction}` }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${sizeMap[size]} ${className}`}>
      {/* Outer glow — smooth transition between all states */}
      <div className="absolute inset-0 rounded-full blur-lg"
        style={{ background: `radial-gradient(circle, ${accentColor}${glowOpacity}, transparent)`, transform: glowScale, transition: `all ${easeDuration} ${easeFunction}` }} />

      {/* Main orb — smooth scale + background transitions */}
      <div className={`relative w-full h-full rounded-full shadow-lg ${avatarState === 'thinking' ? 'animate-spin' : ''}`}
        style={{
          background: avatarState === 'thinking'
            ? `conic-gradient(from 0deg, ${primaryColor}, ${accentColor}, ${primaryColor})`
            : `radial-gradient(circle at 30% 30%, ${accentColor}, ${primaryColor})`,
          transform: orbScale,
          transition: `transform ${easeDuration} ${easeFunction}, background ${easeDuration} ${easeFunction}`,
          animationDuration: avatarState === 'thinking' ? '2.5s' : undefined,
          animationTimingFunction: 'linear',
        }}>
        {/* Inner shine — opacity transitions smoothly */}
        <div className="absolute inset-2 rounded-full"
          style={{ background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,${shineOpacity}), transparent)`, transition: `all ${easeDuration} ${easeFunction}` }} />

        {/* State indicator dot — smooth color change */}
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${dotColor} ${avatarState !== 'idle' ? 'animate-pulse' : ''}`}
          style={{ transition: `background-color ${easeDuration} ${easeFunction}` }} />
      </div>

      {/* Listening ring — fades in smoothly */}
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `2px solid ${avatarState === 'listening' ? `${accentColor}60` : 'transparent'}`,
          transform: avatarState === 'listening' ? 'scale(1.15)' : 'scale(1)',
          opacity: avatarState === 'listening' ? 1 : 0,
          transition: `all ${easeDuration} ${easeFunction}`,
        }} />

      {/* Thinking rings — fade in/out smoothly */}
      <div className={`absolute inset-0 rounded-full pointer-events-none ${avatarState === 'thinking' ? 'animate-spin' : ''}`}
        style={{
          border: `2px dashed ${avatarState === 'thinking' ? `${accentColor}40` : 'transparent'}`,
          opacity: avatarState === 'thinking' ? 1 : 0,
          animationDuration: '3s',
          transition: `opacity ${easeDuration} ${easeFunction}`,
        }} />
      <div className={`absolute inset-0 rounded-full pointer-events-none ${avatarState === 'thinking' ? 'animate-spin' : ''}`}
        style={{
          border: `2px dashed ${avatarState === 'thinking' ? `${primaryColor}30` : 'transparent'}`,
          opacity: avatarState === 'thinking' ? 1 : 0,
          animationDuration: '2s', animationDirection: 'reverse',
          transition: `opacity ${easeDuration} ${easeFunction}`,
        }} />

      {/* Speaking waves — fade in/out */}
      <div className={`absolute inset-0 rounded-full pointer-events-none ${avatarState === 'speaking' ? 'animate-ping' : ''}`}
        style={{
          border: `2px solid ${avatarState === 'speaking' ? `${accentColor}40` : 'transparent'}`,
          opacity: avatarState === 'speaking' ? 1 : 0,
          animationDuration: '1.5s',
          transition: `opacity ${easeDuration} ${easeFunction}`,
        }} />
      <div className={`absolute inset-0 rounded-full pointer-events-none ${avatarState === 'speaking' ? 'animate-ping' : ''}`}
        style={{
          border: `1px solid ${avatarState === 'speaking' ? `${accentColor}25` : 'transparent'}`,
          opacity: avatarState === 'speaking' ? 1 : 0,
          animationDuration: '2s', animationDelay: '0.3s',
          transition: `opacity ${easeDuration} ${easeFunction}`,
        }} />

      {/* Error state — red glow overlay */}
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: avatarState === 'error' ? 'radial-gradient(circle, rgba(239,68,68,0.25), transparent)' : 'none',
          opacity: avatarState === 'error' ? 1 : 0,
          transition: `opacity ${easeDuration} ${easeFunction}`,
        }} />

      {/* Typing shimmer — subtle light sweep */}
      <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
        style={{
          opacity: avatarState === 'typing' ? 1 : 0,
          transition: `opacity ${easeDuration} ${easeFunction}`,
        }}>
        <div className="absolute inset-0"
          style={{
            background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)`,
            animation: avatarState === 'typing' ? 'shimmer 2s infinite' : 'none',
          }} />
      </div>

      {/* Shimmer keyframe injected via style tag */}
      {avatarState === 'typing' && (
        <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
      )}
    </div>
  );
}
