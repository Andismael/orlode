import React, { useState, useRef } from 'react';

interface Props {
  /** Image URLs in display order. First one is the primary. */
  images: string[];
  /** Optional fallback image (e.g. older `imageUrl` field). */
  fallback?: string | null;
  alt?: string;
  /** Aspect ratio: '1' for square (default), '4/3', '16/9'. */
  aspect?: '1' | '4/3' | '16/9';
  /** Background when there's no image at all. */
  emptyBackground?: string;
  /** Optional emoji shown when the carousel is empty (no images). */
  emptyEmoji?: string;
  /** Optional className override for outer container. */
  className?: string;
  /** Border radius (CSS string). Default: 12px on the outer container. */
  borderRadius?: string;
}

/**
 * Touch-friendly photo carousel for public storefront pages (menu, hotel,
 * salon, cabinet, biens). Falls back to single-image rendering when only
 * one photo exists. Horizontal scroll-snap means it works without any
 * dependency — no swiper.js, no react-slick.
 */
export default function PhotoCarousel({
  images, fallback, alt, aspect = '1',
  emptyBackground = '#F3F4F6', emptyEmoji = '📦',
  className, borderRadius = '12px',
}: Props) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const list = images && images.length > 0
    ? images
    : (fallback ? [fallback] : []);

  if (list.length === 0) {
    return (
      <div
        className={className}
        style={{
          aspectRatio: aspect, background: emptyBackground, borderRadius,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38, opacity: 0.5,
        }}
      >
        {emptyEmoji}
      </div>
    );
  }

  if (list.length === 1) {
    return (
      <div className={className} style={{ aspectRatio: aspect, borderRadius, overflow: 'hidden', background: '#000' }}>
        <img src={list[0]} alt={alt ?? ''} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  return (
    <div className={className} style={{ position: 'relative', borderRadius, overflow: 'hidden', background: '#000' }}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          aspectRatio: aspect,
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {list.map((url, i) => (
          <div key={`${url}-${i}`} style={{ flex: '0 0 100%', scrollSnapAlign: 'center', height: '100%' }}>
            <img src={url} alt={alt ? `${alt} (${i + 1}/${list.length})` : ''} loading={i === 0 ? 'eager' : 'lazy'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
      {/* Dots */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5, padding: '4px 8px',
        background: 'rgba(0,0,0,0.45)', borderRadius: 999, backdropFilter: 'blur(4px)',
      }}>
        {list.map((_, i) => (
          <span key={i} style={{
            width: i === active ? 14 : 6, height: 6, borderRadius: 3,
            background: i === active ? '#fff' : 'rgba(255,255,255,0.55)',
            transition: 'all 0.2s ease',
          }} />
        ))}
      </div>
      {/* Counter top-right */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)',
      }}>
        {active + 1}/{list.length}
      </div>
    </div>
  );
}
