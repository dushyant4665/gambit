# 🚀 Gambit Server

The backend for our chess game. Handles all game logic and moves.

## 🚀 Quick Start

```bash
npm install
npm run test
```

Server starts on `http://localhost:3001`

## 🛠️ For Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm run start:prod
```

## 🧠 What's Inside

- **Express.js** - Web server
- **TypeScript** - Type safety  
- **Custom Chess Engine** - All chess rules built from scratch
- **In-Memory Storage** - Super fast (no database needed)
- **CORS** - Handles cross-origin requests

## ⚙️ Environment

Create `.env`:

```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-frontend-url.vercel.app
```

## 📡 API Endpoints

- `GET /health` - Check if server is alive
- `POST /api/rooms` - Create new game room
- `POST /api/moves` - Make a chess move
- `GET /api/rooms/:code/state` - Get current game state

## 🌐 Deploy for Free

**Railway** (recommended):
1. Connect GitHub repo
2. Auto-deploys
3. Always online (no sleeping)

**Render**:
1. Connect GitHub repo
2. Build: `npm run build`
3. Start: `npm run start:prod`
4. Sleeps after 15min (free tier)

**Fly.io**:
```bash
fly deploy
```

## 🐳 Docker

```bash
# Build image
docker build -t gambit-server .

# Run container
docker run -p 3001:3001 gambit-server
```

## 🔧 Features

- Real-time chess game logic
- Room-based multiplayer
- Move validation
- Checkmate detection
- Health monitoring
- Request logging

Simple and fast! ⚡
