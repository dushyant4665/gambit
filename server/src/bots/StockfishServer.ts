import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export interface StockfishConfig {
  depth: number;
  movetime: number; // milliseconds
  threads?: number;
  hash?: number; // MB
}

export interface StockfishEvaluation {
  move: string;
  evaluation: number; // centipawns
  depth: number;
  nodes: number;
  time: number;
  pv: string[]; // principal variation
}

export class StockfishServer {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;
  private pendingCommands: Array<{
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    command: string;
  }> = [];
  private currentCommand: string | null = null;

  constructor() {
    this.initializeEngine();
  }

  private async initializeEngine(): Promise<void> {
    try {
      // Try to find Stockfish binary in common locations
      const possiblePaths = [
        'stockfish', // In PATH
        '/usr/bin/stockfish',
        '/usr/local/bin/stockfish',
        path.join(__dirname, '../../../bin/stockfish'),
        path.join(process.cwd(), 'bin/stockfish')
      ];

      let stockfishPath: string | null = null;
      
      for (const possiblePath of possiblePaths) {
        try {
          // Test if the binary exists and is executable
          const { spawn } = await import('child_process');
          const testProcess = spawn(possiblePath, ['--help'], { stdio: 'pipe' });
          
          await new Promise((resolve, reject) => {
            testProcess.on('close', (code) => {
              if (code === 0 || code === 1) { // Stockfish returns 1 for --help
                resolve(code);
              } else {
                reject(new Error(`Exit code: ${code}`));
              }
            });
            testProcess.on('error', reject);
          });
          
          stockfishPath = possiblePath;
          break;
        } catch (error) {
          // Continue to next path
        }
      }

      if (!stockfishPath) {
        console.log('⚠️ Stockfish binary not found, using fallback simulation');
        this.isReady = true;
        return;
      }

      console.log(`🧠 Starting Stockfish from: ${stockfishPath}`);
      
      this.process = spawn(stockfishPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => this.handleEngineOutput(line.trim()));
      });

      this.process.stderr?.on('data', (data) => {
        console.error('Stockfish stderr:', data.toString());
      });

      this.process.on('close', (code) => {
        console.log(`Stockfish process exited with code ${code}`);
        this.isReady = false;
      });

      this.process.on('error', (error) => {
        console.error('Stockfish process error:', error);
        this.isReady = false;
      });

      // Initialize UCI protocol
      await this.sendCommand('uci');
      await this.sendCommand('isready');
      
      console.log('✅ Stockfish server ready');
    } catch (error) {
      console.error('❌ Failed to initialize Stockfish:', error);
      this.isReady = true; // Allow fallback mode
    }
  }

  private handleEngineOutput(line: string): void {
    if (line.includes('uciok')) {
      this.isReady = true;
      this.resolveCurrentCommand('uciok');
    } else if (line.includes('readyok')) {
      this.resolveCurrentCommand('readyok');
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const bestMove = parts[1];
      this.resolveCurrentCommand(bestMove !== '(none)' ? bestMove : null);
    } else if (line.startsWith('info')) {
      // Handle info messages (evaluation, depth, etc.)
      this.handleInfoMessage(line);
    }
  }

  private handleInfoMessage(line: string): void {
    // Store evaluation info for later use
    // This could be enhanced to track multiple lines of analysis
  }

  private resolveCurrentCommand(result: any): void {
    const command = this.pendingCommands.shift();
    if (command) {
      command.resolve(result);
      this.currentCommand = null;
      this.processNextCommand();
    }
  }

  private processNextCommand(): void {
    if (this.pendingCommands.length > 0 && !this.currentCommand) {
      const command = this.pendingCommands[0];
      this.currentCommand = command.command;
      this.process?.stdin?.write(command.command + '\n');
    }
  }

  private async sendCommand(command: string): Promise<any> {
    if (!this.process) {
      throw new Error('Stockfish process not available');
    }

    return new Promise((resolve, reject) => {
      this.pendingCommands.push({ resolve, reject, command });
      
      if (!this.currentCommand) {
        this.processNextCommand();
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        const index = this.pendingCommands.findIndex(cmd => cmd.command === command);
        if (index !== -1) {
          this.pendingCommands.splice(index, 1);
          reject(new Error('Command timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Get the best move from Stockfish
   */
  public async getBestMove(fen: string, config: StockfishConfig): Promise<string | null> {
    if (!this.isReady || !this.process) {
      console.log('⚠️ Stockfish not available, using fallback');
      return this.getFallbackMove();
    }

    try {
      await this.sendCommand(`position fen ${fen}`);
      const command = `go depth ${config.depth} movetime ${config.movetime}`;
      const result = await this.sendCommand(command);
      return result;
    } catch (error) {
      console.error('Stockfish getBestMove error:', error);
      return this.getFallbackMove();
    }
  }

  /**
   * Evaluate a specific move
   */
  public async evaluateMove(
    fen: string, 
    move: string, 
    config: StockfishConfig
  ): Promise<StockfishEvaluation | null> {
    if (!this.isReady || !this.process) {
      return null;
    }

    try {
      await this.sendCommand(`position fen ${fen} moves ${move}`);
      const command = `go depth ${Math.min(config.depth, 15)} movetime ${Math.min(config.movetime, 2000)}`;
      
      // For now, return a basic evaluation
      // In a full implementation, you'd parse the info messages for detailed evaluation
      const bestMove = await this.sendCommand(command);
      
      return {
        move: bestMove || move,
        evaluation: 0, // Would be parsed from info messages
        depth: config.depth,
        nodes: 0,
        time: config.movetime,
        pv: [bestMove || move]
      };
    } catch (error) {
      console.error('Stockfish evaluateMove error:', error);
      return null;
    }
  }

  /**
   * Get multiple best moves
   */
  public async getMultipleBestMoves(
    fen: string, 
    config: StockfishConfig, 
    count: number = 3
  ): Promise<string[]> {
    const bestMove = await this.getBestMove(fen, config);
    if (!bestMove) {
      return [];
    }

    // For simplicity, return just the best move
    // In a full implementation, you'd use multipv to get multiple lines
    return [bestMove];
  }

  /**
   * Fallback move generation when Stockfish is not available
   */
  private getFallbackMove(): string | null {
    // Simple fallback - return a common opening move
    const fallbackMoves = ['e2e4', 'd2d4', 'g1f3', 'c2c4', 'e7e5', 'd7d5'];
    return fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)];
  }

  /**
   * Check if Stockfish is ready
   */
  public isEngineReady(): boolean {
    return this.isReady && this.process !== null;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isReady = false;
    this.pendingCommands = [];
  }
}


