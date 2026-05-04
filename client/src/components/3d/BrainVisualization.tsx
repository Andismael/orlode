/**
 * BrainVisualization — 3D orchestrator brain with orbiting agent nodes
 * Vanilla Three.js wrapped in React (for landing page performance)
 * Features: pulsing core, orbiting agents, data pulses, click-to-inspect, agent icons via CSS
 */
import { useEffect, useRef, useState } from 'react';

const AGENTS = [
  { id: 'orchestrateur', name: 'Orchestrateur', role: 'Cerveau Central', icon: '\u{1F9E0}', color: '#f59e0b', desc: "Le noyau central. Coordonne tous les agents et route les requetes.", skills: ['Routage', 'Coordination', 'Memoire globale'] },
  { id: 'knowledge', name: 'Knowledge', role: 'Documents & Q&A', icon: '\u{1F4DA}', color: '#3b82f6', desc: "Le cerveau documentaire. Recherche, analyse, corrige, lit a haute voix.", skills: ['RAG', 'Analyse', 'TTS', 'Correction'] },
  { id: 'rh', name: 'RH', role: 'Ressources Humaines', icon: '\u{1F465}', color: '#6366f1', desc: "Conges, recrutement, onboarding, evaluations.", skills: ['Conges', 'Onboarding', 'Paie'] },
  { id: 'commercial', name: 'Commercial', role: 'Ventes & CRM', icon: '\u{1F4B0}', color: '#10b981', desc: "Pipeline, leads, devis, propositions commerciales.", skills: ['Pipeline', 'Leads', 'Devis'] },
  { id: 'support', name: 'Support', role: 'Service Client', icon: '\u{1F3A7}', color: '#06b6d4', desc: "Tickets 24/7, FAQ, chat en direct, escalade.", skills: ['Tickets', 'FAQ', 'Chat'] },
  { id: 'it', name: 'IT', role: 'Infrastructure Tech', icon: '\u{2699}\u{FE0F}', color: '#8b5cf6', desc: "Monitoring, helpdesk, assets, licences.", skills: ['Helpdesk', 'Assets', 'Monitoring'] },
  { id: 'juridique', name: 'Juridique', role: 'Conformite & Droit', icon: '\u{2696}\u{FE0F}', color: '#ec4899', desc: "Contrats, RGPD, conformite, risques.", skills: ['Contrats', 'RGPD', 'Conformite'] },
  { id: 'marketing', name: 'Marketing', role: 'Marketing Digital', icon: '\u{1F4E3}', color: '#f43f5e', desc: "Social media, contenu, campagnes, SEO.", skills: ['Social', 'Contenu', 'Video AI'] },
  { id: 'finance', name: 'Finance', role: 'Comptabilite', icon: '\u{1F4CA}', color: '#14b8a6', desc: "Factures, tresorerie, budget, rapports.", skills: ['Factures', 'Budget', 'Cash flow'] },
  { id: 'reception', name: 'Reception', role: 'Accueil & Presence', icon: '\u{1F6AA}', color: '#f97316', desc: "Visiteurs, pointage, badges, kiosk.", skills: ['Check-in', 'Badges', 'Kiosk'] },
  { id: 'formation', name: 'Formation', role: 'E-Learning', icon: '\u{1F393}', color: '#a855f7', desc: "Cours, quiz, certifications, parcours.", skills: ['Cours', 'Quiz', 'Certs'] },
  { id: 'securite', name: 'Securite', role: 'Cybersecurite', icon: '\u{1F6E1}\u{FE0F}', color: '#dc2626', desc: "Menaces, audit, incidents, compliance.", skills: ['Audit', 'Incidents', 'IAM'] },
  { id: 'vision', name: 'Insights', role: 'Analytics & BI', icon: '\u{1F52C}', color: '#7c3aed', desc: "Tendances, predictions, KPIs, dashboards.", skills: ['Analytics', 'Predictions', 'KPIs'] },
  { id: 'comms', name: 'Communications', role: 'Emails & Notifs', icon: '\u{1F4E7}', color: '#e11d48', desc: "Emails, notifications, rapports, briefs.", skills: ['Emails', 'Rapports', 'Briefs'] },
  { id: 'data', name: 'Data Scientist', role: 'Data & ML', icon: '\u{1F52E}', color: '#0ea5e9', desc: "Correlations, predictions, anomalies.", skills: ['ML', 'Predictions', 'Anomalies'] },
  { id: 'coach', name: 'Coach', role: 'Mentorat', icon: '\u{1F9D1}\u{200D}\u{1F3EB}', color: '#84cc16', desc: "Bien-etre, mentorat, feedback.", skills: ['Coaching', 'Bien-etre'] },
  { id: 'news', name: 'Veille', role: 'News & Tendances', icon: '\u{2B50}', color: '#eab308', desc: "News sectorielles, concurrents, alertes.", skills: ['News', 'Veille', 'Alertes'] },
  { id: 'meeting', name: 'Reunions', role: 'Transcription & Resume', icon: '\u{1F3A4}', color: '#e11d48', desc: "Transcrit, resume, actions a suivre.", skills: ['Transcription', 'Resume', 'Actions'] },
  { id: 'wildcard', name: 'Wildcard', role: 'Agent Universel', icon: '\u{1F52E}', color: '#a855f7', desc: "Fait tout ce que les autres ne font pas.", skills: ['Polyvalent', 'Creatif'] },
  { id: 'setup', name: 'Setup', role: 'Configuration BYOE', icon: '\u{1F527}', color: '#0891b2', desc: "Configure les environnements clients.", skills: ['BYOE', 'API Keys', 'WhatsApp'] },
];

const PULSE_MESSAGES = [
  "\u{1F4E9} Requete RH \u2192 Verification conges",
  "\u{1F4B0} Lead qualifie \u2192 Pipeline mis a jour",
  "\u{1F3A7} Ticket #3891 \u2192 Escalade support",
  "\u{2699}\u{FE0F} Alerte infra \u2192 Scan serveur",
  "\u{2696}\u{FE0F} Contrat \u2192 Analyse juridique",
  "\u{1F4E3} Campagne \u2192 Publication reseaux",
  "\u{1F4CA} Rapport \u2192 Generation en cours",
  "\u{1F52C} Anomalie \u2192 Analyse data",
  "\u{1F6E1}\u{FE0F} Intrusion \u2192 Scan securite",
  "\u{1F4DA} Question \u2192 Recherche Knowledge",
  "\u{1F6AA} Visiteur \u2192 Check-in reception",
  "\u{1F393} Module termine \u2192 Certification",
];

interface AgentData {
  id: string; name: string; role: string; icon: string; color: string; desc: string; skills: string[];
}

export default function BrainVisualization({ height = '85vh' }: { height?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [pulseMsg, setPulseMsg] = useState('');
  const [requestCount, setRequestCount] = useState(0);
  const [agentIcons, setAgentIcons] = useState<Array<{ x: number; y: number; icon: string; color: string; scale: number }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Dynamic import Three.js
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = () => initScene();
    document.head.appendChild(script);

    function initScene() {
      const THREE = (window as any).THREE;
      if (!THREE) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
      camera.position.set(0, 2, 18);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const brainGroup = new THREE.Group();
      scene.add(brainGroup);

      // Lighting
      scene.add(new THREE.AmbientLight(0x1a2a4a, 0.5));
      const coreLight = new THREE.PointLight(0xf59e0b, 2, 50);
      scene.add(coreLight);
      scene.add(new THREE.PointLight(0x3b82f6, 0.6, 40).position.set(10, 5, -5) && new THREE.PointLight(0x3b82f6, 0.6, 40));

      // Core
      const coreGeo = new THREE.IcosahedronGeometry(1.5, 2);
      const coreMat = new THREE.MeshPhongMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, shininess: 120 });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      brainGroup.add(coreMesh);

      const wireGeo = new THREE.IcosahedronGeometry(1.8, 1);
      const wireMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.15 });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      brainGroup.add(wireMesh);

      const glowGeo = new THREE.SphereGeometry(2.2, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.05 });
      brainGroup.add(new THREE.Mesh(glowGeo, glowMat));

      // Agent nodes
      const agents = AGENTS.slice(1);
      const agentMeshes: any[] = [];
      const agentPositions: any[] = [];
      const connections: any[] = [];

      agents.forEach((agent, i) => {
        const total = agents.length;
        const ring = i < 10 ? 0 : 1;
        const ringCount = ring === 0 ? 10 : total - 10;
        const ringIndex = ring === 0 ? i : i - 10;
        const radius = ring === 0 ? 5.5 : 8.5;
        const ySpread = ring === 0 ? 2.5 : 4;

        const angle = (ringIndex / ringCount) * Math.PI * 2 + (ring * 0.3);
        const y = (Math.sin(angle * 2.5 + ring) * ySpread * 0.4);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const color = new THREE.Color(agent.color);
        const geo = new THREE.SphereGeometry(0.5, 24, 24);
        const mat = new THREE.MeshPhongMaterial({
          color, emissive: color, emissiveIntensity: 0.25,
          transparent: true, opacity: 0.92, shininess: 80,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.userData = { agent, baseY: y, idx: i, flashIntensity: 0.25 };
        brainGroup.add(mesh);

        // Ring around agent
        const ringGeo = new THREE.RingGeometry(0.6, 0.68, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(mesh.position);
        ringMesh.lookAt(0, 0, 0);
        brainGroup.add(ringMesh);

        agentMeshes.push(mesh);
        agentPositions.push(new THREE.Vector3(x, y, z));

        // Connection to core
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, y, z)];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.08 });
        const line = new THREE.Line(lineGeo, lineMat);
        brainGroup.add(line);
        connections.push({ line, mat: lineMat, idx: i, baseOpacity: 0.08 });
      });

      // Inter-agent connections
      agentPositions.forEach((p1: any, i: number) => {
        agentPositions.forEach((p2: any, j: number) => {
          if (j <= i) return;
          if (p1.distanceTo(p2) < 5.5) {
            const g = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const m = new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.04 });
            brainGroup.add(new THREE.Line(g, m));
          }
        });
      });

      // Background particles
      const pCount = 500;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 14 + Math.random() * 14;
        pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pPos[i * 3 + 2] = r * Math.cos(phi);
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({ color: 0x3b82f6, size: 0.05, transparent: true, opacity: 0.4 });
      const particlesGroup = new THREE.Points(pGeo, pMat);
      scene.add(particlesGroup);

      // Pulses
      const pulses: any[] = [];

      function createPulse(targetIdx: number) {
        const agent = agents[targetIdx];
        const c = new THREE.Color(agent.color);

        // Main pulse
        const geo = new THREE.SphereGeometry(0.1, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(geo, mat);
        brainGroup.add(mesh);

        // Trail
        const tGeo = new THREE.SphereGeometry(0.05, 6, 6);
        const tMat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5 });
        const trail = new THREE.Mesh(tGeo, tMat);
        brainGroup.add(trail);

        pulses.push({ mesh, trail, mat, tMat, targetIdx, progress: 0, speed: 0.01 + Math.random() * 0.01, returning: false });

        // Flash connection
        connections.forEach((cn: any) => { if (cn.idx === targetIdx) cn.mat.opacity = 0.7; });

        // Message
        const msg = PULSE_MESSAGES[Math.floor(Math.random() * PULSE_MESSAGES.length)];
        setPulseMsg(msg);
        setTimeout(() => setPulseMsg(''), 2500);
        setRequestCount(c => c + 1);
      }

      // Auto-pulse loop
      let pulseTimer: ReturnType<typeof setTimeout>;
      function schedulePulse() {
        const idx = Math.floor(Math.random() * agents.length);
        createPulse(idx);
        pulseTimer = setTimeout(schedulePulse, 1500 + Math.random() * 2500);
      }
      setTimeout(schedulePulse, 800);

      // Raycaster
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let hovered: any = null;

      const onMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects([coreMesh, ...agentMeshes]);

        if (hits.length > 0) {
          container.style.cursor = 'pointer';
          const obj = hits[0].object;
          if (hovered !== obj) {
            if (hovered?.material) hovered.material.emissiveIntensity = hovered.userData?.flashIntensity ?? 0.25;
            hovered = obj;
            if (obj.material) obj.material.emissiveIntensity = 0.9;
          }
        } else {
          container.style.cursor = 'default';
          if (hovered?.material) hovered.material.emissiveIntensity = hovered.userData?.flashIntensity ?? 0.25;
          hovered = null;
        }
      };

      const onClk = () => {
        if (!hovered) return;
        if (hovered === coreMesh) {
          setSelectedAgent(AGENTS[0]);
        } else if (hovered.userData?.agent) {
          setSelectedAgent(hovered.userData.agent);
        }
      };

      container.addEventListener('mousemove', onMove);
      container.addEventListener('click', onClk);

      // Zoom
      let targetZoom = 18;
      container.addEventListener('wheel', (e: WheelEvent) => {
        targetZoom += e.deltaY * 0.01;
        targetZoom = Math.max(10, Math.min(28, targetZoom));
      });

      // Project agent icons to 2D
      function updateIcons() {
        const icons: Array<{ x: number; y: number; icon: string; color: string; scale: number }> = [];
        const w = container.clientWidth;
        const h = container.clientHeight;

        agentMeshes.forEach((mesh: any) => {
          const worldPos = new THREE.Vector3();
          mesh.getWorldPosition(worldPos);
          const projected = worldPos.clone().project(camera);
          const x = (projected.x * 0.5 + 0.5) * w;
          const y = (-projected.y * 0.5 + 0.5) * h;
          const behindCamera = projected.z > 1;

          if (!behindCamera && x > -50 && x < w + 50 && y > -50 && y < h + 50) {
            const dist = camera.position.distanceTo(worldPos);
            const scale = Math.max(0.4, Math.min(1.2, 12 / dist));
            icons.push({ x, y, icon: mesh.userData.agent.icon, color: mesh.userData.agent.color, scale });
          }
        });
        setAgentIcons(icons);
      }

      // Animate
      const clock = new THREE.Clock();

      function animate() {
        animFrameRef.current = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        brainGroup.rotation.y = t * 0.06;
        brainGroup.rotation.x = Math.sin(t * 0.04) * 0.08;

        const cs = 1 + Math.sin(t * 2) * 0.06;
        coreMesh.scale.set(cs, cs, cs);
        wireMesh.rotation.y = -t * 0.12;
        wireMesh.rotation.x = t * 0.08;

        // Agent bob
        agentMeshes.forEach((m: any, i: number) => {
          m.position.y = m.userData.baseY + Math.sin(t * (0.4 + i * 0.04) + i) * 0.12;
          // Decay flash
          if (m.userData.flashIntensity > 0.25) {
            m.userData.flashIntensity -= 0.008;
            m.material.emissiveIntensity = m.userData.flashIntensity;
          }
        });

        // Pulses
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.progress += p.speed;
          const targetPos = agentPositions[p.targetIdx];
          const zero = new THREE.Vector3(0, 0, 0);

          if (!p.returning) {
            p.mesh.position.lerpVectors(zero, targetPos, p.progress);
            p.trail.position.lerpVectors(zero, targetPos, Math.max(0, p.progress - 0.1));
          } else {
            p.mesh.position.lerpVectors(targetPos, zero, p.progress - 1);
            p.trail.position.lerpVectors(targetPos, zero, Math.max(0, (p.progress - 1) - 0.1));
          }

          if (p.progress >= 1 && !p.returning) {
            p.returning = true;
            // FLASH the target agent brightly
            const tm = agentMeshes[p.targetIdx];
            if (tm) {
              tm.userData.flashIntensity = 1.2;
              tm.material.emissiveIntensity = 1.2;
              // Expand briefly
              tm.scale.set(1.3, 1.3, 1.3);
              setTimeout(() => { tm.scale.set(1, 1, 1); }, 250);
            }
          }

          if (p.progress >= 2) {
            brainGroup.remove(p.mesh);
            brainGroup.remove(p.trail);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            p.trail.geometry.dispose();
            p.trail.material.dispose();
            pulses.splice(i, 1);
          }

          if (p.tMat) p.tMat.opacity = Math.max(0, 0.5 - p.progress * 0.25);
        }

        // Fade connections
        connections.forEach((cn: any) => {
          if (cn.mat.opacity > cn.baseOpacity) cn.mat.opacity -= 0.006;
        });

        particlesGroup.rotation.y = t * 0.015;

        camera.position.z += (targetZoom - camera.position.z) * 0.04;
        camera.position.x = Math.sin(t * 0.08) * 0.4;
        camera.position.y = 2 + Math.cos(t * 0.06) * 0.25;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
        updateIcons();
      }

      animate();

      // Resize
      const onResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener('resize', onResize);

      return () => {
        clearTimeout(pulseTimer);
        cancelAnimationFrame(animFrameRef.current);
        window.removeEventListener('resize', onResize);
        container.removeEventListener('mousemove', onMove);
        container.removeEventListener('click', onClk);
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: '#080C1A', borderRadius: 20 }}>
      {/* 3D Canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Agent icons overlay (CSS on top of 3D) */}
      {agentIcons.map((ic, i) => (
        <div key={i} style={{
          position: 'absolute', left: ic.x, top: ic.y - 28,
          transform: `translate(-50%, -50%) scale(${ic.scale})`,
          fontSize: 20, pointerEvents: 'none', textShadow: `0 0 12px ${ic.color}`,
          transition: 'transform 0.1s',
          filter: `drop-shadow(0 0 6px ${ic.color})`,
        }}>
          {ic.icon}
        </div>
      ))}

      {/* Pulse message overlay */}
      {pulseMsg && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,40,71,0.8)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12,
          padding: '10px 24px', fontSize: 13, color: '#fbbf24',
          whiteSpace: 'nowrap', animation: 'fadeInOut 2.5s ease',
        }}>
          {pulseMsg}
        </div>
      )}

      {/* Bottom stats HUD */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px',
        background: 'linear-gradient(0deg, rgba(8,12,26,0.95) 0%, transparent 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', gap: 28 }}>
          {[
            { value: '21+', label: 'Agents' },
            { value: '160+', label: 'Skills' },
            { value: String(Math.min(requestCount, 847)), label: 'Requetes/min' },
            { value: '99.9%', label: 'Uptime' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 24, color: '#f59e0b' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 2s ease infinite' }} />
          Cliquez sur un agent pour voir ses details
        </div>
      </div>

      {/* Agent detail panel */}
      {selectedAgent && (
        <div style={{
          position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
          width: 300, background: 'rgba(15,40,71,0.85)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: 24, zIndex: 10,
        }}>
          <button onClick={() => setSelectedAgent(null)} style={{
            position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
            color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}>\u2715</button>
          <div style={{
            width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, background: `${selectedAgent.color}22`, border: `1px solid ${selectedAgent.color}44`, marginBottom: 14,
          }}>{selectedAgent.icon}</div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selectedAgent.name}</div>
          <div style={{ fontSize: 12, color: selectedAgent.color, fontWeight: 500, marginBottom: 12 }}>{selectedAgent.role}</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#94a3b8', marginBottom: 16 }}>{selectedAgent.desc}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {selectedAgent.skills.map(s => (
              <span key={s} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 500,
                background: `${selectedAgent.color}15`, border: `1px solid ${selectedAgent.color}33`, color: selectedAgent.color,
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInOut { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
      `}</style>
    </div>
  );
}
