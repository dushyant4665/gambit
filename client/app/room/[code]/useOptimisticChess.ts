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

export function useOptimisticChess(roomCode: string) {
  const [gameState, setGameState] = useState<GameState>({
    position: 'start',
    gameStarted: false,
    gameStatus: 'waiting',
    activeColor: 'w',
    moveCount: 0,
    playerNames: { white: 'Player 1', black: 'Player 2' },
    playerCount: 0
  })
  
  const [connected, setConnected] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)
  const [chess] = useState(new Chess())
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')

  const isPlayerTurn = gameState.activeColor === (playerColor === 'white' ? 'w' : 'b')

  useEffect(() => {
    const socket = socketManager.connect()
    setConnected(true)

    // Join the room
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    
    console.log(`🚀 Joining room: ${roomCode}, isCreator: ${isCreator}`)
    
    const storedName = localStorage.getItem(`player_name_${roomCode}`)
    const playerName = storedName && storedName.trim().length > 0
      ? storedName.trim()
      : (isCreator ? 'Player 1' : 'Player 2')

    socket.emit('join-room', {
      roomCode,
      playerName,
      isCreator
    })

    // Listen for game state updates
    socket.on('game-state', (data) => {
      console.log(`📊 Game state received:`, data)
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
      
      // Set player color if not already set
      if (!playerColor || playerColor === 'white') {
        const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
        const isCreator = createdRooms.includes(roomCode)
        if (isCreator) {
          setPlayerColor('white')
        } else if (data.playerCount === 2) {
          setPlayerColor('black')
        }
      }
    })

    // Listen for room started event
    socket.on('room:started', (data) => {
      console.log(`🎉 Room started:`, data)
      setGameState(prev => ({
        ...prev,
        gameStarted: true,
        gameStatus: 'ongoing',
        playerNames: data.playerNames,
        playerCount: 2
      }))
      
      // Determine player color based on socket ID
      const socket = socketManager.getSocket()
      if (socket) {
        const isWhite = socket.id === data.whiteId
        setPlayerColor(isWhite ? 'white' : 'black')
        console.log(`🎯 Player color set to: ${isWhite ? 'white' : 'black'}`)
      }
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

    // Listen for move errors
    socket.on('move-error', (data) => {
      setIsPending(false)
      console.error('Move error:', data.error)
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
  }, [roomCode, chess])

  const updateLegalMoves = useCallback(() => {
    console.log(`🔄 updateLegalMoves: isPlayerTurn=${isPlayerTurn}, gameStarted=${gameState.gameStarted}`)
    if (isPlayerTurn && gameState.gameStarted && connected) {
      const moves = chess.moves({ verbose: true })
      const legalMoveSquares = moves.map(move => move.to)
      console.log(`📋 Legal moves:`, legalMoveSquares)
      setLegalMoves(legalMoveSquares)
    } else {
      console.log(`❌ No legal moves: isPlayerTurn=${isPlayerTurn}, gameStarted=${gameState.gameStarted}, connected=${connected}`)
      setLegalMoves([])
    }
  }, [chess, isPlayerTurn, gameState.gameStarted, connected])

  const handleSquareClick = useCallback((square: string) => {
    console.log(`🎯 Square clicked: ${square}`)
    console.log(`🔍 Conditions: gameStarted=${gameState.gameStarted}, isPlayerTurn=${isPlayerTurn}, isPending=${isPending}, connected=${connected}`)
    
    if (!gameState.gameStarted || !isPlayerTurn || isPending || !connected) {
      console.log(`❌ Move blocked: gameStarted=${gameState.gameStarted}, isPlayerTurn=${isPlayerTurn}, isPending=${isPending}, connected=${connected}`)
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
    
    const expectedColor = playerColor === 'white' ? 'w' : 'b'
    if (piece && piece.color === expectedColor) {
      console.log(`✅ Selecting ${playerColor} piece at ${square}`)
      setSelectedSquare(square)
      // Get legal moves for this specific piece
      const moves = chess.moves({ square: square as any, verbose: true })
      const legalMoveSquares = moves.map(move => move.to)
      setLegalMoves(legalMoveSquares)
      console.log(`📋 Legal moves for ${square}:`, legalMoveSquares)
    } else if (selectedSquare && legalMoves.includes(square)) {
      console.log(`🚀 Making move: ${selectedSquare} -> ${square}`)
      makeMove(selectedSquare, square)
    } else {
      console.log(`❌ Invalid selection: piece=${piece}, selectedSquare=${selectedSquare}, legalMoves=${legalMoves}`)
    }
  }, [selectedSquare, gameState.gameStarted, isPlayerTurn, isPending, chess, legalMoves, updateLegalMoves, playerColor])

  const makeMove = useCallback((from: string, to: string) => {
    console.log(`🚀 makeMove called: ${from} -> ${to}`)
    console.log(`🔍 makeMove conditions: gameStarted=${gameState.gameStarted}, isPlayerTurn=${isPlayerTurn}, isPending=${isPending}, connected=${connected}`)
    
    if (!gameState.gameStarted || !isPlayerTurn || isPending || !connected) {
      console.log(`❌ makeMove blocked`)
      return
    }

    // Check if move is legal first
    const legalMoves = chess.moves({ square: from as any, verbose: true })
    const isLegalMove = legalMoves.some(move => move.to === to)
    
    if (!isLegalMove) {
      console.log(`❌ Move ${from} to ${to} is not legal`)
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
        promotion: 'q'
      })
    } else {
      console.log(`❌ Cannot send move: socket=${!!socket}, roomCode=${roomCode}`)
      setIsPending(false)
    }
  }, [gameState.gameStarted, isPlayerTurn, isPending, connected, chess, roomCode])

  const handleDrop = useCallback((sourceSquare: string, targetSquare: string, _piece?: string): boolean => {
    if (!gameState.gameStarted || !isPlayerTurn || isPending || !connected) return false

    // Validate using chess.js before sending
    const legalMoves = chess.moves({ square: sourceSquare as any, verbose: true })
    const chosenMove = legalMoves.find(m => m.to === targetSquare)
    if (!chosenMove) return false

    setIsPending(true)

    // Emit move to server
    const socket = socketManager.getSocket()
    if (socket) {
      socket.emit('make-move', {
        roomCode,
        from: sourceSquare,
        to: targetSquare,
        promotion: chosenMove.promotion || 'q'
      })
      return true
    }

    setIsPending(false)
    return false
  }, [gameState.gameStarted, isPlayerTurn, isPending, connected, chess, roomCode])

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

  const isDraggablePiece = useCallback(({ piece }: { piece: string, sourceSquare: string }) => {
    const expectedColor = playerColor === 'white' ? 'w' : 'b'
    return !!(gameState.gameStarted && isPlayerTurn && !isPending && connected && piece && typeof piece === 'string' && piece.startsWith(expectedColor))
  }, [gameState.gameStarted, isPlayerTurn, isPending, connected, playerColor])

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
    isPending
  }
}