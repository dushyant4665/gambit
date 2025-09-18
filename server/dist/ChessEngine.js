"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChessEngine = void 0;
class ChessEngine {
    constructor() {
        this.state = this.getInitialGameState();
    }
    getInitialGameState() {
        const board = [
            ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
            ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
            ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
        ];
        return {
            board,
            activeColor: 'w',
            castlingRights: {
                whiteKingside: true,
                whiteQueenside: true,
                blackKingside: true,
                blackQueenside: true
            },
            enPassantTarget: null,
            halfMoveClock: 0,
            fullMoveNumber: 1,
            moveHistory: []
        };
    }
    loadFEN(fen) {
        const parts = fen.split(' ');
        if (parts.length !== 6) {
            throw new Error('Invalid FEN string');
        }
        const [boardStr, activeColor, castling, enPassant, halfMove, fullMove] = parts;
        // Parse board
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const rows = boardStr.split('/');
        for (let row = 0; row < 8; row++) {
            let col = 0;
            for (const char of rows[row]) {
                if (char >= '1' && char <= '8') {
                    col += parseInt(char);
                }
                else {
                    const color = char === char.toLowerCase() ? 'b' : 'w';
                    const piece = char.toLowerCase();
                    board[row][col] = `${color}${piece}`;
                    col++;
                }
            }
        }
        // Parse castling rights
        const castlingRights = {
            whiteKingside: castling.includes('K'),
            whiteQueenside: castling.includes('Q'),
            blackKingside: castling.includes('k'),
            blackQueenside: castling.includes('q')
        };
        // Parse en passant
        let enPassantTarget = null;
        if (enPassant !== '-') {
            const col = enPassant.charCodeAt(0) - 'a'.charCodeAt(0);
            const row = 8 - parseInt(enPassant[1]);
            enPassantTarget = { row, col };
        }
        this.state = {
            board,
            activeColor: activeColor,
            castlingRights,
            enPassantTarget,
            halfMoveClock: parseInt(halfMove),
            fullMoveNumber: parseInt(fullMove),
            moveHistory: []
        };
    }
    exportFEN() {
        const { board, activeColor, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber } = this.state;
        // Board
        let boardStr = '';
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece === null) {
                    emptyCount++;
                }
                else {
                    if (emptyCount > 0) {
                        boardStr += emptyCount;
                        emptyCount = 0;
                    }
                    const [color, type] = piece;
                    boardStr += color === 'w' ? type.toUpperCase() : type.toLowerCase();
                }
            }
            if (emptyCount > 0) {
                boardStr += emptyCount;
            }
            if (row < 7)
                boardStr += '/';
        }
        // Castling
        let castling = '';
        if (castlingRights.whiteKingside)
            castling += 'K';
        if (castlingRights.whiteQueenside)
            castling += 'Q';
        if (castlingRights.blackKingside)
            castling += 'k';
        if (castlingRights.blackQueenside)
            castling += 'q';
        if (castling === '')
            castling = '-';
        // En passant
        let enPassant = '-';
        if (enPassantTarget) {
            const file = String.fromCharCode('a'.charCodeAt(0) + enPassantTarget.col);
            const rank = (8 - enPassantTarget.row).toString();
            enPassant = file + rank;
        }
        return `${boardStr} ${activeColor} ${castling} ${enPassant} ${halfMoveClock} ${fullMoveNumber}`;
    }
    makeMove(from, to, promotion) {
        const piece = this.state.board[from.row][from.col];
        if (!piece)
            return null;
        const [pieceColor] = piece;
        if (pieceColor !== this.state.activeColor)
            return null;
        if (!this.isMoveValid(from, to, promotion))
            return null;
        const capturedPiece = this.state.board[to.row][to.col];
        const move = { from, to, piece, capturedPiece, promotion };
        // Handle special moves
        const [, pieceType] = piece;
        // En passant
        if (pieceType === 'p' && this.state.enPassantTarget &&
            to.row === this.state.enPassantTarget.row && to.col === this.state.enPassantTarget.col) {
            move.isEnPassant = true;
            const capturedPawnRow = pieceColor === 'w' ? to.row + 1 : to.row - 1;
            move.capturedPiece = this.state.board[capturedPawnRow][to.col];
            this.state.board[capturedPawnRow][to.col] = null;
        }
        // Castling
        if (pieceType === 'k' && Math.abs(to.col - from.col) === 2) {
            move.isCastling = true;
            move.castlingType = to.col > from.col ? 'kingside' : 'queenside';
            // Move rook
            const rookFromCol = to.col > from.col ? 7 : 0;
            const rookToCol = to.col > from.col ? 5 : 3;
            const rook = this.state.board[from.row][rookFromCol];
            this.state.board[from.row][rookFromCol] = null;
            this.state.board[from.row][rookToCol] = rook;
        }
        // Make the move
        this.state.board[to.row][to.col] = promotion ? `${pieceColor}${promotion}` : piece;
        this.state.board[from.row][from.col] = null;
        // Update game state
        this.updateGameState(move);
        return move;
    }
    updateGameState(move) {
        const { from, to, piece } = move;
        const [pieceColor, pieceType] = piece;
        // Update castling rights
        if (pieceType === 'k') {
            if (pieceColor === 'w') {
                this.state.castlingRights.whiteKingside = false;
                this.state.castlingRights.whiteQueenside = false;
            }
            else {
                this.state.castlingRights.blackKingside = false;
                this.state.castlingRights.blackQueenside = false;
            }
        }
        if (pieceType === 'r') {
            if (pieceColor === 'w') {
                if (from.row === 7 && from.col === 0)
                    this.state.castlingRights.whiteQueenside = false;
                if (from.row === 7 && from.col === 7)
                    this.state.castlingRights.whiteKingside = false;
            }
            else {
                if (from.row === 0 && from.col === 0)
                    this.state.castlingRights.blackQueenside = false;
                if (from.row === 0 && from.col === 7)
                    this.state.castlingRights.blackKingside = false;
            }
        }
        // Update en passant target
        this.state.enPassantTarget = null;
        if (pieceType === 'p' && Math.abs(to.row - from.row) === 2) {
            this.state.enPassantTarget = {
                row: (from.row + to.row) / 2,
                col: from.col
            };
        }
        // Update clocks
        if (pieceType === 'p' || move.capturedPiece) {
            this.state.halfMoveClock = 0;
        }
        else {
            this.state.halfMoveClock++;
        }
        if (this.state.activeColor === 'b') {
            this.state.fullMoveNumber++;
        }
        // Switch active color
        this.state.activeColor = this.state.activeColor === 'w' ? 'b' : 'w';
        // Add to move history
        this.state.moveHistory.push(move);
    }
    isMoveValid(from, to, promotion) {
        const piece = this.state.board[from.row][from.col];
        if (!piece)
            return false;
        const [pieceColor, pieceType] = piece;
        // Can't capture own piece
        const targetPiece = this.state.board[to.row][to.col];
        if (targetPiece && targetPiece[0] === pieceColor)
            return false;
        // Check piece-specific movement rules
        if (!this.isPieceMovementValid(from, to, pieceType, pieceColor))
            return false;
        // Check if move would leave king in check
        const tempBoard = this.cloneBoard();
        tempBoard[to.row][to.col] = piece;
        tempBoard[from.row][from.col] = null;
        // Handle en passant capture
        if (pieceType === 'p' && this.state.enPassantTarget &&
            to.row === this.state.enPassantTarget.row && to.col === this.state.enPassantTarget.col) {
            const capturedPawnRow = pieceColor === 'w' ? to.row + 1 : to.row - 1;
            tempBoard[capturedPawnRow][to.col] = null;
        }
        // Handle castling
        if (pieceType === 'k' && Math.abs(to.col - from.col) === 2) {
            const rookFromCol = to.col > from.col ? 7 : 0;
            const rookToCol = to.col > from.col ? 5 : 3;
            const rook = tempBoard[from.row][rookFromCol];
            tempBoard[from.row][rookFromCol] = null;
            tempBoard[from.row][rookToCol] = rook;
        }
        return !this.isKingInCheck(pieceColor, tempBoard);
    }
    isPieceMovementValid(from, to, pieceType, pieceColor) {
        const dx = to.col - from.col;
        const dy = to.row - from.row;
        switch (pieceType) {
            case 'p':
                return this.isPawnMoveValid(from, to, pieceColor, dx, dy);
            case 'r':
                return this.isRookMoveValid(from, to, dx, dy);
            case 'n':
                return this.isKnightMoveValid(dx, dy);
            case 'b':
                return this.isBishopMoveValid(from, to, dx, dy);
            case 'q':
                return this.isQueenMoveValid(from, to, dx, dy);
            case 'k':
                return this.isKingMoveValid(from, to, pieceColor, dx, dy);
            default:
                return false;
        }
    }
    isPawnMoveValid(from, to, color, dx, dy) {
        const direction = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        // Forward move
        if (dx === 0) {
            if (dy === direction && !this.state.board[to.row][to.col])
                return true;
            if (dy === 2 * direction && from.row === startRow && !this.state.board[to.row][to.col] && !this.state.board[from.row + direction][from.col])
                return true;
        }
        // Capture
        if (Math.abs(dx) === 1 && dy === direction) {
            const targetPiece = this.state.board[to.row][to.col];
            if (targetPiece && targetPiece[0] !== color)
                return true;
            // En passant
            if (this.state.enPassantTarget &&
                to.row === this.state.enPassantTarget.row &&
                to.col === this.state.enPassantTarget.col) {
                return true;
            }
        }
        return false;
    }
    isRookMoveValid(from, to, dx, dy) {
        if (dx !== 0 && dy !== 0)
            return false;
        return this.isPathClear(from, to);
    }
    isKnightMoveValid(dx, dy) {
        return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
    }
    isBishopMoveValid(from, to, dx, dy) {
        if (Math.abs(dx) !== Math.abs(dy))
            return false;
        return this.isPathClear(from, to);
    }
    isQueenMoveValid(from, to, dx, dy) {
        const isRookMove = (dx === 0 || dy === 0);
        const isBishopMove = Math.abs(dx) === Math.abs(dy);
        return (isRookMove || isBishopMove) && this.isPathClear(from, to);
    }
    isKingMoveValid(from, to, color, dx, dy) {
        // Regular king move
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)
            return true;
        // Castling
        if (dy === 0 && Math.abs(dx) === 2) {
            return this.canCastle(color, dx > 0 ? 'kingside' : 'queenside');
        }
        return false;
    }
    canCastle(color, side) {
        const row = color === 'w' ? 7 : 0;
        const kingCol = 4;
        // Check castling rights
        if (color === 'w') {
            if (side === 'kingside' && !this.state.castlingRights.whiteKingside)
                return false;
            if (side === 'queenside' && !this.state.castlingRights.whiteQueenside)
                return false;
        }
        else {
            if (side === 'kingside' && !this.state.castlingRights.blackKingside)
                return false;
            if (side === 'queenside' && !this.state.castlingRights.blackQueenside)
                return false;
        }
        // King must not be in check
        if (this.isKingInCheck(color))
            return false;
        // Path must be clear and king must not pass through check
        const cols = side === 'kingside' ? [5, 6] : [3, 2, 1];
        const checkCols = side === 'kingside' ? [5, 6] : [3, 2];
        for (const col of cols) {
            if (this.state.board[row][col] !== null)
                return false;
        }
        for (const col of checkCols) {
            const tempBoard = this.cloneBoard();
            tempBoard[row][col] = tempBoard[row][kingCol];
            tempBoard[row][kingCol] = null;
            if (this.isKingInCheck(color, tempBoard))
                return false;
        }
        return true;
    }
    isPathClear(from, to) {
        const dx = Math.sign(to.col - from.col);
        const dy = Math.sign(to.row - from.row);
        let currentRow = from.row + dy;
        let currentCol = from.col + dx;
        while (currentRow !== to.row || currentCol !== to.col) {
            if (this.state.board[currentRow][currentCol] !== null)
                return false;
            currentRow += dy;
            currentCol += dx;
        }
        return true;
    }
    isCheck() {
        return this.isKingInCheck(this.state.activeColor);
    }
    isKingInCheck(color, board) {
        const currentBoard = board || this.state.board;
        // Find king position
        let kingPos = null;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = currentBoard[row][col];
                if (piece === `${color}k`) {
                    kingPos = { row, col };
                    break;
                }
            }
            if (kingPos)
                break;
        }
        if (!kingPos)
            return false;
        // Check if any opponent piece can attack the king
        const opponentColor = color === 'w' ? 'b' : 'w';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = currentBoard[row][col];
                if (piece && piece[0] === opponentColor) {
                    if (this.canPieceAttack({ row, col }, kingPos, piece[1], currentBoard)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    canPieceAttack(from, to, pieceType, board) {
        const dx = to.col - from.col;
        const dy = to.row - from.row;
        switch (pieceType) {
            case 'p':
                const direction = board[from.row][from.col][0] === 'w' ? -1 : 1;
                return Math.abs(dx) === 1 && dy === direction;
            case 'r':
                return (dx === 0 || dy === 0) && this.isPathClearForBoard(from, to, board);
            case 'n':
                return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
            case 'b':
                return Math.abs(dx) === Math.abs(dy) && this.isPathClearForBoard(from, to, board);
            case 'q':
                return ((dx === 0 || dy === 0) || (Math.abs(dx) === Math.abs(dy))) && this.isPathClearForBoard(from, to, board);
            case 'k':
                return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
            default:
                return false;
        }
    }
    isPathClearForBoard(from, to, board) {
        const dx = Math.sign(to.col - from.col);
        const dy = Math.sign(to.row - from.row);
        let currentRow = from.row + dy;
        let currentCol = from.col + dx;
        while (currentRow !== to.row || currentCol !== to.col) {
            if (board[currentRow][currentCol] !== null)
                return false;
            currentRow += dy;
            currentCol += dx;
        }
        return true;
    }
    isCheckmate() {
        if (!this.isCheck())
            return false;
        return this.getAllValidMoves().length === 0;
    }
    isStalemate() {
        if (this.isCheck())
            return false;
        return this.getAllValidMoves().length === 0;
    }
    isDraw() {
        // 50-move rule
        if (this.state.halfMoveClock >= 100)
            return true;
        // Insufficient material
        if (this.isInsufficientMaterial())
            return true;
        // Threefold repetition (simplified check)
        if (this.isThreefoldRepetition())
            return true;
        return false;
    }
    getAllValidMoves() {
        const moves = [];
        const color = this.state.activeColor;
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.state.board[fromRow][fromCol];
                if (piece && piece[0] === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            const from = { row: fromRow, col: fromCol };
                            const to = { row: toRow, col: toCol };
                            if (this.isMoveValid(from, to)) {
                                moves.push({ from, to, piece });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }
    isInsufficientMaterial() {
        const pieces = {};
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.state.board[row][col];
                if (piece) {
                    pieces[piece] = (pieces[piece] || 0) + 1;
                }
            }
        }
        const pieceCount = Object.values(pieces).reduce((sum, count) => sum + count, 0);
        // King vs King
        if (pieceCount === 2)
            return true;
        // King + Knight/Bishop vs King
        if (pieceCount === 3) {
            return pieces['wn'] === 1 || pieces['bn'] === 1 || pieces['wb'] === 1 || pieces['bb'] === 1;
        }
        return false;
    }
    isThreefoldRepetition() {
        const currentFEN = this.exportFEN().split(' ').slice(0, 4).join(' ');
        let count = 0;
        // This is a simplified check - in a full implementation, you'd track all positions
        for (const move of this.state.moveHistory) {
            // For now, just return false - full implementation would require position tracking
        }
        return false;
    }
    cloneBoard() {
        return this.state.board.map(row => [...row]);
    }
    getBoard() {
        return this.cloneBoard();
    }
    getActiveColor() {
        return this.state.activeColor;
    }
    getGameState() {
        return { ...this.state, board: this.cloneBoard() };
    }
    isGameOver() {
        return this.isCheckmate() || this.isStalemate() || this.isDraw();
    }
}
exports.ChessEngine = ChessEngine;
