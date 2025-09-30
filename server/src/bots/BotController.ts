import { LLMAdapter, LLMMove, LLMConfig, BotPersonality } from './LLMAdapter';
import { StockfishServer, StockfishConfig } from './StockfishServer';

export interface BotConfig {
  name: string;
  personality: BotPersonality;
  llmConfig: LLMConfig;
  stockfishConfig: StockfishConfig;
  fallbackThreshold: number; // Eval threshold below which to reject LLM moves
}

export interface MoveResult {
  move: string; // UCI format
  source: 'llm' | 'stockfish';
  evaluation: number;
  reason?: string;
  llmSuggestions?: LLMMove[];
  stockfishMove?: string;
}

export class BotController {
  private llmAdapter: LLMAdapter;
  private stockfishServer: StockfishServer;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.llmAdapter = new LLMAdapter(config.llmConfig);
    this.stockfishServer = new StockfishServer();
  }

  /**
   * Main method: Get the best move using LLM suggestions + Stockfish validation
   */
  public async getBestMove(
    fen: string,
    moveHistory: string[] = [],
    sideToMove: 'w' | 'b'
  ): Promise<MoveResult> {
    console.log(`🧠 ${this.config.name} analyzing position...`);

    // Step 1: Get LLM suggestions
    const llmSuggestions = await this.llmAdapter.getMoveSuggestions(
      fen,
      this.config.personality,
      moveHistory,
      sideToMove
    );

    console.log(`📝 LLM suggested ${llmSuggestions.length} moves`);

    // Step 2: Validate each LLM suggestion with Stockfish
    if (llmSuggestions.length > 0) {
      for (const suggestion of llmSuggestions) {
        console.log(`🔍 Validating LLM move: ${suggestion.move}`);
        
        const validation = await this.validateLLMMove(fen, suggestion, sideToMove);
        
        if (validation.isValid) {
          console.log(`✅ LLM move accepted: ${suggestion.move} (eval: ${validation.evaluation})`);
          return {
            move: suggestion.move,
            source: 'llm',
            evaluation: validation.evaluation,
            reason: suggestion.reason,
            llmSuggestions,
            stockfishMove: validation.stockfishMove
          };
        } else {
          console.log(`❌ LLM move rejected: ${suggestion.move} - ${validation.reason}`);
        }
      }
    }

    // Step 3: Fallback to Stockfish best move
    console.log(`🤖 Falling back to Stockfish for ${this.config.name}`);
    const stockfishMove = await this.stockfishServer.getBestMove(fen, this.config.stockfishConfig);
    
    if (stockfishMove) {
      return {
        move: stockfishMove,
        source: 'stockfish',
        evaluation: 0, // Would be calculated from Stockfish analysis
        llmSuggestions,
        stockfishMove
      };
    }

    // Ultimate fallback
    console.log(`⚠️ All engines failed, using emergency fallback`);
    return {
      move: this.getEmergencyFallbackMove(fen, sideToMove),
      source: 'stockfish',
      evaluation: 0,
      llmSuggestions,
      stockfishMove: 'fallback'
    };
  }

  /**
   * Validate an LLM-suggested move with Stockfish
   */
  private async validateLLMMove(
    fen: string,
    suggestion: LLMMove,
    sideToMove: 'w' | 'b'
  ): Promise<{
    isValid: boolean;
    evaluation: number;
    reason?: string;
    stockfishMove?: string;
  }> {
    try {
      // First check if the move is legal using basic validation
      if (!this.isMoveLegal(fen, suggestion.move)) {
        return {
          isValid: false,
          evaluation: -9999,
          reason: 'Illegal move'
        };
      }

      // Get Stockfish's evaluation of this move
      const evaluation = await this.stockfishServer.evaluateMove(
        fen,
        suggestion.move,
        this.config.stockfishConfig
      );

      if (!evaluation) {
        return {
          isValid: false,
          evaluation: -9999,
          reason: 'Stockfish evaluation failed'
        };
      }

      // Check if the move leaves the player in check (basic validation)
      if (this.wouldLeaveInCheck(fen, suggestion.move, sideToMove)) {
        return {
          isValid: false,
          evaluation: -9999,
          reason: 'Move leaves king in check'
        };
      }

      // Apply personality-specific validation
      const isValidForPersonality = this.validateForPersonality(
        suggestion,
        evaluation.evaluation,
        sideToMove
      );

      if (!isValidForPersonality.isValid) {
        return {
          isValid: false,
          evaluation: evaluation.evaluation,
          reason: isValidForPersonality.reason
        };
      }

      return {
        isValid: true,
        evaluation: evaluation.evaluation,
        stockfishMove: evaluation.move
      };
    } catch (error) {
      console.error('Error validating LLM move:', error);
      return {
        isValid: false,
        evaluation: -9999,
        reason: 'Validation error'
      };
    }
  }

  /**
   * Basic move legality check
   */
  private isMoveLegal(fen: string, move: string): boolean {
    if (move.length !== 4) return false;
    
    const fromFile = move.charCodeAt(0) - 97; // a=0, b=1, etc.
    const fromRank = parseInt(move[1]) - 1;
    const toFile = move.charCodeAt(2) - 97;
    const toRank = parseInt(move[3]) - 1;

    // Basic bounds check
    return fromFile >= 0 && fromFile <= 7 &&
           fromRank >= 0 && fromRank <= 7 &&
           toFile >= 0 && toFile <= 7 &&
           toRank >= 0 && toRank <= 7;
  }

  /**
   * Check if move would leave king in check (simplified)
   */
  private wouldLeaveInCheck(fen: string, move: string, sideToMove: 'w' | 'b'): boolean {
    // This is a simplified check - in a full implementation you'd use a proper chess engine
    // For now, we'll assume the move is safe if it's legal
    return false;
  }

  /**
   * Validate move based on bot personality
   */
  private validateForPersonality(
    suggestion: LLMMove,
    evaluation: number,
    sideToMove: 'w' | 'b'
  ): { isValid: boolean; reason?: string } {
    const isSacrifice = suggestion.reason.toLowerCase().includes('sacrifice') ||
                       suggestion.reason.toLowerCase().includes('sac');

    if (isSacrifice) {
      // For Tal (aggressive), allow sacrifices up to the configured threshold
      if (this.config.personality.style === 'aggressive') {
        const maxSacrifice = this.config.personality.sacrificeThreshold;
        if (evaluation < -maxSacrifice) {
          return {
            isValid: false,
            reason: `Sacrifice too costly (${evaluation} < ${-maxSacrifice})`
          };
        }
      } else {
        // Fischer (precise) - be more conservative with sacrifices
        if (evaluation < -200) { // 2 pawns
          return {
            isValid: false,
            reason: `Sacrifice too costly for precise style (${evaluation} < -200)`
          };
        }
      }
    } else {
      // For non-sacrifices, reject clearly losing moves
      if (evaluation < this.config.fallbackThreshold) {
        return {
          isValid: false,
          reason: `Move evaluation too low (${evaluation} < ${this.config.fallbackThreshold})`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Emergency fallback move when all else fails
   */
  private getEmergencyFallbackMove(fen: string, sideToMove: 'w' | 'b'): string {
    // Simple fallback moves based on side
    const whiteMoves = ['e2e4', 'd2d4', 'g1f3', 'c2c4'];
    const blackMoves = ['e7e5', 'd7d5', 'g8f6', 'c7c5'];
    
    const moves = sideToMove === 'w' ? whiteMoves : blackMoves;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /**
   * Check if the bot is ready to play
   */
  public isReady(): boolean {
    return this.stockfishServer.isEngineReady() || this.llmAdapter.isAvailable();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stockfishServer.destroy();
    this.llmAdapter.clearCache();
  }
}


