export interface LLMMove {
  move: string; // UCI format (e.g., "e2e4")
  reason: string;
  confidence?: number;
}

export interface LLMConfig {
  provider: 'gemini' | 'openrouter';
  apiKey?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface BotPersonality {
  name: string;
  description: string;
  style: 'aggressive' | 'precise';
  sacrificeThreshold: number; // How much eval loss is acceptable for sacrifices
  depthPreference: 'tactical' | 'positional';
}

export class LLMAdapter {
  private config: LLMConfig;
  private cache = new Map<string, LLMMove[]>();
  private rateLimitTracker = new Map<string, number>();

  constructor(config: LLMConfig) {
    this.config = {
      timeout: 3000,
      maxRetries: 2,
      ...config
    };
  }

  /**
   * Get move suggestions from LLM with personality
   */
  public async getMoveSuggestions(
    fen: string,
    personality: BotPersonality,
    moveHistory: string[] = [],
    sideToMove: 'w' | 'b'
  ): Promise<LLMMove[]> {
    const cacheKey = `${fen}-${personality.name}-${sideToMove}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`🧠 LLM cache hit for ${personality.name}`);
      return this.cache.get(cacheKey)!;
    }

    // Check rate limiting
    if (this.isRateLimited()) {
      console.log(`⏰ Rate limited, skipping LLM call`);
      return [];
    }

    try {
      const prompt = this.buildPrompt(fen, personality, moveHistory, sideToMove);
      const suggestions = await this.callLLM(prompt);
      
      // Cache the result
      this.cache.set(cacheKey, suggestions);
      
      // Limit cache size
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }
      
      return suggestions;
    } catch (error) {
      console.error(`❌ LLM call failed for ${personality.name}:`, error);
      this.trackRateLimit();
      return [];
    }
  }

  private buildPrompt(
    fen: string,
    personality: BotPersonality,
    moveHistory: string[],
    sideToMove: 'w' | 'b'
  ): string {
    const recentMoves = moveHistory.slice(-10).join(' ');
    const color = sideToMove === 'w' ? 'White' : 'Black';
    
    const styleInstructions = personality.style === 'aggressive' 
      ? "Aggressive, tactical, sacrifice-friendly. Prefer forcing lines and bold sacrifices. Look for tactical combinations and attacking opportunities."
      : "Classical, precise, accuracy-first. Prefer highest-eval moves with positional understanding. Focus on endgame technique and accuracy.";

    return `You are ${personality.name}, ${personality.description}. ${styleInstructions}

Current position (FEN): ${fen}
Side to move: ${color}
Recent moves: ${recentMoves}

Analyze the position and suggest exactly 3 candidate moves in UCI format (e.g., "e2e4", "g1f3").
Consider the position carefully and provide moves that match your playing style.

Respond ONLY with a JSON array in this exact format:
[{"move":"e2e4","reason":"Central control and development"},{"move":"g1f3","reason":"Knight development with flexibility"},{"move":"c2c4","reason":"English opening setup"}]

Do not include any other text, explanations, or formatting.`;
  }

  private async callLLM(prompt: string): Promise<LLMMove[]> {
    if (!this.config.apiKey) {
      console.log('⚠️ No LLM API key configured, returning empty suggestions');
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      let response;
      
      if (this.config.provider === 'gemini') {
        response = await this.callGemini(prompt, controller.signal);
      } else if (this.config.provider === 'openrouter') {
        response = await this.callOpenRouter(prompt, controller.signal);
      } else {
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
      }

      clearTimeout(timeoutId);
      return this.parseLLMResponse(response);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LLM request timeout');
      }
      throw error;
    }
  }

  private async callGemini(prompt: string, signal: AbortSignal): Promise<string> {
    const model = this.config.model || 'gemini-1.5-flash';
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private async callOpenRouter(prompt: string, signal: AbortSignal): Promise<string> {
    const model = this.config.model || 'deepseek/deepseek-chat';
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gambit-chess.com',
        'X-Title': 'Gambit Chess Bot'
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  private parseLLMResponse(response: string): LLMMove[] {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      return parsed.map((item: any) => ({
        move: item.move || '',
        reason: item.reason || '',
        confidence: item.confidence || 0.5
      })).filter((move: LLMMove) => move.move && move.move.length === 4);
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.error('Raw response:', response);
      return [];
    }
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    const lastCall = this.rateLimitTracker.get('lastCall') || 0;
    const callCount = this.rateLimitTracker.get('callCount') || 0;
    
    // Reset counter every minute
    if (now - lastCall > 60000) {
      this.rateLimitTracker.clear();
      return false;
    }
    
    // Limit to 20 calls per minute for free tiers
    return callCount >= 20;
  }

  private trackRateLimit(): void {
    const now = Date.now();
    const lastCall = this.rateLimitTracker.get('lastCall') || 0;
    
    if (now - lastCall > 60000) {
      this.rateLimitTracker.clear();
    }
    
    this.rateLimitTracker.set('callCount', (this.rateLimitTracker.get('callCount') || 0) + 1);
    this.rateLimitTracker.set('lastCall', now);
  }

  /**
   * Clear cache (useful for testing)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if LLM is available (has API key)
   */
  public isAvailable(): boolean {
    return !!this.config.apiKey;
  }
}