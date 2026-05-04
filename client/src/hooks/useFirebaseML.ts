import { useState, useCallback } from 'react';
import { quickSummarize, detectLanguage, quickAsk } from '../services/aiLogicService';

// ── useFirebaseML ─────────────────────────────────────────────────────────────

/**
 * Hook for client-side ML operations powered by Firebase AI Logic (Gemini).
 *
 * All operations are stateless and run on the client without a server round-trip.
 * When VITE_GOOGLE_AI_API_KEY is not set, all methods return empty/null results.
 */
export function useFirebaseML() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI operation failed';
      setError(message);
      console.error('[useFirebaseML]', message, err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Classify a document snippet and return a category string.
   */
  const quickClassify = useCallback(
    async (text: string): Promise<string> => {
      const result = await run(() =>
        quickAsk(
          `Classify this text into one of: contract, invoice, report, hr_policy, technical_spec, meeting_notes, financial, legal, marketing, other.
Return only the category name, nothing else.

Text:
"""${text.slice(0, 1000)}"""`
        )
      );
      return (result ?? 'other').trim().toLowerCase();
    },
    [run]
  );

  /**
   * Detect the BCP-47 language code of the given text.
   */
  const detectLang = useCallback(
    async (text: string): Promise<string> => {
      const result = await run(() => detectLanguage(text));
      return result ?? 'unknown';
    },
    [run]
  );

  /**
   * Summarize text in 2-3 sentences.
   */
  const summarize = useCallback(
    async (text: string): Promise<string> => {
      const result = await run(() => quickSummarize(text));
      return result ?? '';
    },
    [run]
  );

  return {
    quickClassify,
    detectLanguage: detectLang,
    summarize,
    isLoading,
    error,
  };
}
