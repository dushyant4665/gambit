# Gambit Server

Backend for the chess game. Handles game logic and moves.

## Tech Stack

- Express.js - Web server
- TypeScript - Type safety
- Custom Chess Engine - All chess rules from scratch
- In-Memory Storage - No database needed
- CORS - Cross-origin requests

## Development

```bash
npm install
npm run test
```

Server runs on http://localhost:3001

## Production

```bash
npm run build
npm run start:prod
```

## Environment

Create .env:

```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-frontend-url.vercel.app
```

## API Endpoints

- GET /health - Server status
- POST /api/rooms - Create room
- POST /api/moves - Make move
- GET /api/rooms/:code/state - Get game state

## Deploy

Railway: Connect GitHub repo, auto-deploys  
Render: Connect GitHub repo, build and start commands  
Fly.io: Use fly deploy command

All have free tiers.

## Features

- Chess move validation
- Room-based multiplayer
- Checkmate detection
- Request logging
- Health monitoring
