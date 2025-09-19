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

interface OptimisticMove {
  from: string
  to: string
  piece: string
  timestamp: number
}

export function useChessGameSocket(roomCode: string) {
  const [gameState, setGameState] = useState<ChessGameState>({
    position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    activeColor: 'w',
    gameStatus: 'waiting',
    moveCount: 0,
    playerCount: 1,
    gameStarted: false,
    playerNames: { white: 'Player 1', black: 'Player 2' }
  })

  const [optimisticMoves, setOptimisticMoves] = useState<OptimisticMove[]>([])
  const [isPlayerTurn, setIsPlayerTurn] = useState(false)
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [connected, setConnected] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const lastMoveIdRef = useRef<string>('')
  const gameStateRef = useRef(gameState)
  const isCreatorRef = useRef(false)

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  const isBasicValidMove = useCallback((fen: string, from: string, to: string): boolean => {

    const fenParts = fen.split(' ')
    const boardFen = fenParts[0]
    const activeColor = fenParts[1] as 'w' | 'b'

    const fromCol = from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(from[1])
    const toCol = to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(to[1])

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

    const piece = board[fromRow]?.[fromCol]
    const targetPiece = board[toRow]?.[toCol]

    if (!piece) return false
    if (from === to) return false
    if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7) return false
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false

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

  const applyOptimisticMove = useCallback((fen: string, move: OptimisticMove): string => {
    const fenParts = fen.split(' ')
    const boardFen = fenParts[0]
    let activeColor = fenParts[1] as 'w' | 'b'

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

    const fromCol = move.from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(move.from[1])
    const toCol = move.to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(move.to[1])

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

    activeColor = activeColor === 'w' ? 'b' : 'w'

    return `${newBoardFen} ${activeColor} ${fenParts[2]} ${fenParts[3]} ${fenParts[4]} ${fenParts[5]}`
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
      console.log('Socket connected, joining room...')

      socket.emit('join-room', {
        roomCode: roomCode.toUpperCase(),
        playerName,
        isCreator
      })
    }

    const handleGameState = (data: any) => {
      console.log('Received game state:', data)

      setGameState({
        position: data.fen,
        activeColor: data.activeColor,
        gameStatus: data.gameStatus,
        moveCount: data.moveCount,
        playerCount: data.playerCount,
        gameStarted: data.gameStarted,
        playerNames: data.playerNames
      })

      const isWhiteTurn = data.activeColor === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn) && data.gameStarted
      setIsPlayerTurn(canMove)

      console.log(`Game state updated - can move: ${canMove}, isCreator: ${isCreator}, isWhiteTurn: ${isWhiteTurn}, gameStarted: ${data.gameStarted}`)
    }

    const handleRoomStarted = (data: any) => {
      console.log('🎯 ROOM STARTED EVENT:', data)

      setGameState(prev => ({
        ...prev,
        gameStarted: true,
        playerCount: 2,
        playerNames: data.playerNames,
        activeColor: data.turn
      }))

      const isWhiteTurn = data.turn === 'w'
      const canMove = (isCreator ? isWhiteTurn : !isWhiteTurn)
      setIsPlayerTurn(canMove)

      console.log(`🚀 ROOM STARTED - can move: ${canMove}, isCreator: ${isCreator}, turn: ${data.turn}`)

      setTimeout(() => {
        setIsPlayerTurn(canMove)
      }, 0)
    }

    const handleMoveConfirmed = (data: any) => {
      console.log('Move confirmed:', data)

      if (lastMoveIdRef.current === data.moveId) return

      setOptimisticMoves(prev => prev.filter(om => 
        !(om.from === data.from && om.to === data.to)
      ))

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
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && !data.isCheckmate && !data.isStalemate
      setIsPlayerTurn(canMove)

      lastMoveIdRef.current = data.moveId
    }

    const handleMoveError = (data: any) => {
      console.log('Move error:', data.error)

      setOptimisticMoves([])

      const currentState = gameStateRef.current
      const isWhiteTurn = currentState.activeColor === 'w'
      const canMove = (isCreatorRef.current ? isWhiteTurn : !isWhiteTurn) && currentState.gameStarted
      setIsPlayerTurn(canMove)

      console.error('Move failed:', data.error)
    }

    const handleError = (data: any) => {
      console.error('Socket error:', data.message)
    }

    const handleDisconnect = () => {
      setConnected(false)
      setIsPlayerTurn(false)
      console.log('Socket disconnected')
    }

    socket.on('connect', handleConnect)
    socket.on('game-state', handleGameState)
    socket.on('room:started', handleRoomStarted)
    socket.on('move:confirmed', handleMoveConfirmed)
    socket.on('move-error', handleMoveError)
    socket.on('error', handleError)
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
      socket.off('error', handleError)
      socket.off('disconnect', handleDisconnect)
    }
  }, [roomCode, isBasicValidMove])

  const makeMove = useCallback(async (from: string, to: string, promotion?: string): Promise<boolean> => {
    const socket = socketRef.current
    if (!socket || !connected) {
      console.log('Cannot make move: socket not connected')
      return false
    }

    if (!isPlayerTurn) {
      console.log('Cannot make move: not player turn')
      return false
    }

    if (!gameState.gameStarted) {
      console.log('Cannot make move: game not started')
      return false
    }

    if (!isBasicValidMove(gameState.position, from, to)) {
      console.log('Basic validation failed')
      return false
    }

    console.log(`🎯 Making move: ${from} to ${to}`)

    const optimisticMove: OptimisticMove = {
      from,
      to,
      piece: 'temp',
      timestamp: Date.now()
    }

    setOptimisticMoves(prev => [...prev, optimisticMove])

    setIsPlayerTurn(false)

    socket.emit('make-move', {
      roomCode: roomCode.toUpperCase(),
      from,
      to,
      promotion
    })

    setTimeout(() => {
      setOptimisticMoves(prev => prev.filter(om => om.timestamp !== optimisticMove.timestamp))
    }, 300)

    return true
  }, [isPlayerTurn, gameState.gameStarted, gameState.position, isBasicValidMove, roomCode, connected])

  const displayPosition = optimisticMoves.reduce((pos, move) => {
    if (isBasicValidMove(pos, move.from, move.to)) {
      return applyOptimisticMove(pos, move)
    }
    return pos
  }, gameState.position)

  return {
    gameState,
    optimisticMoves,
    isPlayerTurn,
    playerColor,
    connected,
    displayPosition,
    makeMove
  }
}