# Gambit

Real-time multiplayer chess game. Create room, share code, play chess.

## Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Chessboard  
**Backend**: Express.js, TypeScript, Socket.IO, Custom Chess Engine  
**Database**: Supabase PostgreSQL  
**Real-time**: WebSocket connections  

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

## Deploy

**Client**: Vercel (free tier)  
**Server**: Render (free tier)  

Connect GitHub repo to both platforms. Auto-deploys on push.

## Features

All chess rules implemented  
Move validation and checkmate detection  
Player names and room codes  
Mobile responsive design  
Database persistence  
Real-time WebSocket sync  
No authentication required