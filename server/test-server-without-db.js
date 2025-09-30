// Test server without database dependency
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');
const { createBot } = require('./dist/bots/TalFischerBots');

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

// Store bot instances
const botInstances = new Map();

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    bots: {
      tal: 'Ready',
      fischer: 'Ready'
    }
  });
});

// AI game creation endpoint
app.post('/api/create-ai-game', (req, res) => {
  const { botType } = req.body;
  
  try {
    const roomCode = `AI-${Date.now().toString(36).toUpperCase()}`;
    
    console.log(`🤖 Creating AI game: ${roomCode} with ${botType} bot`);
    
    res.json({
      success: true,
      roomCode,
      botType,
      message: 'AI game created successfully'
    });
  } catch (error) {
    console.error('Error creating AI game:', error);
    res.status(500).json({ error: 'Failed to create AI game' });
  }
});

// Bot analysis endpoint
app.get('/api/bot-analysis/:botType', async (req, res) => {
  const { botType } = req.params;
  
  try {
    const botKey = `test-${botType}`;
    let bot = botInstances.get(botKey);
    
    if (!bot) {
      const llmApiKey = botType === 'tal' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
      const llmProvider = botType === 'tal' ? 'gemini' : 'openrouter';
      
      bot = createBot(botType, llmApiKey, llmProvider);
      botInstances.set(botKey, bot);
    }
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const moveHistory = [];
    const sideToMove = 'w';
    
    console.log(`🧠 Analyzing with ${botType} bot...`);
    const moveResult = await bot.getBestMove(fen, moveHistory, sideToMove);
    
    res.json({
      success: true,
      botType,
      analysis: {
        suggestedMove: moveResult.move,
        source: moveResult.source,
        evaluation: moveResult.evaluation,
        reason: moveResult.reason,
        llmAvailable: bot.llmAdapter.isAvailable(),
        ready: bot.isReady()
      },
      environment: {
        geminiKey: process.env.GEMINI_API_KEY ? 'Set' : 'Not Set',
        openRouterKey: process.env.OPENROUTER_API_KEY ? 'Set' : 'Not Set'
      }
    });
  } catch (error) {
    console.error('Bot analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      botType 
    });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('create-ai-game', async (data) => {
    const { botType, playerName } = data;
    
    try {
      console.log(`🤖 Creating AI game with ${botType} bot`);
      
      const roomCode = `AI-${Date.now().toString(36).toUpperCase()}`;
      
      socket.join(roomCode);
      
      // Send initial game state
      socket.emit('game-state', {
        roomCode,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        activeColor: 'w',
        gameStatus: 'ongoing',
        moveCount: 0,
        playerNames: { 
          white: playerName, 
          black: botType === 'tal' ? 'Michael Tal' : 'Bobby Fischer' 
        },
        playerCount: 2,
        gameStarted: true
      });
      
      console.log(`✅ AI game created: ${roomCode} with ${botType}`);
    } catch (error) {
      console.error('Error creating AI game:', error);
      socket.emit('error', { message: 'Failed to create AI game' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🤖 AI Chess Bot Test Server running on port ${PORT}`);
  console.log(`🔑 API Keys Status:`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not Set'}`);
  console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not Set'}`);
  console.log(`🌐 Test endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Bot Analysis: http://localhost:${PORT}/api/bot-analysis/tal`);
  console.log(`   Bot Analysis: http://localhost:${PORT}/api/bot-analysis/fischer`);
});


