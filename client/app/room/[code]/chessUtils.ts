export interface OptimisticMove {
  from: string
  to: string
  piece: string
  timestamp: number
}

export function isValidSquare(square: string): boolean {
  return /^[a-h][1-8]$/.test(square)
}

export function squareToIndices(square: string): [number, number] {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = parseInt(square[1]) - 1
  return [7 - rank, file]
}

export function indicesToSquare(row: number, col: number): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + col)
  const rank = (8 - row).toString()
  return file + rank
}

export function fenToBoard(fen: string): (string | null)[][] {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
  
  const parts = fen.split(' ')
  const position = parts[0]
  const ranks = position.split('/')
  
  for (let i = 0; i < 8; i++) {
    const rank = ranks[i]
    let file = 0
    
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        file += parseInt(char)
      } else {
        board[i][file] = char
        file++
      }
    }
  }
  
  return board
}

export function applyOptimisticMove(fen: string, move: OptimisticMove): string {
  const board = fenToBoard(fen)
  const [fromRow, fromCol] = squareToIndices(move.from)
  const [toRow, toCol] = squareToIndices(move.to)
  
  const piece = board[fromRow][fromCol]
  if (!piece) return fen
  
  board[toRow][toCol] = piece
  board[fromRow][fromCol] = null
  
  const parts = fen.split(' ')
  const newPosition = boardToFenPosition(board)
  
  const activeColor = parts[1] === 'w' ? 'b' : 'w'
  
  return `${newPosition} ${activeColor} ${parts[2] || 'KQkq'} ${parts[3] || '-'} ${parts[4] || '0'} ${parts[5] || '1'}`
}

function boardToFenPosition(board: (string | null)[][]): string {
  const ranks: string[] = []
  
  for (let i = 0; i < 8; i++) {
    let rankStr = ''
    let emptyCount = 0
    
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j]
      if (piece) {
        if (emptyCount > 0) {
          rankStr += emptyCount.toString()
          emptyCount = 0
        }
        rankStr += piece
      } else {
        emptyCount++
      }
    }
    
    if (emptyCount > 0) {
      rankStr += emptyCount.toString()
    }
    
    ranks.push(rankStr)
  }
  
  return ranks.join('/')
}

export function isBasicValidMove(fen: string, from: string, to: string): boolean {
  if (!isValidSquare(from) || !isValidSquare(to)) return false
  if (from === to) return false
  
  const board = fenToBoard(fen)
  const [fromRow, fromCol] = squareToIndices(from)
  const [toRow, toCol] = squareToIndices(to)
  
  const piece = board[fromRow][fromCol]
  if (!piece) return false
  
  const targetPiece = board[toRow][toCol]
  const parts = fen.split(' ')
  const activeColor = parts[1]
  
  const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b'
  if (pieceColor !== activeColor) return false
  
  if (targetPiece) {
    const targetColor = targetPiece === targetPiece.toUpperCase() ? 'w' : 'b'
    if (pieceColor === targetColor) return false
  }
  
  return true
}