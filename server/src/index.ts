import express from 'express'
import cors from 'cors'
import { ChessEngine, Position } from './ChessEngine'
import { supabase, Move } from './supabase'
import { generateRoomCode } from './utils'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Store active games in memory for move validation
const activeGames = new Map<string, ChessEngine>()

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    let code: string
    let attempts = 0
    const maxAttempts = 10

    // Generate unique room code
    do {
      code = generateRoomCode()
      attempts++
      
      if (attempts > maxAttempts) {
        return res.status(500).json({ error: 'Failed to generate unique room code' })
      }

      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('code')
        .eq('code', code)
        .single()

      if (!existingRoom) break
    } while (true)

    // Create room in database
    const { error } = await supabase
      .from('rooms')
      .insert({ code })

    if (error) {
      console.error('Error creating room:', error)
      return res.status(500).json({ error: 'Failed to create room' })
    }

    // Initialize chess game for this room
    activeGames.set(code, new ChessEngine())

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

    const { data: room } = await supabase
      .from('rooms')
      .select('code')
      .eq('code', code)
      .single()

    if (room) {
      // Initialize chess game if not already present
      if (!activeGames.has(code)) {
        const engine = new ChessEngine()
        
        // Load existing moves
        const { data: moves } = await supabase
          .from('moves')
          .select('*')
          .eq('room_code', code)
          .order('move_number', { ascending: true })

        if (moves) {
          moves.forEach((move: Move) => {
            const from: Position = {
              row: 8 - parseInt(move.from_sq[1]),
              col: move.from_sq.charCodeAt(0) - 'a'.charCodeAt(0)
            }
            const to: Position = {
              row: 8 - parseInt(move.to_sq[1]),
              col: move.to_sq.charCodeAt(0) - 'a'.charCodeAt(0)
            }
            engine.makeMove(from, to, move.promotion as any)
          })
        }
        
        activeGames.set(code, engine)
      }
    }

    res.json({ exists: !!room })
  } catch (error) {
    console.error('Error in GET /api/rooms/:code:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to convert algebraic notation to Position
function algebraicToPosition(square: string): Position {
  return {
    row: 8 - parseInt(square[1]),
    col: square.charCodeAt(0) - 'a'.charCodeAt(0)
  }
}

// Helper function to convert Position to algebraic notation
function positionToAlgebraic(pos: Position): string {
  return String.fromCharCode('a'.charCodeAt(0) + pos.col) + (8 - pos.row)
}

// Make a move
app.post('/api/moves', async (req, res) => {
  try {
    const { room_code, from, to, promotion, player_id } = req.body

    if (!room_code || !from || !to || !player_id) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get room info to determine who is white (room creator)
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', room_code)
      .single()

    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' })
    }

    // Get chess game instance
    let engine = activeGames.get(room_code)
    if (!engine) {
      // Initialize if not found
      engine = new ChessEngine()
      
      // Load existing moves
      const { data: moves } = await supabase
        .from('moves')
        .select('*')
        .eq('room_code', room_code)
        .order('move_number', { ascending: true })

      if (moves) {
        moves.forEach((move: Move) => {
          const fromPos = algebraicToPosition(move.from_sq)
          const toPos = algebraicToPosition(move.to_sq)
          engine!.makeMove(fromPos, toPos, move.promotion as any)
        })
      }
      
      activeGames.set(room_code, engine)
    }

    // Get game state to check whose turn it is
    const gameState1 = engine.getGameState()
    const currentTurn = gameState1.activeColor // 'w' for white, 'b' for black
    
    // Determine if player is room creator (white) or joiner (black)
    const isRoomCreator = player_id === 'creator'
    const playerColor = isRoomCreator ? 'w' : 'b'
    
    // Check if it's the player's turn
    if (currentTurn !== playerColor) {
      return res.status(400).json({ 
        success: false, 
        error: currentTurn === 'w' ? 'It is white\'s turn' : 'It is black\'s turn'
      })
    }

    // Additional check: Black cannot move until white has moved at least once
    if (playerColor === 'b' && gameState1.moveHistory.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'White must make the first move'
      })
    }

    // Convert algebraic notation to positions
    const fromPos = algebraicToPosition(from)
    const toPos = algebraicToPosition(to)

    // Get piece before move for storage
    const board = engine.getBoard()
    const piece = board[fromPos.row][fromPos.col]

    if (!piece) {
      return res.status(400).json({ 
        success: false, 
        error: 'No piece at source square' 
      })
    }

    // Additional validation: ensure player is moving their own pieces
    const [pieceColor] = piece
    if (pieceColor !== playerColor) {
      return res.status(400).json({ 
        success: false, 
        error: 'You can only move your own pieces'
      })
    }

    // Validate and make move
    const move = engine.makeMove(fromPos, toPos, promotion)

    if (!move) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid move' 
      })
    }

    // Get current move number
    const gameState2 = engine.getGameState()
    const moveNumber = gameState2.moveHistory.length

    // Store move in database
    const { error } = await supabase
      .from('moves')
      .insert({
        room_code,
        move_number: moveNumber,
        from_sq: from,
        to_sq: to,
        piece,
        promotion: promotion || null,
        san: null // We can generate SAN later if needed
      })

    if (error) {
      console.error('Error storing move:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to store move' 
      })
    }

    // Check game status
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
        moveNumber,
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

// Get valid moves for a piece
app.post('/api/rooms/:code/valid-moves', async (req, res) => {
  try {
    const { code } = req.params
    const { square, player_id } = req.body

    if (!square || !player_id) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get chess game instance
    let engine = activeGames.get(code)
    if (!engine) {
      // Initialize if not found
      engine = new ChessEngine()
      
      // Load existing moves
      const { data: moves } = await supabase
        .from('moves')
        .select('*')
        .eq('room_code', code)
        .order('move_number', { ascending: true })

      if (moves) {
        moves.forEach((move: Move) => {
          const fromPos = algebraicToPosition(move.from_sq)
          const toPos = algebraicToPosition(move.to_sq)
          engine!.makeMove(fromPos, toPos, move.promotion as any)
        })
      }
      
      activeGames.set(code, engine)
    }

    // Get game state to check whose turn it is
    const gameState = engine.getGameState()
    const currentTurn = gameState.activeColor
    
    // Determine if player is room creator (white) or joiner (black)
    const isRoomCreator = player_id === 'creator'
    const playerColor = isRoomCreator ? 'w' : 'b'
    
    // Only show valid moves if it's the player's turn
    if (currentTurn !== playerColor) {
      return res.json({ validMoves: [] })
    }

    // Additional check: Black cannot see moves until white has moved
    if (playerColor === 'b' && gameState.moveHistory.length === 0) {
      return res.json({ validMoves: [] })
    }

    const fromPos = algebraicToPosition(square)
    const validMoves = engine.getValidMovesForPiece(fromPos)
    
    // Convert positions back to algebraic notation
    const validSquares = validMoves.map(pos => positionToAlgebraic(pos))

    res.json({ validMoves: validSquares })
  } catch (error) {
    console.error('Error getting valid moves:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current game state
app.get('/api/rooms/:code/state', async (req, res) => {
  try {
    const { code } = req.params

    const engine = activeGames.get(code)
    if (!engine) {
      return res.status(404).json({ error: 'Room not found' })
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

    res.json({
      fen,
      activeColor: engine.getActiveColor(),
      gameStatus: status,
      moveCount: gameState.moveHistory.length
    })
  } catch (error) {
    console.error('Error in GET /api/rooms/:code/state:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
