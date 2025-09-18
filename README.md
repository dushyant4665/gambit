# Gambit

Real-time multiplayer chess game. No signup required.

## What it does

Create a room with 6-digit code. Share code with friend. Play chess instantly.

## Tech Stack

Frontend: Next.js 14, TypeScript, Tailwind CSS, React Chessboard
Backend: Express.js, TypeScript, Custom Chess Engine
Database: In-memory storage
Real-time: HTTP polling

## How it works

1. Player 1 creates room, gets unique code
2. Player 2 joins using code
3. Game starts automatically
4. Moves validated by custom chess engine
5. Real-time updates via HTTP requests

## Run locally

```bash
git clone https://github.com/dushyant4665/gambit
cd gambit

# Terminal 1 - Server
cd server
npm install
npm run test

# Terminal 2 - Client
cd client
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

Client: Vercel (free)
Server: Railway (free)

Connect GitHub repo to both platforms. Auto-deploys on push.

## Features

- All chess rules implemented
- Move validation
- Checkmate detection
- Player names
- Mobile responsive
- No database required

## Architecture

Client sends HTTP requests to server. Server validates moves using custom chess engine. Game state stored in memory. Client polls for updates every 200ms.