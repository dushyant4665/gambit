# ♟️ Gambit - Real-Time Chess Game

Play chess with your friends online, instantly. No signup needed.

## 🚀 What is this?

A multiplayer chess game where:
- Create a room, share the code with your friend
- Play chess in real-time 
- Works on any device (phone, tablet, computer)
- Built with custom chess engine (no external libraries)

## 🎮 How to play?

1. **Create Room**: Enter your name, get a 6-digit code
2. **Share Code**: Send the code to your friend
3. **Play Chess**: Friend joins, game starts automatically
4. **Win**: Checkmate your opponent!

## 🛠️ Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Chessboard
**Backend**: Express.js, TypeScript, Custom Chess Engine
**Real-time**: HTTP polling (fast updates)

## 🏃‍♂️ Run Locally

```bash
# Clone the repo
git clone https://github.com/dushyant4665/gambit
cd gambit

# Start server
cd server
npm install
npm run test

# Start client (new terminal)
cd client  
npm install
npm run dev
```

Visit `http://localhost:3000` and start playing!

## 🌐 Deploy for Free

### Option 1: Vercel + Railway (Recommended)
1. **Client**: Push to GitHub → Connect Vercel → Done
2. **Server**: Same repo → Connect Railway → Done
3. **Config**: Set `NEXT_PUBLIC_API_URL` to Railway URL

### Option 2: Netlify + Render
1. **Client**: GitHub → Netlify
2. **Server**: GitHub → Render
3. **Config**: Update API URL

Both are 100% free for small projects.

## 📱 Features

- ✅ Real-time multiplayer
- ✅ Custom player names  
- ✅ Responsive design (works on mobile)
- ✅ All chess rules (castling, en passant, promotion)
- ✅ Checkmate/stalemate detection
- ✅ Move history
- ✅ No authentication needed

## 🎯 Why Gambit?

- **Simple**: Just share a code, start playing
- **Fast**: Real-time updates, no lag
- **Clean**: Beautiful, modern interface
- **Smart**: Custom chess engine validates all moves
- **Free**: Deploy anywhere for $0

## 🤝 Contributing

Found a bug? Want to add a feature? 
1. Fork the repo
2. Make changes
3. Send a pull request

## 📞 Support

Having issues? Create an issue on GitHub or DM me.

---

**Made with ❤️ for chess lovers**

[Play Now](https://your-deployment-url.vercel.app) | [GitHub](https://github.com/dushyant4665/gambit)