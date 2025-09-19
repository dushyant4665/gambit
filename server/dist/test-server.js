"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ChessEngine_1 = require("./ChessEngine");
const utils_1 = require("./utils");
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.CLIENT_URL || 'https://gambitt.vercel.app']
        : ['http://localhost:3000'],
    credentials: true
}));
app.use(express_1.default.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});
const activeGames = new Map();
const roomConnections = new Map();
function algebraicToPosition(square) {
    return {
        row: 8 - parseInt(square[1]),
        col: square.charCodeAt(0) - 'a'.charCodeAt(0)
    };
}
function positionToAlgebraic(pos) {
    return String.fromCharCode('a'.charCodeAt(0) + pos.col) + (8 - pos.row);
}
app.post('/api/rooms', async (req, res) => {
    try {
        const { player_name } = req.body;
        let code;
        let attempts = 0;
        const maxAttempts = 10;
        do {
            code = (0, utils_1.generateRoomCode)();
            attempts++;
            if (attempts > maxAttempts) {
                return res.status(500).json({ error: 'Failed to generate unique room code' });
            }
            const { data: existingRoom } = await supabase
                .from('rooms')
                .select('code')
                .eq('code', code)
                .single();
            if (!existingRoom)
                break;
        } while (attempts <= maxAttempts);
        const { data: room, error } = await supabase
            .from('rooms')
            .insert({
            code,
            white_player_name: player_name || 'Player 1',
            white_assigned: true,
            status: 'waiting'
        })
            .select()
            .single();
        if (error) {
            console.error('Database error creating room:', error);
            return res.status(500).json({ error: 'Failed to create room' });
        }
        activeGames.set(code, new ChessEngine_1.ChessEngine());
        roomConnections.set(code, new Set());
        console.log(`Room ${code} created with ID ${room.id}`);
        res.json({ code, roomId: room.id });
    }
    catch (error) {
        console.error('Error in POST /api/rooms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/api/rooms/:code', async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) {
            return res.status(400).json({ error: 'Room code required' });
        }
        const { data: room } = await supabase
            .from('rooms')
            .select('id, code, status')
            .eq('code', code.toUpperCase())
            .single();
        if (room && !activeGames.has(code)) {
            const engine = new ChessEngine_1.ChessEngine();
            const { data: moves } = await supabase
                .from('moves')
                .select('*')
                .eq('room_id', room.id)
                .order('move_number', { ascending: true });
            if (moves) {
                moves.forEach((move) => {
                    const fromPos = algebraicToPosition(move.from_square);
                    const toPos = algebraicToPosition(move.to_square);
                    engine.makeMove(fromPos, toPos, move.promotion);
                });
            }
            activeGames.set(code, engine);
        }
        res.json({
            exists: !!room,
            status: room?.status || null
        });
    }
    catch (error) {
        console.error('Error in GET /api/rooms/:code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/rooms/:code/join', async (req, res) => {
    try {
        const { code } = req.params;
        const { player_id, player_name } = req.body;
        if (!player_id) {
            return res.status(400).json({ error: 'Player ID required' });
        }
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();
        if (roomError || !room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        let updateData = {};
        let playerCount = 1;
        if (player_id === 'creator') {
            updateData.white_player_name = player_name || room.white_player_name || 'Player 1';
            updateData.white_assigned = true;
            if (room.black_assigned)
                playerCount = 2;
        }
        else {
            updateData.black_player_name = player_name || 'Player 2';
            updateData.black_assigned = true;
            playerCount = 2;
            if (room.white_assigned) {
                updateData.status = 'playing';
                console.log(`🎮 Room ${code}: Game starting! White: ${room.white_player_name}, Black: ${player_name}`);
            }
        }
        const { error: updateError } = await supabase
            .from('rooms')
            .update(updateData)
            .eq('id', room.id);
        if (updateError) {
            console.error('Error updating room:', updateError);
            return res.status(500).json({ error: 'Failed to join room' });
        }
        const connections = roomConnections.get(code) || new Set();
        connections.add(player_id);
        roomConnections.set(code, connections);
        console.log(`Player ${player_id} (${player_name}) joined room ${code}. Players: ${playerCount}`);
        res.json({
            success: true,
            playerCount,
            gameStarted: updateData.status === 'playing'
        });
    }
    catch (error) {
        console.error('Error in POST /api/rooms/:code/join:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/moves', async (req, res) => {
    try {
        const { room_code, from, to, promotion, player_id } = req.body;
        if (!room_code || !from || !to || !player_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', room_code.toUpperCase())
            .single();
        if (roomError || !room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        if (room.status !== 'playing') {
            return res.status(400).json({
                success: false,
                error: 'Game not started yet'
            });
        }
        let engine = activeGames.get(room_code);
        if (!engine) {
            engine = new ChessEngine_1.ChessEngine();
            const { data: moves } = await supabase
                .from('moves')
                .select('*')
                .eq('room_id', room.id)
                .order('move_number', { ascending: true });
            if (moves) {
                moves.forEach((move) => {
                    const fromPos = algebraicToPosition(move.from_square);
                    const toPos = algebraicToPosition(move.to_square);
                    engine.makeMove(fromPos, toPos, move.promotion);
                });
            }
            activeGames.set(room_code, engine);
        }
        const gameState = engine.getGameState();
        const currentTurn = gameState.activeColor;
        const isRoomCreator = player_id === 'creator';
        const playerColor = isRoomCreator ? 'w' : 'b';
        console.log(`Move request: player=${player_id}, playerColor=${playerColor}, currentTurn=${currentTurn}, moveCount=${gameState.moveHistory.length}`);
        if (!engine.isGameOver() && currentTurn !== playerColor) {
            console.log(`Turn validation failed: expected ${playerColor}, got ${currentTurn}`);
            return res.status(400).json({
                success: false,
                error: currentTurn === 'w' ? 'It is white\'s turn' : 'It is black\'s turn'
            });
        }
        const fromPos = algebraicToPosition(from);
        const toPos = algebraicToPosition(to);
        const board = engine.getBoard();
        const piece = board[fromPos.row][fromPos.col];
        if (!piece) {
            return res.status(400).json({
                success: false,
                error: 'No piece at source square'
            });
        }
        if (piece[0] !== playerColor) {
            return res.status(400).json({
                success: false,
                error: 'You can only move your own pieces'
            });
        }
        const moveObj = engine.makeMove(fromPos, toPos, promotion);
        if (!moveObj) {
            console.log(`Invalid move: ${from} to ${to}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid move'
            });
        }
        console.log(`Move successful: ${from} to ${to}, new active color: ${engine.getActiveColor()}`);
        const { count: moveCount } = await supabase
            .from('moves')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id);
        const currentMoveNumber = (moveCount || 0) + 1;
        let gameStatus = 'ongoing';
        let winner = null;
        if (engine.isCheckmate()) {
            gameStatus = 'checkmate';
            winner = playerColor;
        }
        else if (engine.isStalemate()) {
            gameStatus = 'stalemate';
            winner = 'd';
        }
        else if (engine.isDraw()) {
            gameStatus = 'draw';
            winner = 'd';
        }
        else if (engine.isCheck()) {
            gameStatus = 'check';
        }
        const san = `${piece.substring(1).toUpperCase() === 'P' ? '' : piece.substring(1).toUpperCase()}${to}${engine.isCheck() ? '+' : ''}${engine.isCheckmate() ? '#' : ''}`;
        const { data: newMove, error: moveError } = await supabase
            .from('moves')
            .insert({
            room_id: room.id,
            move_number: currentMoveNumber,
            color: playerColor,
            from_square: from,
            to_square: to,
            piece: piece,
            captured_piece: null,
            promotion: promotion || null,
            san: san,
            is_check: engine.isCheck(),
            is_checkmate: engine.isCheckmate(),
            fen_after: engine.exportFEN()
        })
            .select()
            .single();
        if (moveError) {
            console.error('Error storing move in database:', moveError);
            return res.status(500).json({
                success: false,
                error: 'Failed to store move'
            });
        }
        if (gameStatus !== 'ongoing' && gameStatus !== 'check') {
            await supabase
                .from('rooms')
                .update({
                status: 'finished',
                winner: winner,
                current_fen: engine.exportFEN(),
                current_turn: engine.getActiveColor()
            })
                .eq('id', room.id);
        }
        else {
            await supabase
                .from('rooms')
                .update({
                current_fen: engine.exportFEN(),
                current_turn: engine.getActiveColor()
            })
                .eq('id', room.id);
        }
        res.json({
            success: true,
            move: {
                id: newMove.id,
                from,
                to,
                piece,
                promotion,
                san,
                moveNumber: currentMoveNumber,
                gameStatus,
                activeColor: engine.getActiveColor(),
                fen: engine.exportFEN(),
                isCheck: engine.isCheck(),
                isCheckmate: engine.isCheckmate()
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
app.get('/api/rooms/:code/state', async (req, res) => {
    try {
        const { code } = req.params;
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();
        if (roomError || !room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        let engine = activeGames.get(code);
        if (!engine) {
            engine = new ChessEngine_1.ChessEngine();
            const { data: moves } = await supabase
                .from('moves')
                .select('*')
                .eq('room_id', room.id)
                .order('move_number', { ascending: true });
            if (moves) {
                moves.forEach((move) => {
                    const fromPos = algebraicToPosition(move.from_square);
                    const toPos = algebraicToPosition(move.to_square);
                    engine.makeMove(fromPos, toPos, move.promotion);
                });
            }
            activeGames.set(code, engine);
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
        const connections = roomConnections.get(code) || new Set();
        const playerCount = Math.max(1, connections.size);
        const responseData = {
            fen,
            activeColor: engine.getActiveColor(),
            gameStatus: status,
            moveCount: gameState.moveHistory.length,
            playerCount: room.black_assigned ? 2 : 1,
            gameStarted: room.status === 'playing',
            playerNames: {
                white: room.white_player_name || 'Player 1',
                black: room.black_player_name || 'Player 2'
            }
        };
        console.log(`State request for room ${code}: activeColor=${responseData.activeColor}, moveCount=${responseData.moveCount}, status=${room.status}`);
        res.json(responseData);
    }
    catch (error) {
        console.error('Error in GET /api/rooms/:code/state:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/rooms/:code/valid-moves', async (req, res) => {
    try {
        const { code } = req.params;
        const { square, player_id } = req.body;
        if (!square || !player_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();
        if (roomError || !room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        let engine = activeGames.get(code);
        if (!engine) {
            engine = new ChessEngine_1.ChessEngine();
            const { data: moves } = await supabase
                .from('moves')
                .select('*')
                .eq('room_id', room.id)
                .order('move_number', { ascending: true });
            if (moves) {
                moves.forEach((move) => {
                    const fromPos = algebraicToPosition(move.from_square);
                    const toPos = algebraicToPosition(move.to_square);
                    engine.makeMove(fromPos, toPos, move.promotion);
                });
            }
            activeGames.set(code, engine);
        }
        const gameState = engine.getGameState();
        const currentTurn = gameState.activeColor;
        const isRoomCreator = player_id === 'creator';
        const playerColor = isRoomCreator ? 'w' : 'b';
        if (!engine.isGameOver() && currentTurn !== playerColor) {
            return res.json({ validMoves: [] });
        }
        const fromPos = algebraicToPosition(square);
        const piece = engine.getBoard()[fromPos.row][fromPos.col];
        if (!piece || piece[0] !== playerColor) {
            return res.json({ validMoves: [] });
        }
        const validMoves = engine.getValidMovesForPiece(fromPos);
        const validSquares = validMoves.map(pos => positionToAlgebraic(pos));
        res.json({ validMoves: validSquares });
    }
    catch (error) {
        console.error('Error getting valid moves:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/test', async (req, res) => {
    try {
        const { data: rooms } = await supabase
            .from('rooms')
            .select('code, status')
            .limit(10);
        res.json({
            message: 'Chess API is working!',
            rooms: rooms || [],
            activeGames: Array.from(activeGames.keys()),
            environment: process.env.NODE_ENV || 'development'
        });
    }
    catch (error) {
        res.json({
            message: 'Chess API is working!',
            rooms: [],
            activeGames: Array.from(activeGames.keys()),
            error: 'Database connection issue'
        });
    }
});
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Chess Server running on port ${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📋 Endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /test - API status`);
    console.log(`   POST /api/rooms - Create room`);
    console.log(`   GET  /api/rooms/:code - Check room`);
    console.log(`   POST /api/rooms/:code/join - Join room`);
    console.log(`   GET  /api/rooms/:code/state - Get game state`);
    console.log(`   POST /api/moves - Make move`);
    console.log(`   POST /api/rooms/:code/valid-moves - Get valid moves`);
});
