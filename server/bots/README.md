# Chess Bot System

This directory contains the LLM-styled chess bot system that integrates Large Language Models with Stockfish for authoritative move validation and fallback.

## Architecture

The bot system follows this pipeline:

```
User Move → Server → LLM Analysis → Stockfish Validation → Database Persistence → Client Broadcast
```

### Core Components

1. **LLMAdapter** (`LLMAdapter.ts`) - Handles communication with LLM providers (Gemini/OpenRouter)
2. **StockfishServer** (`StockfishServer.ts`) - Manages server-side Stockfish engine for validation
3. **BotController** (`BotController.ts`) - Orchestrates the LLM → Stockfish pipeline
4. **TalFischerBots** (`TalFischerBots.ts`) - Specific bot implementations with personality

## Bot Personalities

### Michael Tal (TalBot)
- **Style**: Aggressive, tactical, sacrifice-friendly
- **Sacrifice Threshold**: Up to 5 pawns (-500 centipawns)
- **Stockfish Config**: Depth 16, 2.5s thinking time
- **Fallback Threshold**: -500 centipawns
- **LLM Provider**: Gemini (preferred for aggressive play)

### Bobby Fischer (FischerBot)
- **Style**: Classical, precise, accuracy-first
- **Sacrifice Threshold**: Up to 2 pawns (-200 centipawns)
- **Stockfish Config**: Depth 22, 4s thinking time
- **Fallback Threshold**: -200 centipawns
- **LLM Provider**: OpenRouter/DeepSeek (preferred for positional play)

## Configuration

### Environment Variables

```bash
# LLM API Keys (optional - system works without them using Stockfish-only mode)
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Stockfish Configuration (optional - defaults work for most systems)
STOCKFISH_PATH=/usr/bin/stockfish  # Path to Stockfish binary
```

### Stockfish Installation

The system will automatically detect Stockfish in these locations:
1. `stockfish` (in system PATH)
2. `/usr/bin/stockfish`
3. `/usr/local/bin/stockfish`
4. `./bin/stockfish` (project directory)

If Stockfish is not found, the system falls back to simulated moves (suitable for testing).

## API Usage

### Creating a Bot

```typescript
import { createBot } from './bots/TalFischerBots';

// Create Tal bot with Gemini
const talBot = createBot('tal', process.env.GEMINI_API_KEY, 'gemini');

// Create Fischer bot with OpenRouter
const fischerBot = createBot('fischer', process.env.OPENROUTER_API_KEY, 'openrouter');
```

### Getting Bot Moves

```typescript
const moveResult = await bot.getBestMove(
  fen,           // Current position in FEN format
  moveHistory,   // Array of previous moves in UCI format
  sideToMove     // 'w' or 'b'
);

console.log(`Bot chose: ${moveResult.move}`);
console.log(`Source: ${moveResult.source}`); // 'llm' or 'stockfish'
console.log(`Reason: ${moveResult.reason}`);
```

### Move Validation Pipeline

1. **LLM Analysis**: Bot sends position + personality to LLM
2. **Move Suggestions**: LLM returns 3 candidate moves with rationale
3. **Stockfish Validation**: Each move is validated for:
   - Legality (basic rules)
   - King safety (not leaving in check)
   - Evaluation threshold (personality-specific)
4. **Fallback**: If no LLM moves pass validation, use Stockfish best move
5. **Persistence**: Validated move is saved to database and broadcast

## Socket.IO Events

### Client → Server
- `bot-move`: Request bot to make a move
  ```javascript
  socket.emit('bot-move', {
    roomCode: 'ABC123',
    botType: 'tal' // or 'fischer'
  });
  ```

### Server → Client
- `bot:move:confirmed`: Bot move has been made
  ```javascript
  socket.on('bot:move:confirmed', (data) => {
    console.log(`Bot ${data.botType} played ${data.move}`);
    console.log(`Source: ${data.source}`);
    console.log(`LLM Reason: ${data.reason}`);
  });
  ```

- `bot:move:rejected`: Bot move was rejected
  ```javascript
  socket.on('bot:move:rejected', (data) => {
    console.log(`Bot move rejected: ${data.error}`);
  });
  ```

## Debug Endpoints

### Bot Analysis
```
GET /api/debug/bot/:roomCode/:botType
```

Returns detailed analysis of what the bot would play in the current position:
```json
{
  "room": {
    "code": "ABC123",
    "status": "playing",
    "currentFEN": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "currentTurn": "w"
  },
  "bot": {
    "type": "tal",
    "ready": true,
    "moveResult": {
      "move": "e2e4",
      "source": "llm",
      "evaluation": 25,
      "reason": "Central control and development"
    }
  },
  "analysis": {
    "suggestedMove": "e2e4",
    "source": "llm",
    "evaluation": 25,
    "reason": "Central control and development"
  }
}
```

## Testing

Run the test suite:
```bash
npm test
```

### Test Coverage

- **Unit Tests**: LLM response parsing, move validation, personality filtering
- **Integration Tests**: Full pipeline from LLM suggestion to Stockfish validation
- **Scenario Tests**: 
  - Illegal move rejection
  - Sacrifice acceptance/rejection based on personality
  - Fallback behavior when LLM fails
  - Rate limiting and timeout handling

### Test Scenarios

1. **Scenario A**: LLM suggests illegal move → server rejects and falls back to Stockfish
2. **Scenario B**: LLM suggests legal sacrifice → Stockfish validation accepts if within threshold
3. **Scenario C**: Bot avoids basic mating patterns (Fool's mate, Scholar's mate)

## Performance & Limits

### Rate Limiting
- LLM calls limited to 20 per minute (free tier friendly)
- Automatic fallback to Stockfish when rate limited
- Local caching of identical positions

### Timeouts
- LLM requests timeout after 3 seconds
- Stockfish analysis timeout after configured movetime + 2s buffer
- Emergency fallback moves when all engines fail

### Memory Management
- Bot instances are cleaned up when rooms are closed
- LLM response cache limited to 100 entries
- Stockfish processes properly terminated on cleanup

## Troubleshooting

### Common Issues

1. **"Bot not ready"**: Check if Stockfish binary is installed and accessible
2. **"LLM API error"**: Verify API keys are correct and not rate limited
3. **"Move validation failed"**: Check if the move is legal and doesn't leave king in check

### Fallback Behavior

The system is designed to be robust:
- No API keys → Stockfish-only mode
- Stockfish unavailable → Simulated moves
- LLM timeout → Stockfish fallback
- All engines fail → Emergency fallback moves

### Logging

Enable debug logging by setting:
```bash
DEBUG=chess-bot:*
```

This will show:
- LLM API calls and responses
- Stockfish analysis results
- Move validation decisions
- Fallback triggers

## Development

### Adding New Bot Personalities

1. Create new personality config in `TalFischerBots.ts`
2. Add bot class extending `BotController`
3. Update `createBot` factory function
4. Add tests for new personality behavior

### Customizing LLM Prompts

Modify the `buildPrompt` method in `LLMAdapter.ts` to customize how the bot communicates with the LLM.

### Stockfish Configuration

Adjust `StockfishConfig` in bot constructors to change analysis depth, time limits, and resource usage.

## Security

- All moves are validated server-side before persistence
- LLM responses are sanitized and validated
- Rate limiting prevents API abuse
- No client-side move decisions are trusted

## License

This bot system is part of the Gambit chess application and follows the same licensing terms.


