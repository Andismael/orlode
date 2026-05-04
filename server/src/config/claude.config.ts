import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.config';
import { logger } from '../utils/logger';

let anthropicClient: Anthropic;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
    logger.info('Anthropic client initialized');
  }
  return anthropicClient;
}
