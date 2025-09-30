import { BotController, BotConfig } from './BotController';
import { LLMConfig, BotPersonality } from './LLMAdapter';
import { StockfishConfig } from './StockfishServer';

export class TalBot extends BotController {
  constructor(llmApiKey?: string, llmProvider: 'gemini' | 'openrouter' = 'gemini') {
    const personality: BotPersonality = {
      name: 'Michael Tal',
      description: 'The Magician from Riga - Known for brilliant tactical sacrifices and attacking play',
      style: 'aggressive',
      sacrificeThreshold: 500, // Allow sacrifices up to 5 pawns
      depthPreference: 'tactical'
    };

    const llmConfig: LLMConfig = {
      provider: llmProvider,
      apiKey: llmApiKey,
      model: llmProvider === 'gemini' ? 'gemini-1.5-flash' : 'deepseek/deepseek-chat',
      timeout: 3000,
      maxRetries: 2
    };

    const stockfishConfig: StockfishConfig = {
      depth: 16,
      movetime: 2500,
      threads: 4,
      hash: 128
    };

    const botConfig: BotConfig = {
      name: 'Michael Tal',
      personality,
      llmConfig,
      stockfishConfig,
      fallbackThreshold: -500 // Accept moves down to -5 pawns for tactical play
    };

    super(botConfig);
  }
}

export class FischerBot extends BotController {
  constructor(llmApiKey?: string, llmProvider: 'gemini' | 'openrouter' = 'gemini') {
    const personality: BotPersonality = {
      name: 'Bobby Fischer',
      description: 'The American Chess Champion - Precise, universal style with perfect endgame technique',
      style: 'precise',
      sacrificeThreshold: 200, // More conservative with sacrifices
      depthPreference: 'positional'
    };

    const llmConfig: LLMConfig = {
      provider: llmProvider,
      apiKey: llmApiKey,
      model: llmProvider === 'gemini' ? 'gemini-1.5-flash' : 'deepseek/deepseek-chat',
      timeout: 3000,
      maxRetries: 2
    };

    const stockfishConfig: StockfishConfig = {
      depth: 22,
      movetime: 4000,
      threads: 4,
      hash: 256
    };

    const botConfig: BotConfig = {
      name: 'Bobby Fischer',
      personality,
      llmConfig,
      stockfishConfig,
      fallbackThreshold: -200 // More strict - only accept moves down to -2 pawns
    };

    super(botConfig);
  }
}

// Factory function to create bots
export function createBot(
  type: 'tal' | 'fischer',
  llmApiKey?: string,
  llmProvider: 'gemini' | 'openrouter' = 'gemini'
): BotController {
  switch (type) {
    case 'tal':
      return new TalBot(llmApiKey, llmProvider);
    case 'fischer':
      return new FischerBot(llmApiKey, llmProvider);
    default:
      throw new Error(`Unknown bot type: ${type}`);
  }
}

// Bot registry for easy access
export const BOT_REGISTRY = {
  tal: TalBot,
  fischer: FischerBot
};

// Default configurations for easy setup
export const DEFAULT_BOT_CONFIGS = {
  tal: {
    name: 'Michael Tal',
    description: 'Aggressive tactical player with brilliant sacrifices',
    style: 'aggressive' as const,
    stockfishDepth: 16,
    stockfishTime: 2500,
    sacrificeThreshold: 500,
    fallbackThreshold: -500
  },
  fischer: {
    name: 'Bobby Fischer',
    description: 'Precise positional player with perfect technique',
    style: 'precise' as const,
    stockfishDepth: 22,
    stockfishTime: 4000,
    sacrificeThreshold: 200,
    fallbackThreshold: -200
  }
};


