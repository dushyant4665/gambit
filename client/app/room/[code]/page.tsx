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
  const [showPlayerJoinedPopup, setShowPlayerJoinedPopup] = useState(false)
  const [hasShownJoinPopup, setHasShownJoinPopup] = useState(false)
  const [showGameOverPopup, setShowGameOverPopup] = useState(false)
  const [gameOverData, setGameOverData] = useState<{type: 'checkmate' | 'stalemate' | 'draw', winner?: string}>({type: 'checkmate'})
  const [player1Name, setPlayer1Name] = useState('Player 1')
  const [player2Name, setPlayer2Name] = useState('Player 2')

  // Poll for updates every 200ms for instant updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadGameState()
    }, 200)
    
    return () => clearInterval(interval)
  }, [roomCode])


  // Join room function
  const joinRoom = async (playerId: string) => {
    try {
      const playerName = localStorage.getItem(`player_name_${roomCode}`) || ''
      console.log(`Joining room with name: ${playerName}`)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, player_name: playerName }),
      })
      const result = await response.json()
      if (result.success) {
        console.log(`Joined room as ${playerId}, player count: ${result.playerCount}`)
        // Force immediate name and state updates after joining
        setTimeout(() => loadGameState(), 50)
        setTimeout(() => loadGameState(), 150)
        setTimeout(() => loadGameState(), 300)
        setTimeout(() => loadGameState(), 500)
        setTimeout(() => loadGameState(), 1000)
      }
    } catch (error) {
      console.error('Error joining room:', error)
    }
  }

  // Load game state
  const loadGameState = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode}/state`)
      if (response.ok) {
        const { fen, activeColor: color, gameStatus: status, moveCount, playerCount: serverPlayerCount, playerNames } = await response.json()
        console.log(`Game state loaded: activeColor=${color}, moveCount=${moveCount}, playerCount=${serverPlayerCount}`)
        
        // Always update player names from server - force update every time
        console.log('Updating player names:', playerNames)
        if (playerNames?.white) setPlayer1Name(playerNames.white)
        if (playerNames?.black) setPlayer2Name(playerNames.black)
        
        // Always update game state
        setGamePosition(fen)
        setActiveColor(color)
        
        // Handle game over states
        if (status === 'checkmate' && !showGameOverPopup) {
          const winnerName = color === 'w' ? (playerNames?.black || player2Name) : (playerNames?.white || player1Name) // Winner is opposite of current turn
          setGameStatus(`Checkmate! ${winnerName} wins!`)
          setGameOverData({type: 'checkmate', winner: winnerName})
          setShowGameOverPopup(true)
        } else if (status === 'stalemate' && !showGameOverPopup) {
          setGameStatus('Stalemate! Draw!')
          setGameOverData({type: 'stalemate'})
          setShowGameOverPopup(true)
        } else if (status === 'draw' && !showGameOverPopup) {
          setGameStatus('Draw!')
          setGameOverData({type: 'draw'})
          setShowGameOverPopup(true)
        } else if (status === 'ongoing') {
          const currentPlayerName = color === 'w' ? player1Name : player2Name
          setGameStatus(`${currentPlayerName}'s turn`)
          
          // If white's turn and only 1 player, wait for player 2
          if (color === 'w' && serverPlayerCount < 2) {
            setGameStatus('Waiting for Player 2...')
          }
        }
        
        // Clear selection when it's not player's turn
        const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
        const isCreator = createdRooms.includes(roomCode)
        const isWhiteTurn = color === 'w'
        const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn) && serverPlayerCount >= 2
        
        console.log(`Turn check: isCreator=${isCreator}, isWhiteTurn=${isWhiteTurn}, canMove=${canMove}, serverPlayerCount=${serverPlayerCount}`)
        
        if (!canMove) {
          setSelectedSquare(null)
          setValidMoves([])
        }
        
        // Update player count only if changed
        if (serverPlayerCount !== playerCount) {
          setPlayerCount(serverPlayerCount)
          
          // Show popup only once when player2 joins
          const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
          const isCreator = createdRooms.includes(roomCode)
          const popupShown = localStorage.getItem(`popup_shown_${roomCode}`) === 'true'
          
          if (isCreator && playerCount === 1 && serverPlayerCount === 2 && !popupShown && !showGameOverPopup) {
            setShowPlayerJoinedPopup(true)
            localStorage.setItem(`popup_shown_${roomCode}`, 'true')
            setTimeout(() => setShowPlayerJoinedPopup(false), 3000)
            
            // Force reload after player 2 joins to refresh game state
            setTimeout(() => {
              loadGameState()
              loadGameState()
            }, 100)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load game state:', error)
    }
  }

  // Load existing moves on mount and force name updates
  useEffect(() => {
    loadGameState()
    // Force name updates after initial load
    setTimeout(() => loadGameState(), 500)
    setTimeout(() => loadGameState(), 1000)
  }, [roomCode])

  // Determine player color based on room creation timestamp
  useEffect(() => {
    const checkRoom = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode}`)
        const { exists } = await response.json()
        
        if (!exists) {
          setGameStatus('Room not found')
          return
        }

        // Use localStorage to track if this client created the room
        const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
        const isCreator = createdRooms.includes(roomCode)
        
        if (isCreator) {
          setPlayerColor('white') // Room creator is always white (player1)
          // Join room as creator
          await joinRoom('creator')
        } else {
          setPlayerColor('black') // Joiner is always black (player2)
          // Join room as joiner
          await joinRoom('joiner')
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
      // Determine player ID - room creator is player1 (white), joiner is player2 (black)
      const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
      const isCreator = createdRooms.includes(roomCode)
      const playerId = isCreator ? 'creator' : 'joiner'
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode}/valid-moves`, {
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

  // Handle piece selection and movement
  const onSquareClick = async (square: string) => {
    // Room creator is white (player1), joiner is black (player2)
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    if (playerCount < 2) return
    
    // Check if it's player's turn - white moves first
    const isWhiteTurn = activeColor === 'w'
    const canMove = isCreator ? isWhiteTurn : !isWhiteTurn
    
    console.log(`Click attempt: isCreator=${isCreator}, activeColor=${activeColor}, isWhiteTurn=${isWhiteTurn}, canMove=${canMove}`)
    
    if (!canMove) {
      console.log('Move blocked: not player\'s turn')
      return
    }

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

    // Select new piece and get its valid moves (only for player's own pieces)
    const moves = await getValidMoves(square)
    if (moves.length > 0) {
      setSelectedSquare(square)
      setValidMoves(moves)
    } else {
      // If no valid moves, deselect
      setSelectedSquare(null)
      setValidMoves([])
    }
  }

  // Handle piece hover - show hand cursor
  const onPieceHover = (piece: string, square: string) => {
    // Room creator is white (player1), joiner is black (player2)
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    if (!piece || playerCount < 2) return false
    
    // Check if it's player's turn and their piece - white moves first
    const isWhiteTurn = activeColor === 'w'
    const pieceColor = piece[0] === 'w' ? 'white' : 'black'
    
    // Player1 (creator) plays white, Player2 (joiner) plays black
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
      
      // Determine player ID - room creator is player1 (white), joiner is player2 (black)
      const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
      const isCreator = createdRooms.includes(roomCode)
      const playerId = isCreator ? 'creator' : 'joiner'
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: roomCode, from, to, player_id: playerId }),
      })
      const result = await response.json()
      
      if (result.success) {
        console.log('Move accepted by server!')
        // Force multiple state reloads to ensure sync
        await loadGameState()
        setTimeout(() => loadGameState(), 100)
        setTimeout(() => loadGameState(), 300)
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

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    // Room creator is white (player1), joiner is black (player2)
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    if (playerCount < 2) return false
    
    // Check if it's player's turn - white moves first
    const isWhiteTurn = activeColor === 'w'
    const canMove = isCreator ? isWhiteTurn : !isWhiteTurn
    
    if (!canMove) return false

    // Make the move asynchronously
    makeMove(sourceSquare, targetSquare).then(success => {
      if (success) {
        setSelectedSquare(null)
        setValidMoves([])
        // Force immediate state reload
        loadGameState()
      }
    })
    
    return true // Allow the visual move, validation happens server-side
  }, [activeColor, playerCount, roomCode])

  return (
    <main className="min-h-screen bg-dark-bg p-4">
      {/* Player Joined Popup */}
      {showPlayerJoinedPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-md mx-4 text-center">
            <div className="text-green-500 text-4xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-dark-text mb-2">Player 2 Connected!</h3>
            <p className="text-dark-text/70 mb-4">Your opponent has joined the game.</p>
            <p className="text-dark-accent font-semibold mb-4">You play as White - Make your first move!</p>
            <button 
              onClick={() => setShowPlayerJoinedPopup(false)}
              className="bg-dark-accent hover:bg-dark-accent/80 text-white px-4 py-2 rounded-lg font-medium"
            >
              Start Playing!
            </button>
          </div>
        </div>
      )}

      {/* Game Over Popup */}
      {showGameOverPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-8 max-w-md mx-4 text-center">
            {gameOverData.type === 'checkmate' && (
              <>
                <div className="text-6xl mb-4">👑</div>
                <h3 className="text-2xl font-bold text-dark-text mb-2">Checkmate!</h3>
                <p className="text-xl font-semibold text-dark-accent mb-4">{gameOverData.winner} Wins!</p>
                <p className="text-dark-text/70 mb-6">The game is over. {gameOverData.winner} has achieved checkmate!</p>
              </>
            )}
            {gameOverData.type === 'stalemate' && (
              <>
                <div className="text-6xl mb-4">🤝</div>
                <h3 className="text-2xl font-bold text-dark-text mb-2">Stalemate!</h3>
                <p className="text-xl font-semibold text-yellow-500 mb-4">It's a Draw!</p>
                <p className="text-dark-text/70 mb-6">No legal moves available. The game ends in a stalemate.</p>
              </>
            )}
            {gameOverData.type === 'draw' && (
              <>
                <div className="text-6xl mb-4">🤝</div>
                <h3 className="text-2xl font-bold text-dark-text mb-2">Draw!</h3>
                <p className="text-xl font-semibold text-yellow-500 mb-4">It's a Draw!</p>
                <p className="text-dark-text/70 mb-6">The game has ended in a draw.</p>
              </>
            )}
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowGameOverPopup(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Close
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-dark-accent hover:bg-dark-accent/80 text-white px-6 py-2 rounded-lg font-medium"
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* GitHub Icon - Responsive */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50">
        <a 
          href="https://github.com/dushyant4665/gambit" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-black hover:bg-gray-900 text-white p-2 sm:p-3 rounded-lg shadow-xl border border-gray-600 hover:border-white transition-all duration-300 hover:scale-105 flex items-center justify-center"
        >
          <svg width="20" height="20" className="sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>
      
      <div className="max-w-6xl mx-auto">
        {/* Header - Responsive */}
        <div className="text-center mb-4 sm:mb-6 px-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-text mb-2">Room: {roomCode}</h1>
          <p className="text-sm sm:text-base text-dark-text/70 mb-2">{gameStatus}</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mt-2">
            <p className="text-xs sm:text-sm text-dark-text/50">
              You are <span className="font-semibold text-dark-accent">Player {playerColor === 'white' ? '1 (White)' : '2 (Black)'}</span>
            </p>
            <div className="text-xs text-dark-text/40">
              {playerCount < 2 ? 'Waiting for Player 2...' : '2 players connected'}
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 lg:gap-6 items-center justify-center px-2">
          {/* Chess Board */}
          <div className="flex-shrink-0 w-full max-w-[500px]">
            {/* Player 2 (Black) - Top */}
            <div className="flex items-center justify-center mb-3 sm:mb-4 p-2 sm:p-3 bg-dark-surface rounded-lg border border-dark-border">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs sm:text-sm">♛</span>
                </div>
                <div>
                  <p className="text-dark-text font-semibold text-sm sm:text-base">{player2Name}</p>
                  <p className="text-dark-text/60 text-xs">Playing as Black</p>
                </div>
              </div>
            </div>
            <div className="w-full aspect-square max-w-[320px] sm:max-w-[400px] md:max-w-[500px] mx-auto">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation={playerColor === 'white' ? 'white' : 'black'}
                arePiecesDraggable={playerCount >= 2}
                isDraggablePiece={({ piece, sourceSquare }) => {
                  // Room creator is white (player1), joiner is black (player2)
                  const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
                  const isCreator = createdRooms.includes(roomCode)
                  
                  if (playerCount < 2) return false
                  
                  // Check if it's player's turn and their piece - white moves first
                  const isWhiteTurn = activeColor === 'w'
                  const pieceColor = piece[0] === 'w' ? 'white' : 'black'
                  
                  // Player1 (creator) plays white, Player2 (joiner) plays black
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
                    return {
                      ...acc,
                      [square]: {
                        background: 'radial-gradient(circle, rgba(0,255,0,0.7) 25%, transparent 25%)',
                        cursor: 'pointer'
                      }
                    }
                  }, {})
                }}
                areArrowsAllowed={false}
                showBoardNotation={true}
                animationDuration={0}
                snapToCursor={true}
              />
            </div>
            
            {/* Player 1 (White) - Bottom */}
            <div className="flex items-center justify-center mt-3 sm:mt-4 p-2 sm:p-3 bg-dark-surface rounded-lg border border-dark-border">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-black text-xs sm:text-sm">♔</span>
                </div>
                <div>
                  <p className="text-dark-text font-semibold text-sm sm:text-base">{player1Name}</p>
                  <p className="text-dark-text/60 text-xs">Playing as White</p>
                </div>
              </div>
            </div>
          </div>

          {/* Moves Panel - Responsive */}
          <div className="w-full xl:w-80 bg-dark-surface rounded-lg p-3 sm:p-4 border border-dark-border mt-4 xl:mt-0">
            <h3 className="text-base sm:text-lg font-semibold text-dark-text mb-3 sm:mb-4">Moves</h3>
            <div className="max-h-60 sm:max-h-80 overflow-y-auto">
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
