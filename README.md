# Gambit

Real-time multiplayer chess game. Create room, share code, play chess.

## Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Chessboard  
**Backend**: Express.js, TypeScript, Socket.IO, Custom Chess Engine  
**Database**: Supabase PostgreSQL  
**Real-time**: WebSocket connections  
**AI Bots**: LLM Integration (Gemini/OpenRouter) + Stockfish Fallback  

## Architecture

```
Frontend (Vercel)     Backend (Render)      Database (Supabase)
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Next.js 14      │◄──┤ Express + Socket│◄──┤ PostgreSQL      │
│ TypeScript      │   │ Real-time WS    │   │ Real-time API   │
│ Tailwind CSS    │   │ Chess Engine    │   │ Row Level Sec   │
│ Socket.IO Client│   │ Move Validation │   │ Auto-scaling    │
│ Optimistic UI   │   │ Room Management │   │ Persistence     │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## How it works

Player creates room, gets 6-digit code  
Player shares code with friend  
Friend joins using code  
Chess game starts automatically  
Custom engine validates all moves  
WebSocket syncs moves instantly between players  

## Run locally

```bash
git clone https://github.com/dushyant4665/gambit
cd gambit

# Terminal 1 - Server
cd server
npm install
npm run dev

# Terminal 2 - Client  
cd client
npm install
npm run dev
```

Open http://localhost:3000

Connect GitHub repo to both platforms. Auto-deploys on push.

## Features

All chess rules implemented  
Move validation and checkmate detection  
Player names and room codes  
Mobile responsive design  
Database persistence  
Real-time WebSocket sync  
No authentication required  
**AI Chess Bots**: Michael Tal (aggressive) & Bobby Fischer (precise) with LLM + Stockfish integration

## AI Chess Bots

The application features two AI chess bots with distinct playing styles:

### Michael Tal Bot
- **Style**: Aggressive, tactical, sacrifice-friendly
- **Personality**: Known for brilliant tactical sacrifices and attacking play
- **Technology**: Gemini LLM + Stockfish validation
- **Sacrifice Tolerance**: Up to 5 pawns for tactical advantage

### Bobby Fischer Bot  
- **Style**: Classical, precise, accuracy-first
- **Personality**: Perfect endgame technique and positional understanding
- **Technology**: OpenRouter/DeepSeek LLM + Stockfish validation
- **Sacrifice Tolerance**: Conservative, prefers high-evaluation moves

### Bot Architecture
1. **LLM Analysis**: Bot analyzes position with personality-specific prompts
2. **Move Suggestions**: LLM provides 3 candidate moves with rationale
3. **Stockfish Validation**: Each move validated for legality and evaluation
4. **Fallback System**: Stockfish provides strong moves when LLM suggestions fail
5. **Authoritative Server**: All moves validated server-side before persistence

### Configuration
- **Free Tier Friendly**: Works without API keys using Stockfish-only mode
- **Rate Limited**: 20 LLM calls per minute with automatic fallback
- **Robust Fallback**: Multiple layers ensure bots always provide legal moves
- **Debug Endpoints**: Analyze bot decisions and move sources

See `/server/bots/README.md` for detailed documentation.
