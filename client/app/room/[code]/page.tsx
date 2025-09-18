'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
// import { supabase, Move } from '../../../lib/supabase' - removed for test mode
// import { api } from '../../../lib/api' - using direct fetch

// Helper function to convert custom engine board to FEN-like position
function boardToFEN(boardData: any): string {
  if (typeof boardData === 'string') return boardData
  
  // If we get board array data, convert to FEN
  // For now, return starting position - this would need proper conversion
  return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
}

export default function RoomPage() {
  const params = useParams()
  const roomCode = params.code as string
  
  const [gamePosition, setGamePosition] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [moves, setMoves] = useState<any[]>([])
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [gameStatus, setGameStatus] = useState<string>('Waiting for Player 2...')
  const [playerCount, setPlayerCount] = useState(1)
  const [activeColor, setActiveColor] = useState<'w' | 'b'>('w')
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [validMoves, setValidMoves] = useState<string[]>([])

  // Poll for updates every 500ms for real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      loadGameState()
    }, 500)
    
    return () => clearInterval(interval)
  }, [roomCode])

  // Load game state
  const loadGameState = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/rooms/${roomCode}/state`)
      if (response.ok) {
        const { fen, activeColor: color, gameStatus: status, moveCount } = await response.json()
        
        // Update game position and clear selection if game state changed
        if (gamePosition !== fen) {
          setGamePosition(fen)
          setSelectedSquare(null)
          setValidMoves([])
        }
        
        setActiveColor(color)
        setGameStatus(status === 'ongoing' ? `${color === 'w' ? 'White' : 'Black'} to move` : status)
        
        // Only update player count, NOT player color (color is set once on room join)
        if (moveCount > 0) {
          setPlayerCount(2)
        }
      }
    } catch (error) {
      console.error('Failed to load game state:', error)
    }
  }

  // Load existing moves on mount
  useEffect(() => {
    loadGameState()
  }, [roomCode])

  // Determine player color based on room creation timestamp
  useEffect(() => {
    const checkRoom = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/rooms/${roomCode}`)
        const { exists } = await response.json()
        
        if (!exists) {
          setGameStatus('Room not found')
          return
        }

        // Use localStorage to track if this client created the room
        const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
        const isCreator = createdRooms.includes(roomCode)
        
        if (isCreator) {
          setPlayerColor('white') // Room creator is always white
          setPlayerCount(1)
        } else {
          setPlayerColor('black') // Joiner is always black
          setPlayerCount(2)
        }
      } catch (error) {
        setGameStatus('Error connecting to room')
      }
    }

    checkRoom()
  }, [roomCode])

  // Get valid moves for a piece
  const getValidMoves = async (square: string) => {
    try {
      // Determine player ID based on whether they created the room
      const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
      const isCreator = createdRooms.includes(roomCode)
      const playerId = isCreator ? 'creator' : 'joiner'
      
      const response = await fetch(`http://localhost:3001/api/rooms/${roomCode}/valid-moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ square, player_id: playerId }),
      })
      const result = await response.json()
      return result.validMoves || []
    } catch (error) {
      console.error('Error getting valid moves:', error)
      return []
    }
  }

  // Handle piece double click/selection
  const onSquareClick = async (square: string) => {
    // Room creator gets first turn (white pieces)
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    if (playerCount < 2) return
    
    // Check if it's player's turn
    const isWhiteTurn = activeColor === 'w'
    const canMove = isCreator ? isWhiteTurn : !isWhiteTurn
    
    if (!canMove) return

    // If clicking on selected square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null)
      setValidMoves([])
      return
    }

    // If we have a selected piece and clicked on valid move square
    if (selectedSquare && validMoves.includes(square)) {
      await makeMove(selectedSquare, square)
      setSelectedSquare(null)
      setValidMoves([])
      return
    }

    // Select new piece and get its valid moves
    const moves = await getValidMoves(square)
    if (moves.length > 0) {
      setSelectedSquare(square)
      setValidMoves(moves)
    } else {
      setSelectedSquare(null)
      setValidMoves([])
    }
  }

  // Handle piece hover - show hand cursor
  const onPieceHover = (piece: string, square: string) => {
    // Room creator gets first turn (white pieces)
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    if (!piece || playerCount < 2) return false
    
    // Check if it's player's turn and their piece
    const isWhiteTurn = activeColor === 'w'
    const pieceColor = piece[0] === 'w' ? 'white' : 'black'
    
    // Room creator (white) can hover on white pieces when it's white's turn
    // Joiner (black) can hover on black pieces when it's black's turn
    if (isCreator) {
      return isWhiteTurn && pieceColor === 'white'
    } else {
      return !isWhiteTurn && pieceColor === 'black'
    }
  }

  // Make a move
  const makeMove = async (from: string, to: string) => {
    try {
      console.log(`Move attempt: ${from} to ${to}`)
      
      // Determine player ID based on whether they created the room
      const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
      const isCreator = createdRooms.includes(roomCode)
      const playerId = isCreator ? 'creator' : 'joiner'
      
      const response = await fetch(`http://localhost:3001/api/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: roomCode, from, to, promotion: 'q', player_id: playerId }),
      })
      const result = await response.json()
      
      if (result.success) {
        console.log('Move accepted by server!')
        // Update local state
        if (result.move?.fen) {
          setGamePosition(result.move.fen)
        }
        if (result.move?.activeColor) {
          setActiveColor(result.move.activeColor)
        }
        if (result.move?.gameStatus) {
          const status = result.move.gameStatus
          if (status === 'checkmate') {
            setGameStatus(`Checkmate! ${result.move.activeColor === 'b' ? 'White' : 'Black'} wins!`)
          } else if (status === 'stalemate') {
            setGameStatus('Stalemate!')
          } else if (status === 'draw') {
            setGameStatus('Draw!')
          } else if (status === 'check') {
            setGameStatus(`Check! ${result.move.activeColor === 'w' ? 'White' : 'Black'} to move`)
          } else {
            setGameStatus(`${result.move.activeColor === 'w' ? 'White' : 'Black'} to move`)
          }
        }
        return true
      } else {
        console.error('Move rejected by server:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error making move:', error)
      return false
    }
  }

  const onDrop = useCallback(async (sourceSquare: string, targetSquare: string) => {
    // Room creator gets first turn (white pieces)
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    if (playerCount < 2) return false
    
    // Check if it's player's turn
    const isWhiteTurn = activeColor === 'w'
    const canMove = isCreator ? isWhiteTurn : !isWhiteTurn
    
    if (!canMove) return false

    const success = await makeMove(sourceSquare, targetSquare)
    if (success) {
      setSelectedSquare(null)
      setValidMoves([])
    }
    return success
  }, [activeColor, playerCount, roomCode])

  return (
    <main className="min-h-screen bg-dark-bg p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-dark-text mb-2">Room: {roomCode}</h1>
          <p className="text-dark-text/70">{gameStatus}</p>
          <div className="flex justify-center items-center gap-4 mt-2">
            <p className="text-sm text-dark-text/50">
              You are playing as <span className="font-semibold text-dark-accent">{playerColor}</span>
            </p>
            <div className="text-xs text-dark-text/40">
              {playerCount < 2 ? 'Waiting for opponent...' : '2 players connected'}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Chess Board */}
          <div className="flex-shrink-0">
            <div className="w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation={playerColor}
                arePiecesDraggable={playerCount >= 2}
                isDraggablePiece={({ piece, sourceSquare }) => {
                  // Room creator gets first turn (white pieces)
                  const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
                  const isCreator = createdRooms.includes(roomCode)
                  
                  if (playerCount < 2) return false
                  
                  // Check if it's player's turn and their piece
                  const isWhiteTurn = activeColor === 'w'
                  const pieceColor = piece[0] === 'w' ? 'white' : 'black'
                  
                  if (isCreator) {
                    return isWhiteTurn && pieceColor === 'white'
                  } else {
                    return !isWhiteTurn && pieceColor === 'black'
                  }
                }}
                customDarkSquareStyle={{ backgroundColor: '#8b4513' }}
                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
                customSquareStyles={{
                  ...(selectedSquare && {
                    [selectedSquare]: {
                      backgroundColor: 'rgba(255, 255, 0, 0.6)',
                      boxShadow: 'inset 0 0 0 3px rgba(255, 255, 0, 0.8)'
                    }
                  }),
                  ...validMoves.reduce((acc, square) => {
                    // Check if square has piece (for capture moves)
                    const squareHasPiece = gamePosition.includes(square)
                    return {
                      ...acc,
                      [square]: squareHasPiece ? {
                        boxShadow: 'inset 0 0 0 4px rgba(255, 0, 0, 0.8)',
                        cursor: 'pointer'
                      } : {
                        background: 'radial-gradient(circle, rgba(0,255,0,0.7) 25%, transparent 25%)',
                        cursor: 'pointer'
                      }
                    }
                  }, {})
                }}
                customPieces={Object.keys(gamePosition.split(' ')[0].replace(/[/1-8]/g, '')).reduce((pieces, _) => pieces, {})}
                areArrowsAllowed={false}
                showBoardNotation={true}
              />
            </div>
            
          </div>

          {/* Moves Panel */}
          <div className="w-full lg:w-80 bg-dark-surface rounded-lg p-4 border border-dark-border">
            <h3 className="text-lg font-semibold text-dark-text mb-4">Moves</h3>
            <div className="max-h-80 overflow-y-auto">
              {moves.length === 0 ? (
                <p className="text-dark-text/50 text-sm">No moves yet</p>
              ) : (
                <div className="space-y-1">
                  {moves.map((move, index) => (
                    <div key={move.id} className="flex items-center text-sm">
                      <span className="text-dark-text/50 w-8">
                        {Math.ceil((index + 1) / 2)}.
                      </span>
                      <span className="text-dark-text font-mono">
                        {move.san}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
