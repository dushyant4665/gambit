'use client'

import { useState, useEffect, useCallback } from 'react'
import { socketManager } from '../../../lib/socket'
import { Chess } from 'chess.js'

interface GameState {
  position: string
  gameStarted: boolean
  gameStatus: 'waiting' | 'ongoing' | 'check' | 'checkmate' | 'stalemate' | 'draw'
  activeColor: 'w' | 'b'
  moveCount: number
  playerNames: {
    white: string
    black: string
  }
  playerCount: number
}

interface BotConfig {
  name: string
  description: string
  style: 'aggressive' | 'precise'
}

export function useAIBotChess(botType: 'tal' | 'fischer') {
  const [gameState, setGameState] = useState<GameState>({
    position: 'start',
    gameStarted: false,
    gameStatus: 'waiting',
    activeColor: 'w',
    moveCount: 0,
    playerNames: { white: 'You', black: botType === 'tal' ? 'Michael Tal' : 'Bobby Fischer' },
    playerCount: 2
  })
  
  const [connected, setConnected] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [chess] = useState(new Chess())
  const [roomCode, setRoomCode] = useState<string>('')

  const botConfig: BotConfig = {
    name: botType === 'tal' ? 'Michael Tal' : 'Bobby Fischer',
    description: botType === 'tal' 
      ? 'The Magician from Riga - Known for brilliant tactical sacrifices and attacking play'
      : 'The American Chess Champion - Precise, universal style with perfect endgame technique',
    style: botType === 'tal' ? 'aggressive' : 'precise'
  }

  const playerColor = 'white'
  const isPlayerTurn = gameState.activeColor === 'w'

  useEffect(() => {
    const socket = socketManager.connect()
    setConnected(true)

    // Initialize the game
    console.log(`🚀 Creating AI game with bot: ${botType}`)
    socket.emit('create-ai-game', { 
      botType,
      playerName: 'You'
    })

    // Listen for game state updates
    socket.on('game-state', (data) => {
      console.log(`📊 Game state received:`, data)
      setRoomCode(data.roomCode) // Store the actual room code
      setGameState(prev => ({
        ...prev,
        position: data.fen,
        gameStarted: data.gameStarted,
        gameStatus: data.gameStatus,
        activeColor: data.activeColor,
        moveCount: data.moveCount,
        playerNames: data.playerNames,
        playerCount: data.playerCount
      }))
      
      // Update chess.js position
      chess.load(data.fen)
      updateLegalMoves()
    })

    // Listen for move confirmations
    socket.on('move:confirmed', (data) => {
      setIsPending(false)
      setGameState(prev => ({
        ...prev,
        position: data.fen,
        activeColor: data.activeColor,
        moveCount: data.moveNumber,
        gameStatus: data.gameStatus
      }))
      
      chess.load(data.fen)
      updateLegalMoves()
      setSelectedSquare(null)
    })

    // Listen for bot move requests
    socket.on('bot-move', (data) => {
      console.log(`🤖 Server requesting bot move: ${data.botType}`)
      // Forward the bot move request back to server
      socket.emit('bot-move', data)
    })

    // Listen for bot move confirmations
    socket.on('bot:move:confirmed', (data) => {
      console.log(`🤖 ${data.botType} played ${data.move} (${data.source})`)
      if (data.reason) {
        console.log(`💭 Reason: ${data.reason}`)
      }
      setIsPending(false)
    })

    // Listen for move rejections
    socket.on('move:rejected', (data) => {
      setIsPending(false)
      console.error('Move rejected:', data.error)
    })

    socket.on('bot:move:rejected', (data) => {
      setIsPending(false)
      console.error('Bot move rejected:', data.error)
    })

    socket.on('error', (data) => {
      console.error('❌ Server error:', data.message)
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [botType, chess])

  const updateLegalMoves = useCallback(() => {
    console.log(`🔄 updateLegalMoves: isPlayerTurn=${isPlayerTurn}, gameStarted=${gameState.gameStarted}`)
    if (isPlayerTurn && gameState.gameStarted) {
      const moves = chess.moves({ verbose: true })
      const legalMoveSquares = moves.map(move => move.to)
      console.log(`📋 Legal moves:`, legalMoveSquares)
      setLegalMoves(legalMoveSquares)
    } else {
      console.log(`❌ No legal moves: isPlayerTurn=${isPlayerTurn}, gameStarted=${gameState.gameStarted}`)
      setLegalMoves([])
    }
  }, [chess, isPlayerTurn, gameState.gameStarted])

  const handleSquareClick = useCallback((square: string) => {
    console.log(`🎯 Square clicked: ${square}`)
    console.log(`🔍 Conditions: gameStarted=${gameState.gameStarted}, isPlayerTurn=${isPlayerTurn}, isPending=${isPending}`)
    
    if (!gameState.gameStarted || !isPlayerTurn || isPending) {
      console.log(`❌ Move blocked: gameStarted=${gameState.gameStarted}, isPlayerTurn=${isPlayerTurn}, isPending=${isPending}`)
      return
    }

    if (selectedSquare === square) {
      console.log(`🔄 Deselecting square: ${square}`)
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    const piece = chess.get(square as any)
    console.log(`♟️ Piece at ${square}:`, piece)
    
    if (piece && piece.color === 'w') {
      console.log(`✅ Selecting white piece at ${square}`)
      setSelectedSquare(square)
      updateLegalMoves()
    } else if (selectedSquare && legalMoves.includes(square)) {
      console.log(`🚀 Making move: ${selectedSquare} -> ${square}`)
      makeMove(selectedSquare, square)
    } else {
      console.log(`❌ Invalid selection: piece=${piece}, selectedSquare=${selectedSquare}, legalMoves=${legalMoves}`)
    }
  }, [selectedSquare, gameState.gameStarted, isPlayerTurn, isPending, chess, legalMoves, updateLegalMoves])

  const makeMove = useCallback((from: string, to: string) => {
    console.log(`🚀 makeMove called: ${from} -> ${to}`)
    console.log(`🔍 makeMove conditions: gameStarted=${gameState.gameStarted}, isPlayerTurn=${isPlayerTurn}, isPending=${isPending}`)
    
    if (!gameState.gameStarted || !isPlayerTurn || isPending) {
      console.log(`❌ makeMove blocked`)
      return
    }

    const move = chess.move({ from, to, promotion: 'q' })
    console.log(`♟️ chess.move result:`, move)
    
    if (!move) {
      console.log(`❌ chess.move failed`)
      return
    }

    console.log(`✅ Move successful, sending to server with roomCode: ${roomCode}`)
    setIsPending(true)
    
    // Emit move to server
    const socket = socketManager.getSocket()
    if (socket && roomCode) {
      console.log(`📡 Emitting make-move to server`)
      socket.emit('make-move', {
        roomCode,
        from,
        to,
        promotion: move.promotion
      })
    } else {
      console.log(`❌ Cannot send move: socket=${!!socket}, roomCode=${roomCode}`)
    }
  }, [gameState.gameStarted, isPlayerTurn, isPending, chess, roomCode])

  const handleDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (!gameState.gameStarted || !isPlayerTurn || isPending) return
    
    const move = chess.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'
    })

    if (move) {
      setIsPending(true)
      
      // Emit move to server
      const socket = socketManager.getSocket()
      if (socket) {
        socket.emit('make-move', {
          roomCode: 'ai-game',
          from: sourceSquare,
          to: targetSquare,
          promotion: move.promotion
        })
      }
    }
  }, [gameState.gameStarted, isPlayerTurn, isPending, chess])

  const getSquareStyles = useCallback(() => {
    const styles: Record<string, any> = {}

    if (selectedSquare) {
      styles[selectedSquare] = {
        background: 'rgba(255, 255, 0, 0.4)',
        borderRadius: '50%'
      }

      legalMoves.forEach(square => {
        if (chess.get(square as any)) {
          styles[square] = {
            background: 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)',
            borderRadius: '50%'
          }
        } else {
          styles[square] = {
            background: 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
            borderRadius: '50%'
          }
        }
      })
    }

    return styles
  }, [selectedSquare, legalMoves, chess])

  const isDraggablePiece = useCallback((piece: string, sourceSquare: string) => {
    return gameState.gameStarted && isPlayerTurn && !isPending && piece.startsWith('w')
  }, [gameState.gameStarted, isPlayerTurn, isPending])

  return {
    gameState,
    isPlayerTurn,
    playerColor,
    connected,
    selectedSquare,
    legalMoves,
    handleSquareClick,
    handleDrop,
    getSquareStyles,
    isDraggablePiece,
    makeMove,
    isPending,
    botConfig
  }
}
