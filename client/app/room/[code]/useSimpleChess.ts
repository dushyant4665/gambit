import { useState, useRef, useEffect, useCallback } from 'react'
import { socketManager } from '../../../lib/socket'
import { SimpleChess } from './SimpleChess'
import type { Socket } from 'socket.io-client'

interface ChessGameState {
  position: string
  activeColor: 'w' | 'b'
  gameStatus: string
  moveCount: number
  playerCount: number
  gameStarted: boolean
  playerNames: {
    white: string
    black: string
  }
}

export function useSimpleChess(roomCode: string) {

  const chessEngineRef = useRef<SimpleChess>(new SimpleChess())

  const [gameState, setGameState] = useState<ChessGameState>({
    position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    activeColor: 'w',
    gameStatus: 'waiting',
    moveCount: 0,
    playerCount: 1,
    gameStarted: false,
    playerNames: { white: 'Player 1', black: 'Player 2' }
  })

  const [isPlayerTurn, setIsPlayerTurn] = useState(false)
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [connected, setConnected] = useState(false)

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])

  const socketRef = useRef<Socket | null>(null)
  const isCreatorRef = useRef(false)
  const isMobile = useRef(false)

  useEffect(() => {
    isMobile.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  useEffect(() => {
    const socket = socketManager.connect()
    socketRef.current = socket

    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    const playerName = localStorage.getItem(`player_name_${roomCode}`) || 'Anonymous'

    isCreatorRef.current = isCreator
    setPlayerColor(isCreator ? 'white' : 'black')

    const handleConnect = () => {
      setConnected(true)
      socket.emit('join-room', {
        roomCode: roomCode.toUpperCase(),
        playerName,
        isCreator
      })
    }

    const handleGameState = (data: any) => {
      console.log('📡 Game state:', data)

      const newState = {
        position: data.fen,
        activeColor: data.activeColor,
        gameStatus: data.gameStatus,
        moveCount: data.moveCount,
        playerCount: data.playerCount,
        gameStarted: data.gameStarted,
        playerNames: data.playerNames
      }

      setGameState(newState)
      chessEngineRef.current.setPosition(data.fen)

      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn) && data.gameStarted
      setIsPlayerTurn(canMove)
    }

    const handleRoomStarted = (data: any) => {
      console.log('🚀 Room started:', data)

      setGameState(prev => ({
        ...prev,
        gameStarted: true,
        playerCount: 2,
        playerNames: data.playerNames,
        activeColor: data.turn
      }))

      chessEngineRef.current.setPosition(data.fen || gameState.position)

      const isWhiteTurn = data.turn === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn)
      setIsPlayerTurn(canMove)
    }

    const handleMoveConfirmed = (data: any) => {
      console.log('✅ Move confirmed:', data)

      setGameState(prev => ({
        ...prev,
        position: data.fen,
        activeColor: data.activeColor,
        gameStatus: data.isCheckmate ? 'checkmate' : 
                   data.isStalemate ? 'stalemate' : 
                   data.isCheck ? 'check' : 'ongoing',
        moveCount: data.moveNumber
      }))

      chessEngineRef.current.setPosition(data.fen)

      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && 
                     !data.isCheckmate && !data.isStalemate
      setIsPlayerTurn(canMove)

      setSelectedSquare(null)
      setLegalMoves([])
    }

    const handleMoveError = (data: any) => {
      console.log('❌ Move error:', data.error)

      const isWhiteTurn = gameState.activeColor === 'w'
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && gameState.gameStarted
      setIsPlayerTurn(canMove)
      setSelectedSquare(null)
      setLegalMoves([])
    }

    const handleDisconnect = () => {
      setConnected(false)
      setIsPlayerTurn(false)
    }

    socket.on('connect', handleConnect)
    socket.on('game-state', handleGameState)
    socket.on('room:started', handleRoomStarted)
    socket.on('move:confirmed', handleMoveConfirmed)
    socket.on('move-error', handleMoveError)
    socket.on('disconnect', handleDisconnect)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('game-state', handleGameState)
      socket.off('room:started', handleRoomStarted)
      socket.off('move:confirmed', handleMoveConfirmed)
      socket.off('move-error', handleMoveError)
      socket.off('disconnect', handleDisconnect)
    }
  }, [roomCode, gameState.activeColor, gameState.gameStarted])

  const handleSquareClick = useCallback((square: string) => {
    if (!isPlayerTurn || !gameState.gameStarted) return

    console.log(`🎯 Square clicked: ${square}`)

    if (selectedSquare === square) {
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    if (selectedSquare && legalMoves.includes(square)) {
      makeMove(selectedSquare, square)
      return
    }

    const moves = chessEngineRef.current.getBasicLegalMoves(square)
    if (moves.length > 0) {
      setSelectedSquare(square)
      setLegalMoves(moves)
      console.log(`📱 Selected ${square}, legal moves:`, moves)
    } else {
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }, [isPlayerTurn, gameState.gameStarted, selectedSquare, legalMoves])

  const handleDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    console.log(`🎯 Piece dropped: ${sourceSquare} → ${targetSquare}`)

    if (!isPlayerTurn || !gameState.gameStarted || !connected) {
      return false
    }

    return makeMove(sourceSquare, targetSquare)
  }, [isPlayerTurn, gameState.gameStarted, connected])

  const makeMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const socket = socketRef.current
    if (!socket || !connected || !isPlayerTurn) {
      return false
    }

    if (!chessEngineRef.current.isBasicValidMove(from, to)) {
      console.log('❌ Invalid move')
      return false
    }

    console.log(`🚀 Making move: ${from} → ${to}`)

    const newPosition = chessEngineRef.current.applyMove(from, to, promotion)
    setGameState(prev => ({
      ...prev,
      position: newPosition,
      activeColor: prev.activeColor === 'w' ? 'b' : 'w'
    }))

    setIsPlayerTurn(false)
    setSelectedSquare(null)
    setLegalMoves([])

    socket.emit('make-move', {
      roomCode: roomCode.toUpperCase(),
      from,
      to,
      promotion
    })

    return true
  }, [connected, isPlayerTurn, roomCode])

  const getSquareStyles = useCallback(() => {
    const styles: { [square: string]: React.CSSProperties } = {}

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        boxShadow: 'inset 0 0 0 3px rgba(59, 130, 246, 0.8)'
      }
    }

    for (const square of legalMoves) {
      styles[square] = {
        background: 'radial-gradient(circle, rgba(107, 114, 128, 0.7) 25%, transparent 25%)',
        cursor: 'pointer'
      }
    }

    return styles
  }, [selectedSquare, legalMoves])

  const isDraggablePiece = useCallback(({ piece }: { piece: string }) => {
    if (!gameState.gameStarted || !isPlayerTurn || !connected) return false
    const pieceColor = piece[0] === 'w' ? 'white' : 'black'
    return pieceColor === playerColor
  }, [gameState.gameStarted, isPlayerTurn, connected, playerColor])

  return {
    gameState,
    isPlayerTurn,
    playerColor,
    connected,
    selectedSquare,
    legalMoves,
    isMobile: isMobile.current,
    handleSquareClick,
    handleDrop,
    getSquareStyles,
    isDraggablePiece,
    makeMove
  }
}
