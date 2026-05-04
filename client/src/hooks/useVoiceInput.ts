/**
 * useVoiceInput — Web Speech API hook for voice-to-text in the chat.
 * Falls back gracefully when speech recognition is not available.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceInputOptions {
  lang?:        string;   // BCP-47 e.g. 'fr-FR', 'en-US', 'sw-KE'
  onTranscript: (text: string) => void;
  onError?:     (error: string) => void;
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:   ((event: SpeechRecognitionEvent) => void) | null;
  onerror:    ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend:      (() => void) | null;
  onstart:    (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as Record<string, unknown>)['SpeechRecognition'] ??
    (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] ??
    null
  ) as (new () => SpeechRecognitionInstance) | null;
}

export function useVoiceInput({ lang = 'fr-FR', onTranscript, onError }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported]  = useState(false);
  const [interimText, setInterimText]  = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      onError?.('Speech recognition not supported in this browser');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.lang            = lang;
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) setInterimText(interim);
      if (final)   {
        setInterimText('');
        onTranscript(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        onError?.(`Voice error: ${event.error}`);
      }
      setIsListening(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, onTranscript, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { isListening, isSupported, interimText, start, stop, toggle };
}

/**
 * Speak text using browser TTS (Text-to-Speech).
 * Used to make Orlode respond vocally.
 */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const langPrefix = lang.split('-')[0];
  // Prefer any voice matching the language (don't filter by localService — cloud voices work fine)
  return voices.find(v => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()))
      ?? voices.find(v => v.default)
      ?? voices[0];
}

export function speakText(
  text: string,
  lang = 'fr-FR',
  rate = 1.0,
  hooks?: { onStart?: () => void; onEnd?: () => void },
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!text?.trim()) return;

  window.speechSynthesis.cancel();

  const doSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang  = lang;
    utterance.rate  = rate;
    utterance.pitch = 1.0;
    const v = pickVoice(lang);
    if (v) utterance.voice = v;
    utterance.onstart = () => hooks?.onStart?.();
    utterance.onend = () => hooks?.onEnd?.();
    utterance.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.warn('[TTS] speechSynthesis error', e);
      hooks?.onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  // Chrome sometimes returns empty voices list on first call — retry after voiceschanged
  if (window.speechSynthesis.getVoices().length === 0) {
    const onVoices = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      doSpeak();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    // Also trigger immediately — some browsers fire voiceschanged synchronously
    setTimeout(doSpeak, 100);
  } else {
    doSpeak();
  }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
