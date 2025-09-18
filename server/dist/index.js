"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ChessEngine_1 = require("./ChessEngine");
const supabase_1 = require("./supabase");
const utils_1 = require("./utils");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Store active games in memory for move validation
const activeGames = new Map();
// Create a new room
app.post('/api/rooms', async (req, res) => {
    try {
        let code;
        let attempts = 0;
        const maxAttempts = 10;
        // Generate unique room code
        do {
            code = (0, utils_1.generateRoomCode)();
            attempts++;
            if (attempts > maxAttempts) {
                return res.status(500).json({ error: 'Failed to generate unique room code' });
            }
            const { data: existingRoom } = await supabase_1.supabase
                .from('rooms')
                .select('code')
                .eq('code', code)
                .single();
            if (!existingRoom)
                break;
        } while (true);
        // Create room in database
        const { error } = await supabase_1.supabase
            .from('rooms')
            .insert({ code });
        if (error) {
            console.error('Error creating room:', error);
            return res.status(500).json({ error: 'Failed to create room' });
        }
        // Initialize chess game for this room
        activeGames.set(code, new ChessEngine_1.ChessEngine());
        res.json({ code });
    }
    catch (error) {
        console.error('Error in POST /api/rooms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Check if room exists
app.get('/api/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { data: room } = await supabase_1.supabase
            .from('rooms')
            .select('code')
            .eq('code', code)
            .single();
        if (room) {
            // Initialize chess game if not already present
            if (!activeGames.has(code)) {
                const engine = new ChessEngine_1.ChessEngine();
                // Load existing moves
                const { data: moves } = await supabase_1.supabase
                    .from('moves')
                    .select('*')
                    .eq('room_code', code)
                    .order('move_number', { ascending: true });
                if (moves) {
                    moves.forEach((move) => {
                        const from = {
                            row: 8 - parseInt(move.from_sq[1]),
                            col: move.from_sq.charCodeAt(0) - 'a'.charCodeAt(0)
                        };
                        const to = {
                            row: 8 - parseInt(move.to_sq[1]),
                            col: move.to_sq.charCodeAt(0) - 'a'.charCodeAt(0)
                        };
                        engine.makeMove(from, to, move.promotion);
                    });
                }
                activeGames.set(code, engine);
            }
        }
        res.json({ exists: !!room });
    }
    catch (error) {
        console.error('Error in GET /api/rooms/:code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Helper function to convert algebraic notation to Position
function algebraicToPosition(square) {
    return {
        row: 8 - parseInt(square[1]),
        col: square.charCodeAt(0) - 'a'.charCodeAt(0)
    };
}
// Helper function to convert Position to algebraic notation
function positionToAlgebraic(pos) {
    return String.fromCharCode('a'.charCodeAt(0) + pos.col) + (8 - pos.row);
}
// Make a move
app.post('/api/moves', async (req, res) => {
    try {
        const { room_code, from, to, promotion } = req.body;
        if (!room_code || !from || !to) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Get chess game instance
        let engine = activeGames.get(room_code);
        if (!engine) {
            // Initialize if not found
            engine = new ChessEngine_1.ChessEngine();
            // Load existing moves
            const { data: moves } = await supabase_1.supabase
                .from('moves')
                .select('*')
                .eq('room_code', room_code)
                .order('move_number', { ascending: true });
            if (moves) {
                moves.forEach((move) => {
                    const fromPos = algebraicToPosition(move.from_sq);
                    const toPos = algebraicToPosition(move.to_sq);
                    engine.makeMove(fromPos, toPos, move.promotion);
                });
            }
            activeGames.set(room_code, engine);
        }
        // Convert algebraic notation to positions
        const fromPos = algebraicToPosition(from);
        const toPos = algebraicToPosition(to);
        // Get piece before move for storage
        const board = engine.getBoard();
        const piece = board[fromPos.row][fromPos.col];
        if (!piece) {
            return res.status(400).json({
                success: false,
                error: 'No piece at source square'
            });
        }
        // Validate and make move
        const move = engine.makeMove(fromPos, toPos, promotion);
        if (!move) {
            return res.status(400).json({
                success: false,
                error: 'Invalid move'
            });
        }
        // Get current move number
        const gameState = engine.getGameState();
        const moveNumber = gameState.moveHistory.length;
        // Store move in database
        const { error } = await supabase_1.supabase
            .from('moves')
            .insert({
            room_code,
            move_number: moveNumber,
            from_sq: from,
            to_sq: to,
            piece,
            promotion: promotion || null,
            san: null // We can generate SAN later if needed
        });
        if (error) {
            console.error('Error storing move:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to store move'
            });
        }
        // Check game status
        let gameStatus = 'ongoing';
        if (engine.isCheckmate()) {
            gameStatus = 'checkmate';
        }
        else if (engine.isStalemate()) {
            gameStatus = 'stalemate';
        }
        else if (engine.isDraw()) {
            gameStatus = 'draw';
        }
        else if (engine.isCheck()) {
            gameStatus = 'check';
        }
        res.json({
            success: true,
            move: {
                from,
                to,
                piece,
                promotion,
                moveNumber,
                gameStatus,
                activeColor: engine.getActiveColor(),
                fen: engine.exportFEN()
            }
        });
    }
    catch (error) {
        console.error('Error in POST /api/moves:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get current game state
app.get('/api/rooms/:code/state', async (req, res) => {
    try {
        const { code } = req.params;
        const engine = activeGames.get(code);
        if (!engine) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const gameState = engine.getGameState();
        const fen = engine.exportFEN();
        let status = 'ongoing';
        if (engine.isCheckmate()) {
            status = 'checkmate';
        }
        else if (engine.isStalemate()) {
            status = 'stalemate';
        }
        else if (engine.isDraw()) {
            status = 'draw';
        }
        else if (engine.isCheck()) {
            status = 'check';
        }
        res.json({
            fen,
            activeColor: engine.getActiveColor(),
            gameStatus: status,
            moveCount: gameState.moveHistory.length
        });
    }
    catch (error) {
        console.error('Error in GET /api/rooms/:code/state:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
