import express from 'express'
import cors from 'cors'
import { ChessEngine, Position } from './ChessEngine'
import { generateRoomCode } from './utils'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CLIENT_URL || 'https://your-frontend-domain.vercel.app']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}))
app.use(express.json())

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// Store active games and moves in memory for testing
const activeGames = new Map<string, ChessEngine>()
const roomMoves = new Map<string, any[]>()
const rooms = new Set<string>()
const roomPlayers = new Map<string, Set<string>>()
const roomPlayerNames = new Map<string, {creator?: string, joiner?: string}>()

// Helper functions
function algebraicToPosition(square: string): Position {
  return {
    row: 8 - parseInt(square[1]),
    col: square.charCodeAt(0) - 'a'.charCodeAt(0)
  }
}

function positionToAlgebraic(pos: Position): string {
  return String.fromCharCode('a'.charCodeAt(0) + pos.col) + (8 - pos.row)
}

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    let code: string
    let attempts = 0
    const maxAttempts = 10

    do {
      code = generateRoomCode()
      attempts++
      
      if (attempts > maxAttempts) {
        return res.status(500).json({ error: 'Failed to generate unique room code' })
      }
    } while (rooms.has(code))

    // Create room
    rooms.add(code)
    activeGames.set(code, new ChessEngine())
    roomMoves.set(code, [])
    roomPlayers.set(code, new Set())
    roomPlayerNames.set(code, {})

    res.json({ code })
  } catch (error) {
    console.error('Error in POST /api/rooms:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Check if room exists
app.get('/api/rooms/:code', async (req, res) => {
  try {
    const { code } = req.params
    const exists = rooms.has(code)

    if (exists && !activeGames.has(code)) {
      const engine = new ChessEngine()
      const moves = roomMoves.get(code) || []
      
      moves.forEach((move: any) => {
        const fromPos = algebraicToPosition(move.from_sq)
        const toPos = algebraicToPosition(move.to_sq)
        engine.makeMove(fromPos, toPos, move.promotion)
      })
      
      activeGames.set(code, engine)
    }

    res.json({ exists })
  } catch (error) {
    console.error('Error in GET /api/rooms/:code:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Join a room
app.post('/api/rooms/:code/join', async (req, res) => {
  try {
    const { code } = req.params
    const { player_id, player_name } = req.body

    if (!rooms.has(code)) {
      return res.status(404).json({ error: 'Room not found' })
    }

    if (!player_id) {
      return res.status(400).json({ error: 'Player ID required' })
    }

    // Add player to room
    const players = roomPlayers.get(code) || new Set()
    players.add(player_id)
    roomPlayers.set(code, players)

    // Store player name - always update
    const names = roomPlayerNames.get(code) || {}
    if (player_id === 'creator') {
      names.creator = player_name || 'Player 1'
    } else {
      names.joiner = player_name || 'Player 2'  
    }
    roomPlayerNames.set(code, names)
    console.log(`Updated names for room ${code}:`, names)

    res.json({ 
      success: true, 
      playerCount: players.size 
    })
  } catch (error) {
    console.error('Error in POST /api/rooms/:code/join:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Make a move
app.post('/api/moves', async (req, res) => {
  try {
    const { room_code, from, to, promotion, player_id } = req.body

    if (!room_code || !from || !to || !player_id) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!rooms.has(room_code)) {
      return res.status(404).json({ error: 'Room not found' })
    }

    let engine = activeGames.get(room_code)
    if (!engine) {
      engine = new ChessEngine()
      const moves = roomMoves.get(room_code) || []
      
      moves.forEach((move: any) => {
        const fromPos = algebraicToPosition(move.from_sq)
        const toPos = algebraicToPosition(move.to_sq)
        engine!.makeMove(fromPos, toPos, move.promotion)
      })
      
      activeGames.set(room_code, engine)
    }

    // Get game state to check whose turn it is
    const gameState = engine.getGameState()
    const currentTurn = gameState.activeColor // 'w' for white, 'b' for black
    
    // Determine if player is room creator (white) or joiner (black)
    const isRoomCreator = player_id === 'creator'
    const playerColor = isRoomCreator ? 'w' : 'b'
    
    // Check if it's the player's turn
    console.log(`Move request: player=${player_id}, playerColor=${playerColor}, currentTurn=${currentTurn}, moveCount=${gameState.moveHistory.length}`)
    
    // Skip turn validation if game is over
    if (!engine.isGameOver() && currentTurn !== playerColor) {
      console.log(`Turn validation failed: expected ${playerColor}, got ${currentTurn}`)
      return res.status(400).json({ 
        success: false, 
        error: currentTurn === 'w' ? 'It is white\'s turn' : 'It is black\'s turn'
      })
    }

    const fromPos = algebraicToPosition(from)
    const toPos = algebraicToPosition(to)

    const board = engine.getBoard()
    const piece = board[fromPos.row][fromPos.col]

    if (!piece) {
      return res.status(400).json({ 
        success: false, 
        error: 'No piece at source square' 
      })
    }

    // Check if player is trying to move their own piece
    if (piece[0] !== playerColor) {
      return res.status(400).json({ 
        success: false, 
        error: 'You can only move your own pieces' 
      })
    }

    const move = engine.makeMove(fromPos, toPos, promotion)

    if (!move) {
      console.log(`Invalid move: ${from} to ${to}`)
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid move' 
      })
    }
    
    console.log(`Move successful: ${from} to ${to}, new active color: ${engine.getActiveColor()}`)

    // Store move in memory
    const moves = roomMoves.get(room_code) || []
    const moveData = {
      room_code,
      move_number: moves.length + 1,
      from_sq: from,
      to_sq: to,
      piece,
      promotion: promotion || null
    }
    moves.push(moveData)
    roomMoves.set(room_code, moves)

    let gameStatus = 'ongoing'
    if (engine.isCheckmate()) {
      gameStatus = 'checkmate'
    } else if (engine.isStalemate()) {
      gameStatus = 'stalemate'
    } else if (engine.isDraw()) {
      gameStatus = 'draw'
    } else if (engine.isCheck()) {
      gameStatus = 'check'
    }

    res.json({ 
      success: true, 
      move: {
        from,
        to,
        piece,
        promotion,
        moveNumber: moves.length,
        gameStatus,
        activeColor: engine.getActiveColor(),
        fen: engine.exportFEN()
      }
    })
  } catch (error) {
    console.error('Error in POST /api/moves:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Get current game state
app.get('/api/rooms/:code/state', async (req, res) => {
  try {
    const { code } = req.params

    if (!rooms.has(code)) {
      return res.status(404).json({ error: 'Room not found' })
    }

    const engine = activeGames.get(code)
    if (!engine) {
      // Room exists but no moves yet - return initial state
      const newEngine = new ChessEngine()
      activeGames.set(code, newEngine)
      
      const players = roomPlayers.get(code) || new Set()
      return res.json({
        fen: newEngine.exportFEN(),
        activeColor: newEngine.getActiveColor(),
        gameStatus: 'ongoing',
        moveCount: 0,
        playerCount: players.size
      })
    }

    const gameState = engine.getGameState()
    const fen = engine.exportFEN()
    
    let status = 'ongoing'
    if (engine.isCheckmate()) {
      status = 'checkmate'
    } else if (engine.isStalemate()) {
      status = 'stalemate'
    } else if (engine.isDraw()) {
      status = 'draw'
    } else if (engine.isCheck()) {
      status = 'check'
    }

    const players = roomPlayers.get(code) || new Set()
    const playerNames = roomPlayerNames.get(code) || {}
    const responseData = {
      fen,
      activeColor: engine.getActiveColor(),
      gameStatus: status,
      moveCount: gameState.moveHistory.length,
      playerCount: players.size,
      playerNames: {
        white: playerNames.creator || 'Player 1',
        black: playerNames.joiner || 'Player 2'
      }
    }
    console.log(`State request for room ${code}: activeColor=${responseData.activeColor}, moveCount=${responseData.moveCount}, names=${JSON.stringify(playerNames)}`)
    res.json(responseData)
  } catch (error) {
    console.error('Error in GET /api/rooms/:code/state:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get valid moves for a piece
app.post('/api/rooms/:code/valid-moves', async (req, res) => {
  try {
    const { code } = req.params
    const { square, player_id } = req.body

    if (!square || !player_id) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!rooms.has(code)) {
      return res.status(404).json({ error: 'Room not found' })
    }

    let engine = activeGames.get(code)
    if (!engine) {
      engine = new ChessEngine()
      const moves = roomMoves.get(code) || []
      
      moves.forEach((move: any) => {
        const fromPos = algebraicToPosition(move.from_sq)
        const toPos = algebraicToPosition(move.to_sq)
        engine!.makeMove(fromPos, toPos, move.promotion)
      })
      
      activeGames.set(code, engine)
    }

    // Get game state to check whose turn it is
    const gameState = engine.getGameState()
    const currentTurn = gameState.activeColor
    
    // Determine if player is room creator (white) or joiner (black)
    const isRoomCreator = player_id === 'creator'
    const playerColor = isRoomCreator ? 'w' : 'b'
    
    // Only show valid moves if it's the player's turn and game is not over
    if (!engine.isGameOver() && currentTurn !== playerColor) {
      return res.json({ validMoves: [] })
    }

    const fromPos = algebraicToPosition(square)
    const piece = engine.getBoard()[fromPos.row][fromPos.col]
    
    // Only show moves for player's own pieces
    if (!piece || piece[0] !== playerColor) {
      return res.json({ validMoves: [] })
    }
    
    const validMoves = engine.getValidMovesForPiece(fromPos)
    
    // Convert positions back to algebraic notation
    const validSquares = validMoves.map(pos => positionToAlgebraic(pos))

    res.json({ validMoves: validSquares })
  } catch (error) {
    console.error('Error getting valid moves:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Chess API is working!',
    rooms: Array.from(rooms),
    activeGames: Array.from(activeGames.keys())
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Chess Server running on port ${PORT}`)
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📋 Endpoints:`)
  console.log(`   GET  /health - Health check`)
  console.log(`   GET  /test - API status`)
  console.log(`   POST /api/rooms - Create room`)
  console.log(`   GET  /api/rooms/:code - Check room`)
  console.log(`   POST /api/rooms/:code/join - Join room`)
  console.log(`   GET  /api/rooms/:code/state - Get game state`)
  console.log(`   POST /api/moves - Make move`)
  console.log(`   POST /api/rooms/:code/valid-moves - Get valid moves`)
})
