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

export function useOptimisticChess(roomCode: string) {
  const engineRef = useRef<SimpleChess>(new SimpleChess())
  
  const canonicalFenRef = useRef<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const lastAppliedMoveId = useRef<string>('')
  
  const optimisticMovePending = useRef<{from: string, to: string, tempId: string} | null>(null)
  
  const [gameState, setGameState] = useState<ChessGameState>({
    position: canonicalFenRef.current,
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
      console.log('🔌 Socket connected, joining room...')
      socket.emit('join-room', {
        roomCode: roomCode.toUpperCase(),
        playerName,
        isCreator
      })
    }

    const handleGameState = (data: any) => {
      console.log('📡 Game state received:', data)
      
      canonicalFenRef.current = data.fen
      engineRef.current.setPosition(data.fen)
      
      if (!optimisticMovePending.current) {
        setGameState({
          position: data.fen,
          activeColor: data.activeColor,
          gameStatus: data.gameStatus,
          moveCount: data.moveCount,
          playerCount: data.playerCount,
          gameStarted: data.gameStarted,
          playerNames: data.playerNames
        })
      }

      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn) && data.gameStarted && !optimisticMovePending.current
      setIsPlayerTurn(canMove)
      
      console.log(`📊 Turn state: activeColor=${data.activeColor}, canMove=${canMove}, isCreator=${isCreator}`)
    }

    const handleRoomStarted = (data: any) => {
      console.log('🚀 ROOM STARTED EVENT:', data)
      
      canonicalFenRef.current = data.fen || canonicalFenRef.current
      engineRef.current.setPosition(canonicalFenRef.current)
      
      setGameState(prev => ({
        ...prev,
        gameStarted: true,
        playerCount: 2,
        playerNames: data.playerNames,
        activeColor: data.turn,
        position: canonicalFenRef.current
      }))

      const isWhiteTurn = data.turn === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn)
      setIsPlayerTurn(canMove)
      
      if (data.playerNames?.black && isCreator) {
        // voiceAnnounce.playerJoined(data.playerNames.black, 'black')
      }
      
      console.log(`🎯 ROOM STARTED - White can move: ${canMove}, isCreator: ${isCreator}`)
    }

    const handleMoveConfirmed = (data: any) => {
      console.log('✅ Move confirmed:', data)
      
      if (optimisticMovePending.current && 
          optimisticMovePending.current.from === data.from && 
          optimisticMovePending.current.to === data.to) {
        
        console.log('✅ Our optimistic move confirmed - clearing pending')
        optimisticMovePending.current = null
        lastAppliedMoveId.current = data.moveId
        
        canonicalFenRef.current = data.fen
        engineRef.current.setPosition(data.fen)
        
        setGameState(prev => ({
          ...prev,
          position: data.fen,
          activeColor: data.activeColor,
          gameStatus: data.isCheckmate ? 'checkmate' : 
                     data.isStalemate ? 'stalemate' : 
                     data.isCheck ? 'check' : 'ongoing',
          moveCount: data.moveNumber
        }))
        
        const isWhiteTurn = data.activeColor === 'w'
        const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && 
                       !data.isCheckmate && !data.isStalemate
        setIsPlayerTurn(canMove)
        
        if (data.isCheckmate) {
          const winner = data.color === 'w' ? 'white' : 'black'
          // voiceAnnounce.checkmate(winner)
        } else if (data.isStalemate) {
          // voiceAnnounce.stalemate()
        } else if (data.isCheck) {
          const checkedColor = data.activeColor === 'w' ? 'white' : 'black'
          // voiceAnnounce.check(checkedColor)
        }
        
        return
      }
      
      console.log('📨 Opponent move - applying incrementally')
      
      canonicalFenRef.current = data.fen
      
      engineRef.current.setPosition(data.fen)
      
      setGameState(prev => ({
        ...prev,
        position: data.fen,
        activeColor: data.activeColor,
        gameStatus: data.isCheckmate ? 'checkmate' : 
                   data.isStalemate ? 'stalemate' : 
                   data.isCheck ? 'check' : 'ongoing',
        moveCount: data.moveNumber
      }))
      
      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && 
                     !data.isCheckmate && !data.isStalemate
      setIsPlayerTurn(canMove)
      
      const piece = data.piece || 'piece'
      const isCapture = data.capturedPiece || data.san?.includes('x')
      
      // voiceAnnounce.move(piece, data.from, data.to, isCapture)
      
      if (data.san?.includes('O-O-O')) {
        // voiceAnnounce.castling('queenside')
      } else if (data.san?.includes('O-O')) {
        // voiceAnnounce.castling('kingside')
      }
      
      if (data.promotion) {
        // voiceAnnounce.promotion(data.color + data.promotion, data.to)
      }
      
      if (data.isCheckmate) {
        const winner = data.color === 'w' ? 'white' : 'black'
        // voiceAnnounce.checkmate(winner)
      } else if (data.isStalemate) {
        // voiceAnnounce.stalemate()
      } else if (data.isCheck) {
        const checkedColor = data.activeColor === 'w' ? 'white' : 'black'
        // voiceAnnounce.check(checkedColor)
      } else if (!data.isCheckmate && !data.isStalemate) {
        setTimeout(() => {
          const nextColor = data.activeColor === 'w' ? 'white' : 'black'
          // voiceAnnounce.turnChange(nextColor)
        }, 1500)
      }
      
      lastAppliedMoveId.current = data.moveId
    }

    const handleMoveError = (data: any) => {
      console.log('❌ Move rejected by server:', data.error)
      
      if (optimisticMovePending.current) {
        console.log('🔄 Rolling back optimistic move')
        
        engineRef.current.setPosition(canonicalFenRef.current)
        
        setGameState(prev => ({
          ...prev,
          position: canonicalFenRef.current,
          activeColor: engineRef.current.getActiveColor()
        }))
        
        optimisticMovePending.current = null
      }
      
      const isWhiteTurn = engineRef.current.getActiveColor() === 'w'
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
  }, [roomCode, gameState.gameStarted])

  const handleSquareClick = useCallback((square: string) => {
    if (gameState.gameStatus === 'checkmate' || gameState.gameStatus === 'stalemate' || gameState.gameStatus === 'draw') {
      return
    }
    
    if (!isPlayerTurn || !gameState.gameStarted || optimisticMovePending.current) return

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

    const moves = engineRef.current.getBasicLegalMoves(square)
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
    
    if (!isPlayerTurn || !gameState.gameStarted || !connected || optimisticMovePending.current) {
      console.log('❌ Drop rejected: not ready or move pending')
      return false
    }

    return makeMove(sourceSquare, targetSquare)
  }, [isPlayerTurn, gameState.gameStarted, connected])

  const makeMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const socket = socketRef.current
    if (!socket || !connected || !isPlayerTurn || optimisticMovePending.current) {
      return false
    }

    if (!engineRef.current.isBasicValidMove(from, to)) {
      console.log('❌ Invalid move - basic validation failed')
      return false
    }

    console.log(`🚀 Making optimistic move: ${from} → ${to}`)

    const currentPosition = engineRef.current.getPosition()
    const pieces = engineRef.current.parseBoard()
    const fromCol = from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(from[1])
    const toCol = to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(to[1])
    const movingPiece = pieces[fromRow][fromCol]
    const capturedPiece = pieces[toRow][toCol]

    const canonicalFenBeforeMove = canonicalFenRef.current
    
    const newPosition = engineRef.current.applyMove(from, to, promotion)
    
    if (movingPiece) {
      const isCapture = !!capturedPiece
      // voiceAnnounce.move(movingPiece, from, to, isCapture)
      
      if (movingPiece.toLowerCase().endsWith('p') && promotion) {
        // voiceAnnounce.promotion(playerColor[0] + promotion, to)
      }
      
      if (movingPiece.toLowerCase().endsWith('k') && Math.abs(fromCol - toCol) === 2) {
        const side = toCol > fromCol ? 'kingside' : 'queenside'
        // voiceAnnounce.castling(side)
      }
    }
    
    requestAnimationFrame(() => {
      setGameState(prev => ({
        ...prev,
        position: newPosition,
        activeColor: prev.activeColor === 'w' ? 'b' : 'w',
        moveCount: prev.moveCount + 1
      }))
    })

    const tempId = `${Date.now()}_${Math.random()}`
    optimisticMovePending.current = { from, to, tempId }

    setIsPlayerTurn(false)
    setSelectedSquare(null)
    setLegalMoves([])

    socket.emit('make-move', {
      roomCode: roomCode.toUpperCase(),
      from,
      to,
      promotion
    })

    console.log(`✅ Optimistic move applied: ${from} → ${to}`)
    return true
  }, [connected, isPlayerTurn, roomCode, playerColor])

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
    
    if (optimisticMovePending.current) {
      const pendingSquare = optimisticMovePending.current.to
      if (styles[pendingSquare]) {
        styles[pendingSquare] = {
          ...styles[pendingSquare],
          opacity: 0.8
        }
      } else {
        styles[pendingSquare] = {
          opacity: 0.8,
          backgroundColor: 'rgba(255, 255, 0, 0.2)'
        }
      }
    }
    
    return styles
  }, [selectedSquare, legalMoves])

  const isDraggablePiece = useCallback(({ piece }: { piece: string }) => {
    if (gameState.gameStatus === 'checkmate' || gameState.gameStatus === 'stalemate' || gameState.gameStatus === 'draw') {
      return false
    }
    
    if (!gameState.gameStarted || !isPlayerTurn || !connected || optimisticMovePending.current) return false
    const pieceColor = piece[0] === 'w' ? 'white' : 'black'
    return pieceColor === playerColor
  }, [gameState.gameStarted, gameState.gameStatus, isPlayerTurn, connected, playerColor])

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
    isPending: !!optimisticMovePending.current
  }
}