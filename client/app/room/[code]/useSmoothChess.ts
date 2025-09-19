import { useState, useRef, useEffect, useCallback } from 'react'
import { socketManager } from '../../../lib/socket'
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
interface PendingMove {
  from: string
  to: string
  tempId: string
  timestamp: number
}
export function useSmoothChess(roomCode: string) {
  const canonicalStateRef = useRef<ChessGameState>({
    position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    activeColor: 'w',
    gameStatus: 'waiting',
    moveCount: 0,
    playerCount: 1,
    gameStarted: false,
    playerNames: { white: 'Player 1', black: 'Player 2' }
  })
  const [displayState, setDisplayState] = useState<ChessGameState>(canonicalStateRef.current)
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([])
  const [isPlayerTurn, setIsPlayerTurn] = useState(false)
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const isCreatorRef = useRef(false)
  const applyMoveToFEN = useCallback((fen: string, from: string, to: string): string => {
    const fenParts = fen.split(' ')
    const boardFen = fenParts[0]
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
    let row = 0, col = 0
    for (const char of boardFen) {
      if (char === '/') {
        row++
        col = 0
      } else if (char >= '1' && char <= '8') {
        col += parseInt(char)
      } else {
        board[row][col] = char
        col++
      }
    }
    const fromCol = from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(from[1])
    const toCol = to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(to[1])
    const piece = board[fromRow][fromCol]
    board[fromRow][fromCol] = null
    board[toRow][toCol] = piece
    let newBoardFen = ''
    for (let r = 0; r < 8; r++) {
      let emptyCount = 0
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === null) {
          emptyCount++
        } else {
          if (emptyCount > 0) {
            newBoardFen += emptyCount
            emptyCount = 0
          }
          newBoardFen += board[r][c]
        }
      }
      if (emptyCount > 0) {
        newBoardFen += emptyCount
      }
      if (r < 7) newBoardFen += '/'
    }
    const newActiveColor = fenParts[1] === 'w' ? 'b' : 'w'
    return `${newBoardFen} ${newActiveColor} ${fenParts[2]} ${fenParts[3]} ${fenParts[4]} ${fenParts[5]}`
  }, [])
  const isValidOptimisticMove = useCallback((fen: string, from: string, to: string): boolean => {
    if (from === to) return false
    const fenParts = fen.split(' ')
    const boardFen = fenParts[0]
    const activeColor = fenParts[1] as 'w' | 'b'
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
    let row = 0, col = 0
    for (const char of boardFen) {
      if (char === '/') {
        row++
        col = 0
      } else if (char >= '1' && char <= '8') {
        col += parseInt(char)
      } else {
        board[row][col] = char
        col++
      }
    }
    const fromCol = from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(from[1])
    const toCol = to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(to[1])
    const piece = board[fromRow]?.[fromCol]
    const targetPiece = board[toRow]?.[toCol]
    if (!piece) return false
    const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b'
    const currentPlayerColor = playerColor === 'white' ? 'w' : 'b'
    if (pieceColor !== currentPlayerColor) return false
    if (pieceColor !== activeColor) return false
    if (targetPiece) {
      const targetColor = targetPiece === targetPiece.toUpperCase() ? 'w' : 'b'
      if (targetColor === pieceColor) return false
    }
    return true
  }, [playerColor])
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
      canonicalStateRef.current = {
        position: data.fen,
        activeColor: data.activeColor,
        gameStatus: data.gameStatus,
        moveCount: data.moveCount,
        playerCount: data.playerCount,
        gameStarted: data.gameStarted,
        playerNames: data.playerNames
      }
      if (pendingMoves.length === 0) {
        setDisplayState(canonicalStateRef.current)
      }
      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn) && data.gameStarted
      setIsPlayerTurn(canMove)
    }
    const handleRoomStarted = (data: any) => {
      canonicalStateRef.current = {
        ...canonicalStateRef.current,
        gameStarted: true,
        playerCount: 2,
        playerNames: data.playerNames,
        activeColor: data.turn
      }
      if (pendingMoves.length === 0) {
        setDisplayState(canonicalStateRef.current)
      }
      const isWhiteTurn = data.turn === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn)
      setIsPlayerTurn(canMove)
    }
    const handleMoveConfirmed = (data: any) => {
      canonicalStateRef.current = {
        ...canonicalStateRef.current,
        position: data.fen,
        activeColor: data.activeColor,
        gameStatus: data.isCheckmate ? 'checkmate' : 
                   data.isStalemate ? 'stalemate' : 
                   data.isCheck ? 'check' : 'ongoing',
        moveCount: data.moveNumber
      }
      setPendingMoves(prev => {
        const updated = prev.filter(pm => 
          !(pm.from === data.from && pm.to === data.to)
        )
        if (updated.length === 0) {
          setDisplayState(canonicalStateRef.current)
        }
        return updated
      })
      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && !data.isCheckmate && !data.isStalemate
      setIsPlayerTurn(canMove)
    }
    const handleMoveError = (data: any) => {
      console.log('Move rejected:', data.error)
      setPendingMoves([])
      setDisplayState(canonicalStateRef.current)
      const isWhiteTurn = canonicalStateRef.current.activeColor === 'w'
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && canonicalStateRef.current.gameStarted
      setIsPlayerTurn(canMove)
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
  }, [roomCode, pendingMoves.length])
  const makeMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const socket = socketRef.current
    if (!socket || !connected || !isPlayerTurn || !displayState.gameStarted) {
      return false
    }
    if (!isValidOptimisticMove(displayState.position, from, to)) {
      console.log('Invalid optimistic move')
      return false
    }
    console.log(`🎯 Making optimistic move: ${from} to ${to}`)
    const tempId = `${Date.now()}_${Math.random()}`
    const pendingMove: PendingMove = {
      from,
      to,
      tempId,
      timestamp: Date.now()
    }
    const newPosition = applyMoveToFEN(displayState.position, from, to)
    const newActiveColor = displayState.activeColor === 'w' ? 'b' : 'w'
    setDisplayState(prev => ({
      ...prev,
      position: newPosition,
      activeColor: newActiveColor
    }))
    setPendingMoves(prev => [...prev, pendingMove])
    setIsPlayerTurn(false)
    socket.emit('make-move', {
      roomCode: roomCode.toUpperCase(),
      from,
      to,
      promotion
    })
    return true
  }, [connected, isPlayerTurn, displayState.gameStarted, displayState.position, displayState.activeColor, isValidOptimisticMove, applyMoveToFEN, roomCode])
  return {
    gameState: displayState,
    isPlayerTurn,
    playerColor,
    connected,
    makeMove
  }
}
