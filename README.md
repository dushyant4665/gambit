# Gambit

Real-time multiplayer chess game. Create room, share code, play chess.

## Tech Stack

Frontend: Next.js 14, TypeScript, Tailwind CSS, React Chessboard  
Backend: Express.js, TypeScript, Custom Chess Engine  
Storage: In-memory (no database)  
Real-time: HTTP polling

## How it works

1. Player creates room, gets 6-digit code
2. Player shares code with friend
3. Friend joins using code
4. Chess game starts automatically
5. Custom engine validates all moves
6. Client polls server every 200ms for updates

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

Client: Vercel (free tier)  
Server: Railway (free tier)

Connect GitHub repo to both platforms. Auto-deploys on push.

## Features

- All chess rules implemented
- Move validation and checkmate detection
- Player names and room codes
- Mobile responsive design
- No authentication required

## Architecture

Client sends HTTP requests to server. Server validates moves using custom chess engine. Game state stored in memory. Client polls for updates.