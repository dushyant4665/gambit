require('dotenv').config()
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import { ChessEngine } from './ChessEngine'

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.CLIENT_URL || 'https://gambitt.vercel.app']
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const activeGames = new Map<string, ChessEngine>()
const roomConnections = new Map<string, Set<string>>()
const socketRooms = new Map<string, string>()

app.use(express.json())
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CLIENT_URL || 'https://gambitt.vercel.app']
    : ['http://localhost:3000'],
  credentials: true
}))

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function algebraicToPosition(square: string) {
  const file = square.charCodeAt(0) - 97
  const rank = parseInt(square[1]) - 1
  return { row: 7 - rank, col: file }
}

function positionToAlgebraic(row: number, col: number): string {
  const file = String.fromCharCode(97 + col)
  const rank = (8 - row).toString()
  return file + rank
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  socket.on('join-room', async (data) => {
    const { roomCode, playerName, isCreator } = data

    try {

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()

      if (roomError || !room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }

      socket.join(roomCode)
      socketRooms.set(socket.id, roomCode)

      if (!roomConnections.has(roomCode)) {
        roomConnections.set(roomCode, new Set())
      }
      roomConnections.get(roomCode)!.add(socket.id)

      const updateData: any = {}

      if (isCreator && !room.white_assigned) {
        updateData.white_socket_id = socket.id
        updateData.white_assigned = true
        updateData.white_player_name = playerName
      } else if (!isCreator && !room.black_assigned) {
        updateData.black_socket_id = socket.id
        updateData.black_assigned = true
        updateData.black_player_name = playerName
        updateData.status = 'playing'
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('rooms')
          .update(updateData)
          .eq('id', room.id)
      }

      let engine = activeGames.get(roomCode)
      if (!engine) {
        engine = new ChessEngine()

        const { data: moves } = await supabase
          .from('moves')
          .select('*')
          .eq('room_id', room.id)
          .order('move_number', { ascending: true })

        if (moves && moves.length > 0) {
          moves.forEach((move: any) => {
            const fromPos = algebraicToPosition(move.from_square)
            const toPos = algebraicToPosition(move.to_square)
            engine!.makeMove(fromPos, toPos, move.promotion)
          })
        }

        activeGames.set(roomCode, engine)
      }

      const gameState = engine.getGameState()
      socket.emit('game-state', {
        roomCode,
        fen: engine.exportFEN(),
        activeColor: gameState.activeColor,
        gameStatus: engine.isCheckmate() ? 'checkmate' : 
                   engine.isStalemate() ? 'stalemate' : 
                   engine.isCheck() ? 'check' : 'ongoing',
        moveCount: gameState.moveHistory.length,
        playerNames: {
          white: room.white_player_name || 'Player 1',
          black: room.black_player_name || 'Player 2'
        },
        playerCount: (room.white_assigned ? 1 : 0) + (room.black_assigned ? 1 : 0),
        gameStarted: room.status === 'playing'
      })

      if (updateData.status === 'playing') {
        const updatedRoom = { ...room, ...updateData }

        console.log(`🚀 EMITTING ROOM:STARTED for room ${roomCode}`)

        io.to(roomCode).emit('room:started', {
          roomCode,
          whiteId: updatedRoom.white_socket_id,
          blackId: updatedRoom.black_socket_id,
          fen: engine.exportFEN(),
          turn: gameState.activeColor,
          playerNames: {
            white: updatedRoom.white_player_name,
            black: updatedRoom.black_player_name
          }
        })

        console.log(`✅ Room started event sent. White (${updatedRoom.white_player_name}) to move first.`)
      }

      console.log(`Player ${isCreator ? 'creator' : 'joiner'} joined room ${roomCode}`)

    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  })

  socket.on('make-move', async (data) => {
    const { roomCode, from, to, promotion } = data
    const currentRoom = socketRooms.get(socket.id)

    if (currentRoom !== roomCode) {
      socket.emit('move-error', { error: 'Not in this room' })
      return
    }

    try {

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()

      if (roomError || !room || room.status !== 'playing') {
        socket.emit('move-error', { error: 'Game not active' })
        return
      }

      const isWhite = socket.id === room.white_socket_id
      const playerColor = isWhite ? 'w' : 'b'

      let engine = activeGames.get(roomCode)
      if (!engine) {
        socket.emit('move-error', { error: 'Game engine not found' })
        return
      }

      const gameState = engine.getGameState()

      console.log(`🎯 Move validation: activeColor=${gameState.activeColor}, playerColor=${playerColor}, isWhite=${isWhite}`)

      if (gameState.activeColor !== playerColor) {
        console.log(`❌ Turn validation failed: expected ${playerColor}, got ${gameState.activeColor}`)
        socket.emit('move-error', { 
          error: `It's ${gameState.activeColor === 'w' ? 'white' : 'black'}'s turn` 
        })
        return
      }

      console.log(`✅ Turn validation passed: ${playerColor} to move`)

      const nextMoveNumber = gameState.moveHistory.length + 1
      const { data: existingMove } = await supabase
        .from('moves')
        .select('id')
        .eq('room_id', room.id)
        .eq('move_number', nextMoveNumber)
        .eq('from_square', from)
        .eq('to_square', to)
        .maybeSingle()

      if (existingMove) {
        console.log('❌ Duplicate move detected')
        socket.emit('move-error', { error: 'Move already processed' })
        return
      }

      const fromPos = algebraicToPosition(from)
      const toPos = algebraicToPosition(to)

      const board = engine.getBoard()
      const piece = board[fromPos.row][fromPos.col]

      if (!piece || piece[0] !== playerColor) {
        socket.emit('move-error', { error: 'Invalid piece selection' })
        return
      }

      const moveObj = engine.makeMove(fromPos, toPos, promotion)
      if (!moveObj) {
        socket.emit('move-error', { error: 'Invalid move' })
        return
      }

      const finalMoveNumber = gameState.moveHistory.length + 1
      const newGameState = engine.getGameState()

      const { data: savedMove, error: moveError } = await supabase
        .from('moves')
        .insert({
          room_id: room.id,
          move_number: finalMoveNumber,
          color: playerColor,
          from_square: from,
          to_square: to,
          piece: piece,
          captured_piece: null,
          promotion: promotion || null,
          san: `${from}-${to}`,
          is_check: engine.isCheck(),
          is_checkmate: engine.isCheckmate(),
          is_stalemate: engine.isStalemate(),
          fen_after: engine.exportFEN()
        })
        .select()
        .single()

      if (moveError || !savedMove) {

        console.error('Failed to save move:', moveError)
        socket.emit('move-error', { error: 'Failed to save move' })
        return
      }

      const updateData: any = {
        current_fen: engine.exportFEN(),
        current_turn: newGameState.activeColor
      }

      if (engine.isCheckmate() || engine.isStalemate()) {
        updateData.status = 'finished'
        updateData.winner = engine.isCheckmate() 
          ? (newGameState.activeColor === 'w' ? 'b' : 'w') 
          : 'd'
      }

      const { error: updateError } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', room.id)

      if (updateError) {
        console.error('Failed to update room:', updateError)
        socket.emit('move-error', { error: 'Failed to update game state' })
        return
      }

      console.log(`✅ Room updated: turn=${newGameState.activeColor}, status=${updateData.status || 'playing'}`)

      io.to(roomCode).emit('move:confirmed', {
        moveId: savedMove.id,
        from,
        to,
        san: savedMove.san,
        color: playerColor,
        moveNumber: finalMoveNumber,
        fen: engine.exportFEN(),
        activeColor: newGameState.activeColor,
        isCheck: engine.isCheck(),
        isCheckmate: engine.isCheckmate(),
        isStalemate: engine.isStalemate(),
        gameStatus: engine.isCheckmate() ? 'checkmate' : 
                   engine.isStalemate() ? 'stalemate' : 
                   engine.isCheck() ? 'check' : 'ongoing',
        createdAt: savedMove.created_at
      })

      console.log(`Move confirmed: ${from} to ${to} in room ${roomCode}`)

    } catch (error) {
      console.error('Error making move:', error)
      socket.emit('move-error', { error: 'Server error' })
    }
  })

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`)

    const roomCode = socketRooms.get(socket.id)
    if (roomCode) {
      const connections = roomConnections.get(roomCode)
      if (connections) {
        connections.delete(socket.id)
        if (connections.size === 0) {
          roomConnections.delete(roomCode)

        }
      }
      socketRooms.delete(socket.id)
    }
  })
})

app.post('/api/rooms', async (req, res) => {
  try {
    const { player_name } = req.body
    const code = generateRoomCode()

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        code: code,
        status: 'waiting',
        white_player_name: player_name,
        white_assigned: false,
        black_assigned: false,
        current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        current_turn: 'w'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating room:', error)
      return res.status(500).json({ error: 'Failed to create room' })
    }

    res.json({ success: true, code, room_id: room.id })
  } catch (error) {
    console.error('Error creating room:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/rooms/:code', async (req, res) => {
  try {
    const { code } = req.params

    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !room) {
      return res.status(404).json({ error: 'Room not found' })
    }

    res.json({ 
      success: true, 
      room: {
        code: room.code,
        status: room.status,
        playerCount: (room.white_assigned ? 1 : 0) + (room.black_assigned ? 1 : 0),
        gameStarted: room.status === 'playing'
      }
    })
  } catch (error) {
    console.error('Error getting room:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})