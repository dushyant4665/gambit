const { LLMAdapter } = require('../dist/bots/LLMAdapter');
const { BotController } = require('../dist/bots/BotController');
const { createBot } = require('../dist/bots/TalFischerBots');

describe('Bot System Tests', () => {
  let llmAdapter;
  let botController;

  beforeEach(() => {
    // Mock LLM adapter for testing
    llmAdapter = {
      getMoveSuggestions: jest.fn(),
      isAvailable: jest.fn(() => true),
      clearCache: jest.fn()
    };

    // Mock Stockfish server
    const mockStockfishServer = {
      getBestMove: jest.fn(),
      evaluateMove: jest.fn(),
      isEngineReady: jest.fn(() => true),
      destroy: jest.fn()
    };

    // Create bot controller with mocked dependencies
    botController = new BotController({
      name: 'Test Bot',
      personality: {
        name: 'Test Player',
        description: 'Test bot for unit testing',
        style: 'aggressive',
        sacrificeThreshold: 300,
        depthPreference: 'tactical'
      },
      llmConfig: {
        provider: 'gemini',
        apiKey: 'test-key',
        timeout: 1000
      },
      stockfishConfig: {
        depth: 10,
        movetime: 1000
      },
      fallbackThreshold: -300
    });

    // Inject mocked dependencies
    botController.llmAdapter = llmAdapter;
    botController.stockfishServer = mockStockfishServer;
  });

  describe('LLM Move Acceptance Filter', () => {
    test('should accept legal LLM moves within threshold', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM suggesting good moves
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'e2e4', reason: 'Central control' },
        { move: 'd2d4', reason: 'Queen pawn opening' }
      ]);

      // Mock Stockfish validation - moves are legal and not losing
      botController.stockfishServer.evaluateMove.mockResolvedValue({
        move: 'e2e4',
        evaluation: 50,
        depth: 10,
        nodes: 1000,
        time: 1000,
        pv: ['e2e4']
      });

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('llm');
      expect(result.move).toBe('e2e4');
      expect(result.reason).toBe('Central control');
    });

    test('should reject illegal LLM moves', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM suggesting illegal move
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'e2e9', reason: 'Invalid move' } // Invalid rank
      ]);

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).not.toBe('e2e9');
    });

    test('should reject clearly losing LLM moves', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM suggesting losing move
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'f2f4', reason: 'Foolish move' }
      ]);

      // Mock Stockfish evaluation showing it's losing
      botController.stockfishServer.evaluateMove.mockResolvedValue({
        move: 'f2f4',
        evaluation: -800, // Very bad evaluation
        depth: 10,
        nodes: 1000,
        time: 1000,
        pv: ['f2f4']
      });

      // Mock fallback Stockfish move
      botController.stockfishServer.getBestMove.mockResolvedValue('e2e4');

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBe('e2e4');
    });

    test('should allow aggressive sacrifices for Tal-style bot', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Create Tal bot with aggressive personality
      const talBot = createBot('tal', 'test-key', 'gemini');
      talBot.llmAdapter = llmAdapter;
      talBot.stockfishServer = {
        getBestMove: jest.fn(),
        evaluateMove: jest.fn(),
        isEngineReady: jest.fn(() => true),
        destroy: jest.fn()
      };

      // Mock LLM suggesting sacrifice
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'g2g4', reason: 'Aggressive sacrifice for tactical play' }
      ]);

      // Mock Stockfish evaluation - sacrifice is acceptable for Tal
      talBot.stockfishServer.evaluateMove.mockResolvedValue({
        move: 'g2g4',
        evaluation: -400, // 4 pawn sacrifice, within Tal's threshold
        depth: 16,
        nodes: 2000,
        time: 2500,
        pv: ['g2g4']
      });

      const result = await talBot.getBestMove(fen, [], 'w');

      expect(result.source).toBe('llm');
      expect(result.move).toBe('g2g4');
      expect(result.reason).toContain('sacrifice');
    });

    test('should reject excessive sacrifices for Fischer-style bot', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Create Fischer bot with precise personality
      const fischerBot = createBot('fischer', 'test-key', 'gemini');
      fischerBot.llmAdapter = llmAdapter;
      fischerBot.stockfishServer = {
        getBestMove: jest.fn(),
        evaluateMove: jest.fn(),
        isEngineReady: jest.fn(() => true),
        destroy: jest.fn()
      };

      // Mock LLM suggesting sacrifice
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'g2g4', reason: 'Aggressive sacrifice' }
      ]);

      // Mock Stockfish evaluation - sacrifice is too costly for Fischer
      fischerBot.stockfishServer.evaluateMove.mockResolvedValue({
        move: 'g2g4',
        evaluation: -300, // 3 pawn sacrifice, exceeds Fischer's threshold
        depth: 22,
        nodes: 3000,
        time: 4000,
        pv: ['g2g4']
      });

      // Mock fallback Stockfish move
      fischerBot.stockfishServer.getBestMove.mockResolvedValue('e2e4');

      const result = await fischerBot.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBe('e2e4');
    });
  });

  describe('Stockfish Fallback', () => {
    test('should fallback to Stockfish when LLM fails', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM failure
      llmAdapter.getMoveSuggestions.mockResolvedValue([]);

      // Mock Stockfish providing fallback move
      botController.stockfishServer.getBestMove.mockResolvedValue('e2e4');

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBe('e2e4');
    });

    test('should fallback to Stockfish when LLM times out', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM timeout
      llmAdapter.getMoveSuggestions.mockRejectedValue(new Error('LLM request timeout'));

      // Mock Stockfish providing fallback move
      botController.stockfishServer.getBestMove.mockResolvedValue('d2d4');

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBe('d2d4');
    });

    test('should use emergency fallback when all engines fail', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock both LLM and Stockfish failure
      llmAdapter.getMoveSuggestions.mockResolvedValue([]);
      botController.stockfishServer.getBestMove.mockResolvedValue(null);

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBeTruthy();
      expect(result.move.length).toBe(4); // Valid UCI format
    });
  });

  describe('Move Validation', () => {
    test('should validate move legality', () => {
      const controller = new BotController({
        name: 'Test',
        personality: { name: 'Test', description: 'Test', style: 'aggressive', sacrificeThreshold: 300, depthPreference: 'tactical' },
        llmConfig: { provider: 'gemini', apiKey: 'test' },
        stockfishConfig: { depth: 10, movetime: 1000 },
        fallbackThreshold: -300
      });

      // Test legal moves
      expect(controller.isMoveLegal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4')).toBe(true);
      expect(controller.isMoveLegal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g1f3')).toBe(true);
      
      // Test illegal moves
      expect(controller.isMoveLegal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e9')).toBe(false);
      expect(controller.isMoveLegal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'i2i4')).toBe(false);
      expect(controller.isMoveLegal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2')).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    test('Scenario A: LLM suggests illegal move → server rejects and falls back', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM suggesting illegal move
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'e2e9', reason: 'Invalid move' }
      ]);

      // Mock Stockfish fallback
      botController.stockfishServer.getBestMove.mockResolvedValue('e2e4');

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBe('e2e4');
      expect(result.move).not.toBe('e2e9');
    });

    test('Scenario B: LLM suggests legal sacrifice → Stockfish validation accepts', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock LLM suggesting sacrifice
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'f2f4', reason: 'Aggressive sacrifice for tactical play' }
      ]);

      // Mock Stockfish evaluation - sacrifice is acceptable
      botController.stockfishServer.evaluateMove.mockResolvedValue({
        move: 'f2f4',
        evaluation: -200, // 2 pawn sacrifice, acceptable
        depth: 16,
        nodes: 2000,
        time: 2500,
        pv: ['f2f4']
      });

      const result = await botController.getBestMove(fen, [], 'w');

      expect(result.source).toBe('llm');
      expect(result.move).toBe('f2f4');
      expect(result.reason).toContain('sacrifice');
    });

    test('Scenario C: Bot should not blunder basic mates', async () => {
      // Fool's mate position
      const foolsMateFEN = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      
      // Mock LLM suggesting bad moves that lead to mate
      llmAdapter.getMoveSuggestions.mockResolvedValue([
        { move: 'f3f4', reason: 'Bad move' }
      ]);

      // Mock Stockfish evaluation - move is catastrophically bad
      botController.stockfishServer.evaluateMove.mockResolvedValue({
        move: 'f3f4',
        evaluation: -9000, // Mate in 1
        depth: 16,
        nodes: 2000,
        time: 2500,
        pv: ['f3f4']
      });

      // Mock Stockfish suggesting better move
      botController.stockfishServer.getBestMove.mockResolvedValue('g1h3');

      const result = await botController.getBestMove(foolsMateFEN, [], 'w');

      expect(result.source).toBe('stockfish');
      expect(result.move).toBe('g1h3');
      expect(result.move).not.toBe('f3f4');
    });
  });
});


