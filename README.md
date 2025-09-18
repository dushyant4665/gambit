# Chess MLT - Real-time Multiplayer Chess with Custom Engine

A real-time multiplayer chess game built with MERN stack + Supabase Realtime. Features a **custom chess engine** with all rules implemented from scratch - no external chess libraries used!

## Features

- **No Authentication**: Jump right into games without signing up
- **Real-time Gameplay**: Moves sync instantly between players using Supabase Realtime
- **Simple Room System**: Create rooms with 6-digit codes or join existing ones
- **Custom Chess Engine**: Complete chess rule validation built from scratch
- **Full Chess Rules**: Castling, en passant, promotion, check/checkmate, stalemate, 50-move rule
- **Dark Responsive UI**: Modern design with custom color scheme
- **Move History**: Track all moves with piece information

## Tech Stack

### Frontend
- **Next.js 14** with TypeScript
- **Tailwind CSS** for styling (#0b1020 background, #60a5fa accents)
- **react-chessboard** for the chess UI rendering
- **Supabase Client** for real-time subscriptions

### Backend
- **Express.js** with TypeScript
- **Custom ChessEngine** class with complete rule implementation
- **Supabase** for database and real-time features
- **Docker** ready for deployment

### Database
- **Supabase Postgres** with real-time subscriptions
- Tables: `rooms`, `moves` (with piece, promotion fields)

## Quick Start

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration SQL to create tables:

```sql
-- Copy and paste the contents of supabase-migration.sql into the SQL editor
```

3. Get your project credentials:
   - Project URL
   - Anon (public) key
   - Service role key

### 2. Server Setup

```bash
cd server
npm install

# Copy environment file and add your Supabase credentials
cp env.example .env

# Add to .env:
# SUPABASE_URL=your_supabase_project_url
# SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# PORT=3001

# Run development server
npm run dev
```

### 3. Client Setup

```bash
cd client
npm install

# Copy environment file and add your credentials
cp env.example .env.local

# Add to .env.local:
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# NEXT_PUBLIC_API_URL=http://localhost:3001

# Run development server
npm run dev
```

### 4. Play!

1. Open http://localhost:3000
2. Click "Create Room" to start a new game
3. Share the 6-digit room code with another player
4. They click "Join Room" and enter the code
5. Start playing chess in real-time!

## Deployment

### Deploy Frontend to Vercel

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (your deployed backend URL)
4. Deploy!

### Deploy Backend to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Set build command: `cd server && npm install && npm run build`
4. Set start command: `cd server && npm start`
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT` (Render will set this automatically)
6. Deploy!

### Alternative: Deploy Backend to Fly.io

1. Install [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Create `server/fly.toml`:

```toml
app = "your-chess-app"
primary_region = "dfw"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3001
  force_https = true

[[http_service.checks]]
  method = "get"
  path = "/health"
  interval = "15s"
  timeout = "10s"
```

3. The Dockerfile is already included in the project

4. Deploy:

```bash
cd server
fly deploy
fly secrets set SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key
```

## Project Structure

```
chessmlt/
├── client/                 # Next.js frontend
│   ├── app/
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Landing page
│   │   └── room/[code]/
│   │       └── page.tsx   # Game room
│   └── lib/
│       ├── supabase.ts    # Supabase client
│       └── api.ts         # API functions
├── server/                # Express backend
│   └── src/
│       ├── index.ts       # Main server file
│       ├── supabase.ts    # Supabase config
│       └── utils.ts       # Utility functions
└── supabase-migration.sql # Database schema
```

## Custom Chess Engine

The heart of this project is a **completely custom chess engine** built from scratch in TypeScript. No external chess libraries used!

### ChessEngine Features
- **8x8 Board Representation**: Array-based board with piece codes (`wp`, `bk`, etc.)
- **FEN Support**: Load/export positions using standard FEN notation
- **Complete Move Validation**: All piece movement rules implemented
- **Special Moves**: Castling (kingside/queenside), en passant, pawn promotion
- **Game State Detection**: Check, checkmate, stalemate, draw conditions
- **50-Move Rule**: Automatic draw detection
- **Move History**: Complete game tracking with move objects

### Architecture
```typescript
class ChessEngine {
  loadFEN(fen: string): void
  exportFEN(): string
  makeMove(from: Position, to: Position, promotion?: PieceType): Move | null
  isMoveValid(from: Position, to: Position): boolean
  isCheck(): boolean
  isCheckmate(): boolean
  isStalemate(): boolean
  isDraw(): boolean
}
```

## How It Works

### Room Creation Flow
1. User clicks "Create Room"
2. Server generates unique 6-digit code
3. Room record created in Supabase + ChessEngine initialized
4. User sees chessboard with "Waiting for Player 2..."
5. Real-time subscription established for the room

### Join Room Flow
1. User clicks "Join Room" and enters code
2. Client checks if room exists via API
3. If valid, user joins the room (becomes Player 2/Black)
4. Both players can now see the game and make moves

### Move Flow
1. Player drags piece on board (react-chessboard)
2. Client sends move to Express server
3. **Custom ChessEngine validates move** (all rules checked)
4. If valid, server stores move in Supabase with piece info
5. Supabase Realtime broadcasts to both clients
6. Both boards update with new FEN position

## Environment Variables

### Client (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Server (.env)
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

## Testing the Custom Chess Engine

Test illegal move rejection:

```bash
# Start the server
cd server && npm run dev

# Try an illegal move (should be rejected)
curl -X POST http://localhost:3001/api/moves \
  -H "Content-Type: application/json" \
  -d '{
    "room_code": "TEST01",
    "from": "e2",
    "to": "e5"
  }'
# Should return: {"success": false, "error": "Invalid move"}
```

The custom ChessEngine validates:
- ✅ Piece movement rules (pawns can't jump 3 squares)
- ✅ Path blocking (can't jump over pieces)  
- ✅ Turn order (white moves first)
- ✅ King safety (no moves that leave king in check)
- ✅ Special moves (castling, en passant, promotion)

## License

MIT
