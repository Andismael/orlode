import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface LiveToolDecl {
  functionDeclarations: LiveFunctionDeclaration[];
}

export type LiveToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface LiveConfig {
  language?: string;
  voiceName?: string;
  systemInstruction?: string;
  tools?: LiveToolDecl[];
  onToolCall?: LiveToolExecutor;
}

export interface LiveMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface GeminiLiveHook {
  isConnected: boolean;
  isConnecting: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  messages: LiveMessage[];
  currentText: string;
  error: string | null;
  connect: (config?: LiveConfig) => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => void;
  sendCameraFrame: (base64Jpeg: string) => void;
}

// Gemini Live key is fetched per-session from the backend (per-tenant BYOE) to prevent cost leaks.
// The old VITE_GOOGLE_AI_API_KEY env var is no longer used — it was a public cost leak.
const MODEL: string = import.meta.env.VITE_GEMINI_LIVE_MODEL ?? 'models/gemini-3.1-flash-live-preview';
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

async function fetchTenantLiveKey(): Promise<string> {
  const { default: api } = await import('@/services/api');
  const r = await api.get<{ apiKey: string; source: string }>('/ai/live-key');
  const data = r.data as { apiKey?: string; source?: string };
  if (!data?.apiKey) throw new Error('No Gemini key available');
  return data.apiKey;
}

function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32.length; i++) {
    let sample = Math.max(-1, Math.min(1, float32[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, sample, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function pcm16ToAudioBuffer(
  audioContext: AudioContext,
  pcm16Base64: string,
  sampleRate = 24000
): AudioBuffer {
  const pcmBuffer = base64ToArrayBuffer(pcm16Base64);
  const view = new DataView(pcmBuffer);
  const sampleCount = pcmBuffer.byteLength / 2;
  const float32 = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true);
    float32[i] = sample / 0x8000;
  }

  const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRate);
  audioBuffer.copyToChannel(float32, 0);

  return audioBuffer;
}

export function useGeminiLive(): GeminiLiveHook {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef(false);
  const micStartedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isConnectedRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackRunningRef = useRef(false);

  const currentAssistantTextRef = useRef('');
  const currentUserTextRef = useRef('');
  const toolExecutorRef = useRef<LiveToolExecutor | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const resetTextState = () => {
    currentAssistantTextRef.current = '';
    currentUserTextRef.current = '';
    setCurrentText('');
  };

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    playbackRunningRef.current = false;

    if (playbackSourceRef.current) {
      try {
        playbackSourceRef.current.stop();
      } catch {}
      try {
        playbackSourceRef.current.disconnect();
      } catch {}
      playbackSourceRef.current = null;
    }

    setIsSpeaking(false);
  }, []);

  const playNextInQueue = useCallback(async () => {
    if (playbackRunningRef.current) return;
    if (playbackQueueRef.current.length === 0) {
      setIsSpeaking(false);
      return;
    }

    const audioContext =
      playbackAudioContextRef.current ||
      new AudioContext({ sampleRate: 24000 });

    playbackAudioContextRef.current = audioContext;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const next = playbackQueueRef.current.shift();
    if (!next) {
      setIsSpeaking(false);
      return;
    }

    playbackRunningRef.current = true;
    setIsSpeaking(true);

    const source = audioContext.createBufferSource();
    source.buffer = next;
    source.connect(audioContext.destination);
    playbackSourceRef.current = source;

    source.onended = () => {
      try {
        source.disconnect();
      } catch {}
      if (playbackSourceRef.current === source) {
        playbackSourceRef.current = null;
      }
      playbackRunningRef.current = false;

      if (playbackQueueRef.current.length > 0) {
        void playNextInQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    source.start(0);
  }, []);

  const enqueuePlaybackChunk = useCallback(
    async (pcm16Base64: string, sampleRate = 24000) => {
      const ctx =
        playbackAudioContextRef.current ||
        new AudioContext({ sampleRate });

      playbackAudioContextRef.current = ctx;

      const buffer = pcm16ToAudioBuffer(ctx, pcm16Base64, sampleRate);
      playbackQueueRef.current.push(buffer);

      if (!playbackRunningRef.current) {
        await playNextInQueue();
      }
    },
    [playNextInQueue]
  );

  const stopMicrophone = useCallback(() => {
    setIsListening(false);
    micStartedRef.current = false;

    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {}
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
  }, []);

  const startMicrophone = useCallback(async () => {
    if (micStartedRef.current) return;
    micStartedRef.current = true;

    try {
      console.log('[GeminiLive] Starting microphone...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (event) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        if (isSpeakingRef.current) return;

        const input = event.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPcm16(input);
        const base64 = arrayBufferToBase64(pcm16);

        const payload = {
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64,
            },
          },
        };

        try {
          ws.send(JSON.stringify(payload));
        } catch (err) {
          console.error('[GeminiLive] Failed to send audio chunk:', err);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      console.log('[GeminiLive] Microphone active');
    } catch (err) {
      micStartedRef.current = false;
      setIsListening(false);
      setError("Impossible d'activer le microphone.");
      console.error('[GeminiLive] Failed to start microphone:', err);
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;

    if (!ws) return;

    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close(1000, 'Client disconnect');
      }
    } catch {}
  }, []);

  const disconnect = useCallback(() => {
    console.log('[GeminiLive] Disconnecting...');

    connectingRef.current = false;
    setIsConnecting(false);
    setIsConnected(false);
    setError(null);

    stopMicrophone();
    stopPlayback();
    resetTextState();
    cleanupSocket();
  }, [cleanupSocket, stopMicrophone, stopPlayback]);

  const handleParsedMessage = useCallback(
    async (data: any) => {
      if (!data) return;

      if (data.setupComplete) {
        console.log('[GeminiLive] Setup complete!');
        await startMicrophone();
        return;
      }

      if (data.serverContent?.interrupted) {
        console.log('[GeminiLive] Interrupted by user');
        stopPlayback();
        setCurrentText('');
        currentAssistantTextRef.current = '';
        return;
      }

      const modelTurn = data.serverContent?.modelTurn;
      if (modelTurn?.parts?.length) {
        for (const part of modelTurn.parts) {
          if (typeof part.text === 'string' && part.text.trim()) {
            currentAssistantTextRef.current += part.text;
            setCurrentText(currentAssistantTextRef.current);
          }

          const inlineData = part.inlineData;
          if (
            inlineData?.mimeType?.includes('audio/pcm') &&
            typeof inlineData.data === 'string'
          ) {
            await enqueuePlaybackChunk(inlineData.data, 24000);
          }
        }
      }

      const turnComplete =
        data.serverContent?.turnComplete ||
        data.serverContent?.generationComplete;

      if (turnComplete) {
        const finalText = currentAssistantTextRef.current.trim();
        if (finalText) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', text: finalText },
          ]);
        }

        currentAssistantTextRef.current = '';
        setCurrentText('');
      }

      const inputTranscription =
        data.serverContent?.inputTranscription ||
        data.inputTranscription ||
        data.userInput?.text;

      if (typeof inputTranscription === 'string' && inputTranscription.trim()) {
        currentUserTextRef.current = inputTranscription.trim();
        console.log('[GeminiLive] User:', currentUserTextRef.current);
      }

      const inputComplete =
        data.serverContent?.inputTranscriptionComplete ||
        data.inputTranscriptionComplete;

      if (inputComplete && currentUserTextRef.current) {
        const finalUserText = currentUserTextRef.current;
        setMessages((prev) => [...prev, { role: 'user', text: finalUserText }]);
        currentUserTextRef.current = '';
      }

      // ── Tool calling — Gemini Live asks us to execute a function ──────────
      const toolCall = data.toolCall;
      if (toolCall?.functionCalls?.length) {
        const executor = toolExecutorRef.current;
        const responses: { id: string; name: string; response: Record<string, unknown> }[] = [];
        for (const fc of toolCall.functionCalls as { id: string; name: string; args: Record<string, unknown> }[]) {
          console.log('[GeminiLive] Tool call:', fc.name, fc.args);
          let response: Record<string, unknown> = { error: 'No executor registered' };
          if (executor) {
            try {
              const result = await executor(fc.name, fc.args ?? {});
              response = { result };
            } catch (err) {
              response = { error: String(err) };
            }
          }
          responses.push({ id: fc.id, name: fc.name, response });
        }
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        }
      }
    },
    [enqueuePlaybackChunk, startMicrophone, stopPlayback]
  );

  const connect = useCallback(
    async (config?: LiveConfig) => {
      if (connectingRef.current) {
        console.log('[GeminiLive] Already connecting, ignore');
        return;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[GeminiLive] Already connected, ignore');
        return;
      }

      setError(null);
      setIsConnecting(true);
      connectingRef.current = true;

      try {
        stopPlayback();
        stopMicrophone();
        cleanupSocket();
        resetTextState();

        console.log('[GeminiLive] Fetching tenant key...');
        let apiKey: string;
        try {
          apiKey = await fetchTenantLiveKey();
        } catch (err) {
          const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Accès refusé';
          setError(`Gemini Live indisponible : ${msg}. Configurez votre clé Gemini via /admin/byoe.`);
          setIsConnecting(false);
          connectingRef.current = false;
          return;
        }

        console.log('[GeminiLive] Connecting...');

        const ws = new WebSocket(`${WS_BASE}?key=${apiKey}`);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[GeminiLive] WebSocket OPEN, sending setup...');

          const setupPayload = {
            setup: {
              model: MODEL,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: config?.voiceName
                  ? {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: config.voiceName,
                        },
                      },
                    }
                  : undefined,
              },
              systemInstruction: config?.systemInstruction
                ? {
                    parts: [{ text: config.systemInstruction }],
                  }
                : undefined,
              tools: config?.tools?.length ? config.tools : undefined,
            },
          };

          // Store the tool executor on the ref so incoming toolCall events can invoke it
          toolExecutorRef.current = config?.onToolCall ?? null;

          ws.send(JSON.stringify(setupPayload));
          setIsConnected(true);
          setIsConnecting(false);
          connectingRef.current = false;
        };

        ws.onmessage = async (event: MessageEvent) => {
          try {
            let rawText = '';

            if (typeof event.data === 'string') {
              rawText = event.data;
            } else if (event.data instanceof Blob) {
              rawText = await event.data.text();
            } else if (event.data instanceof ArrayBuffer) {
              rawText = new TextDecoder().decode(event.data);
            } else {
              console.warn('[GeminiLive] Unsupported message type:', event.data);
              return;
            }

            if (!rawText?.trim()) return;

            const parsed = JSON.parse(rawText);
            await handleParsedMessage(parsed);
          } catch (err) {
            console.error('[GeminiLive] Message parse error:', err, event.data);
          }
        };

        ws.onerror = (event) => {
          console.error('[GeminiLive] WebSocket error:', event);
          setError('Erreur WebSocket Gemini Live.');
          setIsConnecting(false);
          connectingRef.current = false;
        };

        ws.onclose = (event) => {
          console.log(
            '[GeminiLive] WebSocket closed:',
            event.code,
            event.reason
          );

          stopMicrophone();
          stopPlayback();

          setIsConnected(false);
          setIsConnecting(false);
          connectingRef.current = false;
          wsRef.current = null;
        };
      } catch (err) {
        console.error('[GeminiLive] Connect failed:', err);
        setError('Connexion Gemini Live impossible.');
        setIsConnecting(false);
        connectingRef.current = false;
        disconnect();
      }
    },
    [cleanupSocket, disconnect, handleParsedMessage, stopMicrophone, stopPlayback]
  );

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);

    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[GeminiLive] Failed to send text:', err);
    }
  }, []);

  const sendCameraFrame = useCallback((base64Jpeg: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!base64Jpeg) return;

    const payload = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64Jpeg,
        },
      },
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[GeminiLive] Failed to send camera frame:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    messages,
    currentText,
    error,
    connect,
    disconnect,
    sendText,
    sendCameraFrame,
  };
}

export default useGeminiLive;
