import { geminiService } from './geminiService';
import { logger } from '../../utils/logger';

export type AITask =
  | 'qa'
  | 'analysis'
  | 'strategy'
  | 'meeting_summary'
  | 'ocr'
  | 'classify'
  | 'translate'
  | 'entities'
  | 'transcribe'
  | 'insight';

// 100% Gemini — Flash pour le processing, Pro pour le raisonnement
const ROUTING_TABLE: Record<AITask, 'gemini_pro' | 'gemini_flash'> = {
  qa:              'gemini_pro',
  analysis:        'gemini_pro',
  strategy:        'gemini_pro',
  meeting_summary: 'gemini_pro',
  insight:         'gemini_pro',
  ocr:             'gemini_flash',
  classify:        'gemini_flash',
  translate:       'gemini_flash',
  entities:        'gemini_flash',
  transcribe:      'gemini_flash',
};

export class AIRouter {
  /** Retourne le backend pour une tâche donnée. */
  route(task: AITask): 'gemini_pro' | 'gemini_flash' {
    return ROUTING_TABLE[task];
  }

  /** Exécute la tâche sur le bon modèle Gemini. */
  async execute(task: AITask, prompt: string, context?: string): Promise<string> {
    const backend = this.route(task);
    logger.debug(`[AIRouter] Task "${task}" → ${backend}`);

    const fullPrompt = context
      ? `${prompt}\n\nContexte pertinent:\n${context}`
      : prompt;

    return geminiService.generate(fullPrompt);
  }
}

export const aiRouter = new AIRouter();
