export type PieceColor = 'w' | 'b'
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k'

export interface ChessMove {
  from: string
  to: string
  piece: string
  promotion?: string
}

export class SimpleChess {
  private position: string

  constructor(fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    this.position = fen
  }

  getPosition(): string {
    return this.position
  }

  getActiveColor(): PieceColor {
    return this.position.split(' ')[1] as PieceColor
  }

  private parseBoardInternal(): (string | null)[][] {
    const boardFen = this.position.split(' ')[0]
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
    
    let row = 0, col = 0
    for (const char of boardFen) {
      if (char === '/') {
        row++
        col = 0
      } else if (char >= '1' && char <= '8') {
        col += parseInt(char)
      } else {
        const pieceColor = char === char.toUpperCase() ? 'w' : 'b'
        const pieceType = char.toLowerCase()
        board[row][col] = `${pieceColor}${pieceType}`
        col++
      }
    }
    
    return board
  }

  private boardToFEN(board: (string | null)[][], activeColor: PieceColor): string {
    let boardFen = ''
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece === null) {
          emptyCount++
        } else {
          if (emptyCount > 0) {
            boardFen += emptyCount
            emptyCount = 0
          }
          const pieceChar = piece[1]
          boardFen += piece[0] === 'w' ? pieceChar.toUpperCase() : pieceChar
        }
      }
      if (emptyCount > 0) {
        boardFen += emptyCount
      }
      if (row < 7) boardFen += '/'
    }
    
    const parts = this.position.split(' ')
    return `${boardFen} ${activeColor} ${parts[2]} ${parts[3]} ${parts[4]} ${parts[5]}`
  }

  isBasicValidMove(from: string, to: string): boolean {
    if (from === to) return false
    
    const board = this.parseBoardInternal()
    const fromCol = from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(from[1])
    const toCol = to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(to[1])
    
    if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7) return false
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false
    
    const piece = board[fromRow][fromCol]
    const targetPiece = board[toRow][toCol]
    
    if (!piece) return false
    
    const pieceColor = piece[0] as PieceColor
    const activeColor = this.getActiveColor()
    if (pieceColor !== activeColor) return false
    
    if (targetPiece) {
      const targetColor = targetPiece[0] as PieceColor
      if (targetColor === pieceColor) return false
    }
    
    return true
  }

  applyMove(from: string, to: string, promotion?: string): string {
    const board = this.parseBoardInternal()
    const fromCol = from.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(from[1])
    const toCol = to.charCodeAt(0) - 97
    const toRow = 8 - parseInt(to[1])
    
    const piece = board[fromRow][fromCol]
    if (!piece) return this.position
    
    let finalPiece = piece
    if (piece[1] === 'p' && (toRow === 0 || toRow === 7)) {
      const pieceColor = piece[0] as PieceColor
      finalPiece = `${pieceColor}${promotion || 'q'}`
    }
    
    board[fromRow][fromCol] = null
    board[toRow][toCol] = finalPiece
    
    const newActiveColor = this.getActiveColor() === 'w' ? 'b' : 'w'
    
    return this.boardToFEN(board, newActiveColor)
  }

  getBasicLegalMoves(square: string): string[] {
    const board = this.parseBoardInternal()
    const fromCol = square.charCodeAt(0) - 97
    const fromRow = 8 - parseInt(square[1])
    
    const piece = board[fromRow][fromCol]
    if (!piece || piece[0] !== this.getActiveColor()) return []
    
    const moves: string[] = []
    const pieceType = piece[1] as PieceType
    
    switch (pieceType) {
      case 'p':
        const direction = piece[0] === 'w' ? -1 : 1
        const oneStep = fromRow + direction
        
        if (oneStep >= 0 && oneStep < 8 && !board[oneStep][fromCol]) {
          moves.push(String.fromCharCode(97 + fromCol) + (8 - oneStep))
          
          const startRow = piece[0] === 'w' ? 6 : 1
          if (fromRow === startRow) {
            const twoStep = fromRow + 2 * direction
            if (twoStep >= 0 && twoStep < 8 && !board[twoStep][fromCol]) {
              moves.push(String.fromCharCode(97 + fromCol) + (8 - twoStep))
            }
          }
        }
        
        for (const colOffset of [-1, 1]) {
          const captureCol = fromCol + colOffset
          const captureRow = fromRow + direction
          if (captureCol >= 0 && captureCol < 8 && captureRow >= 0 && captureRow < 8) {
            const target = board[captureRow][captureCol]
            if (target && target[0] !== piece[0]) {
              moves.push(String.fromCharCode(97 + captureCol) + (8 - captureRow))
            }
          }
        }
        break
        
      case 'r':
        for (const [dRow, dCol] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          for (let i = 1; i < 8; i++) {
            const newRow = fromRow + i * dRow
            const newCol = fromCol + i * dCol
            
            if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break
            
            const target = board[newRow][newCol]
            if (target) {
              if (target[0] !== piece[0]) {
                moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
              }
              break
            } else {
              moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
            }
          }
        }
        break
        
      case 'n':
        for (const [dRow, dCol] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
          const newRow = fromRow + dRow
          const newCol = fromCol + dCol
          
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const target = board[newRow][newCol]
            if (!target || target[0] !== piece[0]) {
              moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
            }
          }
        }
        break
        
      case 'b':
        for (const [dRow, dCol] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          for (let i = 1; i < 8; i++) {
            const newRow = fromRow + i * dRow
            const newCol = fromCol + i * dCol
            
            if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break
            
            const target = board[newRow][newCol]
            if (target) {
              if (target[0] !== piece[0]) {
                moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
              }
              break
            } else {
              moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
            }
          }
        }
        break
        
      case 'q':
        for (const [dRow, dCol] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          for (let i = 1; i < 8; i++) {
            const newRow = fromRow + i * dRow
            const newCol = fromCol + i * dCol
            
            if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break
            
            const target = board[newRow][newCol]
            if (target) {
              if (target[0] !== piece[0]) {
                moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
              }
              break
            } else {
              moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
            }
          }
        }
        break
        
      case 'k':
        for (const [dRow, dCol] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
          const newRow = fromRow + dRow
          const newCol = fromCol + dCol
          
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const target = board[newRow][newCol]
            if (!target || target[0] !== piece[0]) {
              moves.push(String.fromCharCode(97 + newCol) + (8 - newRow))
            }
          }
        }
        break
    }
    
    return moves
  }

  setPosition(fen: string): void {
    this.position = fen
  }

  parseBoard(): (string | null)[][] {
    const boardFen = this.position.split(' ')[0]
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
    
    let row = 0, col = 0
    for (const char of boardFen) {
      if (char === '/') {
        row++
        col = 0
      } else if (char >= '1' && char <= '8') {
        col += parseInt(char)
      } else {
        const pieceColor = char === char.toUpperCase() ? 'w' : 'b'
        const pieceType = char.toLowerCase()
        board[row][col] = `${pieceColor}${pieceType}`
        col++
      }
    }
    
    return board
  }
}