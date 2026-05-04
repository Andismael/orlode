import { useEffect, useRef, memo } from 'react';

const COLORS = ['#a855f7', '#06b6d4', '#f472b6', '#34d399', '#facc15'];

function ImmersiveChatBackground() {
  const starsRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stars
    if (starsRef.current && starsRef.current.children.length === 0) {
      for (let i = 0; i < 60; i++) {
        const s = document.createElement('div');
        s.className = 'chat-star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
        s.style.setProperty('--max-op', String(0.3 + Math.random() * 0.7));
        s.style.animationDelay = -Math.random() * 5 + 's';
        if (Math.random() > 0.7) { s.style.width = '3px'; s.style.height = '3px'; }
        starsRef.current.appendChild(s);
      }
    }

    // Particles
    if (particlesRef.current && particlesRef.current.children.length === 0) {
      for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'chat-particle';
        p.style.left = (15 + Math.random() * 70) + '%';
        p.style.top = (15 + Math.random() * 70) + '%';
        p.style.width = (3 + Math.random() * 5) + 'px';
        p.style.height = p.style.width;
        p.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
        p.style.setProperty('--dur', (3 + Math.random() * 5) + 's');
        p.style.setProperty('--delay', (Math.random() * 6) + 's');
        p.style.setProperty('--tx', (-80 + Math.random() * 160) + 'px');
        p.style.setProperty('--ty', (-100 + Math.random() * -40) + 'px');
        particlesRef.current.appendChild(p);
      }
    }
  }, []);

  return (
    <>
      <div className="chat-stars" ref={starsRef} />
      <div className="chat-grid-floor" />
      <div className="chat-orb chat-orb-1" />
      <div className="chat-orb chat-orb-2" />
      <div className="chat-orb chat-orb-3" />
      <div className="chat-scan-line" />
      <div ref={particlesRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </>
  );
}

export default memo(ImmersiveChatBackground);
