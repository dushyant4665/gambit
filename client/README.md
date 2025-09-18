# ♟️ Gambit Client

The frontend for our chess game. Built with Next.js 14.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and play chess!

## 🛠️ For Production

```bash
# Build optimized version
npm run build

# Start production server  
npm start
```

## 📱 What's Inside

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Chessboard** - Chess UI
- **Responsive Design** - Works on mobile

## ⚙️ Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For production, change to your deployed server URL.

## 📊 Bundle Size

- Main page: 91.2 kB
- Game room: 120 kB
- 4 static pages pre-built

Pretty fast! ⚡

## 🌐 Deploy

**Vercel** (recommended):
1. Connect GitHub repo
2. Auto-deploys on push
3. Set `NEXT_PUBLIC_API_URL` in settings

**Netlify**:
1. Connect GitHub repo  
2. Build: `npm run build`
3. Publish: `out/` folder

Both are free!
