/**
 * VideoPlayer — YouTube embed + direct video player
 * Supports: YouTube, Vimeo, direct mp4/webm URLs
 */
import React, { useState } from 'react';
import { Play, ExternalLink, CheckCircle } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  onComplete?: () => void;
  autoplay?: boolean;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

export default function VideoPlayer({ url, title, onComplete, autoplay }: VideoPlayerProps) {
  const [watched, setWatched] = useState(false);

  const ytId = extractYouTubeId(url);
  const vimeoId = !ytId ? extractVimeoId(url) : null;
  const isDirect = !ytId && !vimeoId;

  const handleEnded = () => {
    setWatched(true);
    onComplete?.();
  };

  return (
    <div className="rounded-xl overflow-hidden bg-gray-900 shadow-lg">
      {/* YouTube embed */}
      {ytId && (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}`}
            title={title ?? 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Vimeo embed */}
      {vimeoId && (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0${autoplay ? '&autoplay=1' : ''}`}
            title={title ?? 'Video'}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Direct video file */}
      {isDirect && (
        <video
          className="w-full"
          controls
          autoPlay={autoplay}
          onEnded={handleEnded}
          preload="metadata"
        >
          <source src={url} />
          Votre navigateur ne supporte pas la lecture video.
        </video>
      )}

      {/* Video info bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <Play size={13} className="text-blue-400 flex-shrink-0" />
          <span className="text-sm text-gray-200 truncate">{title ?? 'Video'}</span>
        </div>
        <div className="flex items-center gap-2">
          {watched && <CheckCircle size={14} className="text-green-400" />}
          {(ytId || vimeoId) && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <ExternalLink size={13} />
            </a>
          )}
          {!watched && onComplete && (
            <button onClick={handleEnded} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Marquer vu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
