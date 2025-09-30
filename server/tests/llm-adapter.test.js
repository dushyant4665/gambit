const { LLMAdapter } = require('../dist/bots/LLMAdapter');

// Mock fetch for testing
global.fetch = jest.fn();

describe('LLM Adapter Tests', () => {
  let llmAdapter;

  beforeEach(() => {
    llmAdapter = new LLMAdapter({
      provider: 'gemini',
      apiKey: 'test-key',
      timeout: 1000
    });
    
    // Clear fetch mock
    fetch.mockClear();
  });

  describe('Prompt Building', () => {
    test('should build correct prompt for Tal personality', async () => {
      const personality = {
        name: 'Michael Tal',
        description: 'The Magician from Riga',
        style: 'aggressive',
        sacrificeThreshold: 500,
        depthPreference: 'tactical'
      };

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moveHistory = ['e2e4', 'e7e5'];
      const sideToMove = 'w';

      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: '[{"move":"g1f3","reason":"Knight development"},{"move":"d2d4","reason":"Central control"},{"move":"c2c4","reason":"English opening"}]'
              }]
            }
          }]
        })
      });

      const result = await llmAdapter.getMoveSuggestions(fen, personality, moveHistory, sideToMove);

      expect(result).toHaveLength(3);
      expect(result[0].move).toBe('g1f3');
      expect(result[0].reason).toBe('Knight development');
    });

    test('should build correct prompt for Fischer personality', async () => {
      const personality = {
        name: 'Bobby Fischer',
        description: 'The American Chess Champion',
        style: 'precise',
        sacrificeThreshold: 200,
        depthPreference: 'positional'
      };

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moveHistory = [];
      const sideToMove = 'w';

      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: '[{"move":"e2e4","reason":"Classical central control"},{"move":"d2d4","reason":"Solid central advance"},{"move":"g1f3","reason":"Flexible development"}]'
              }]
            }
          }]
        })
      });

      const result = await llmAdapter.getMoveSuggestions(fen, personality, moveHistory, sideToMove);

      expect(result).toHaveLength(3);
      expect(result[0].move).toBe('e2e4');
      expect(result[0].reason).toContain('Classical');
    });
  });

  describe('API Integration', () => {
    test('should handle Gemini API response', async () => {
      const personality = {
        name: 'Test Bot',
        description: 'Test bot',
        style: 'aggressive',
        sacrificeThreshold: 300,
        depthPreference: 'tactical'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: '[{"move":"e2e4","reason":"Test move"}]'
              }]
            }
          }]
        })
      });

      const result = await llmAdapter.getMoveSuggestions(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        personality,
        [],
        'w'
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].move).toBe('e2e4');
    });

    test('should handle OpenRouter API response', async () => {
      const openRouterAdapter = new LLMAdapter({
        provider: 'openrouter',
        apiKey: 'test-key',
        timeout: 1000
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '[{"move":"d2d4","reason":"OpenRouter test move"}]'
            }
          }]
        })
      });

      const personality = {
        name: 'Test Bot',
        description: 'Test bot',
        style: 'aggressive',
        sacrificeThreshold: 300,
        depthPreference: 'tactical'
      };

      const result = await openRouterAdapter.getMoveSuggestions(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        personality,
        [],
        'w'
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].move).toBe('d2d4');
    });

    test('should handle API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('API Error'));

      const personality = {
        name: 'Test Bot',
        description: 'Test bot',
        style: 'aggressive',
        sacrificeThreshold: 300,
        depthPreference: 'tactical'
      };

      const result = await llmAdapter.getMoveSuggestions(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        personality,
        [],
        'w'
      );

      expect(result).toHaveLength(0);
    });

    test('should handle timeout gracefully', async () => {
      // Mock a slow response that will timeout
      fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const personality = {
        name: 'Test Bot',
        description: 'Test bot',
        style: 'aggressive',
        sacrificeThreshold: 300,
        depthPreference: 'tactical'
      };

      const result = await llmAdapter.getMoveSuggestions(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        personality,
        [],
        'w'
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('Response Parsing', () => {
    test('should parse valid JSON response', () => {
      const response = '[{"move":"e2e4","reason":"Central control"},{"move":"d2d4","reason":"Queen pawn"}]';
      const result = llmAdapter.parseLLMResponse(response);

      expect(result).toHaveLength(2);
      expect(result[0].move).toBe('e2e4');
      expect(result[0].reason).toBe('Central control');
    });

    test('should extract JSON from mixed response', () => {
      const response = 'Here are the moves: [{"move":"g1f3","reason":"Knight development"}]. Hope this helps!';
      const result = llmAdapter.parseLLMResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].move).toBe('g1f3');
    });

    test('should handle malformed JSON gracefully', () => {
      const response = 'Invalid JSON response';
      const result = llmAdapter.parseLLMResponse(response);

      expect(result).toHaveLength(0);
    });

    test('should filter invalid moves', () => {
      const response = '[{"move":"e2e4","reason":"Good move"},{"move":"invalid","reason":"Bad move"},{"move":"a1h8","reason":"Valid move"}]';
      const result = llmAdapter.parseLLMResponse(response);

      expect(result).toHaveLength(2); // Only e2e4 and a1h8 should be valid
      expect(result.find(m => m.move === 'invalid')).toBeUndefined();
    });
  });

  describe('Caching', () => {
    test('should cache responses', async () => {
      const personality = {
        name: 'Test Bot',
        description: 'Test bot',
        style: 'aggressive',
        sacrificeThreshold: 300,
        depthPreference: 'tactical'
      };

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: '[{"move":"e2e4","reason":"Cached move"}]'
              }]
            }
          }]
        })
      });

      // First call
      const result1 = await llmAdapter.getMoveSuggestions(fen, personality, [], 'w');
      
      // Second call should use cache
      const result2 = await llmAdapter.getMoveSuggestions(fen, personality, [], 'w');

      expect(fetch).toHaveBeenCalledTimes(1); // Only called once due to caching
      expect(result1).toEqual(result2);
    });

    test('should clear cache', () => {
      llmAdapter.clearCache();
      expect(llmAdapter.cache.size).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    test('should track rate limits', () => {
      const adapter = new LLMAdapter({
        provider: 'gemini',
        apiKey: 'test-key',
        timeout: 1000
      });

      expect(adapter.isRateLimited()).toBe(false);
      
      // Simulate rate limiting
      adapter.trackRateLimit();
      adapter.trackRateLimit();
      
      // Should still be under limit (20 calls per minute)
      expect(adapter.isRateLimited()).toBe(false);
    });
  });

  describe('Availability Check', () => {
    test('should check if LLM is available', () => {
      const adapterWithKey = new LLMAdapter({
        provider: 'gemini',
        apiKey: 'test-key'
      });

      const adapterWithoutKey = new LLMAdapter({
        provider: 'gemini'
      });

      expect(adapterWithKey.isAvailable()).toBe(true);
      expect(adapterWithoutKey.isAvailable()).toBe(false);
    });
  });
});


