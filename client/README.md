# Gambit Client

Frontend for the chess game. Built with Next.js 14.

## Tech Stack

- Next.js 14 - React framework
- TypeScript - Type safety
- Tailwind CSS - Styling
- React Chessboard - Chess UI component

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Production

```bash
npm run build
npm start
```

## Environment

Create .env.local:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Change URL for production deployment.

## Deploy

Vercel: Connect GitHub repo, auto-deploys  
Netlify: Connect GitHub repo, set build command

Both have free tiers.
