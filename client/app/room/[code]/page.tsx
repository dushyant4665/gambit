'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
import { useOptimisticChess } from './useOptimisticChess'

export default function RoomPage() {
  const params = useParams()
  const roomCode = params.code as string
  
  const {
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
  } = useOptimisticChess(roomCode)
  
  const [showPlayerJoinedPopup, setShowPlayerJoinedPopup] = useState(false)
  const [showGameOverPopup, setShowGameOverPopup] = useState(false)
  const [gameOverData, setGameOverData] = useState<{type: 'checkmate' | 'stalemate' | 'draw', winner?: string}>({type: 'checkmate'})
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (gameState.gameStatus === 'checkmate' && !showGameOverPopup) {
      const winnerName = gameState.activeColor === 'w' ? gameState.playerNames.black : gameState.playerNames.white
      setGameOverData({type: 'checkmate', winner: winnerName})
      setShowGameOverPopup(true)
    } else if (gameState.gameStatus === 'stalemate' && !showGameOverPopup) {
      setGameOverData({type: 'stalemate'})
      setShowGameOverPopup(true)
    } else if (gameState.gameStatus === 'draw' && !showGameOverPopup) {
      setGameOverData({type: 'draw'})
      setShowGameOverPopup(true)
    }
  }, [gameState.gameStatus, gameState.activeColor, gameState.playerNames, showGameOverPopup])

  useEffect(() => {
    const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
    const isCreator = createdRooms.includes(roomCode)
    const popupShown = localStorage.getItem(`popup_shown_${roomCode}`) === 'true'
    
    if (isCreator && gameState.playerCount === 2 && gameState.gameStarted && !popupShown && !showGameOverPopup) {
      setShowPlayerJoinedPopup(true)
      localStorage.setItem(`popup_shown_${roomCode}`, 'true')
      setTimeout(() => setShowPlayerJoinedPopup(false), 3000)
    }
  }, [gameState.playerCount, gameState.gameStarted, roomCode, showGameOverPopup])

  return (
    <main className="min-h-screen bg-dark-bg p-2 sm:p-4">
      {!connected && (
        <div className="fixed top-2 left-2 bg-red-600 text-white px-3 py-1 rounded text-sm z-50">
          Connecting...
        </div>
      )}

      {connected && gameState.gameStarted && (
        <div className={`fixed top-2 left-2 text-white px-3 py-1 rounded text-sm z-50 ${
          gameState.gameStatus === 'checkmate' ? 'bg-red-600' :
          gameState.gameStatus === 'stalemate' || gameState.gameStatus === 'draw' ? 'bg-yellow-600' :
          'bg-blue-600'
        }`}>
          {gameState.gameStatus === 'checkmate' ? '👑 Checkmate!' :
           gameState.gameStatus === 'stalemate' ? '🤝 Stalemate!' :
           gameState.gameStatus === 'draw' ? '🤝 Draw!' :
           isPending ? '⏳ Move pending...' : '📱 Tap piece → Tap destination'}
        </div>
      )}

      {/* Fullscreen Toggle Button */}
      {connected && gameState.gameStarted && (
        <div className="fixed bottom-2 right-2 z-50 sm:hidden">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-xl border border-gray-600 transition-all duration-300"
          >
            {isFullscreen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
          </button>
        </div>
      )}

      {showPlayerJoinedPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-surface p-6 rounded-lg border border-dark-border max-w-sm mx-4">
            <h3 className="text-xl font-bold text-dark-text mb-2">Player Connected!</h3>
            <p className="text-dark-text/70 mb-4">{gameState.playerNames.black} has joined the game. You can start playing!</p>
          </div>
        </div>
      )}

      {showGameOverPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-surface p-8 rounded-lg border border-dark-border max-w-md mx-4 text-center">
            <div className="text-6xl mb-4">👑</div>
            <h2 className="text-2xl font-bold text-dark-text mb-2">
              {gameOverData.type === 'checkmate' ? 'Checkmate!' : 
               gameOverData.type === 'stalemate' ? 'Stalemate!' : 'Draw!'}
            </h2>
            <p className="text-lg text-dark-accent mb-4">
              {gameOverData.type === 'checkmate' ? `${gameOverData.winner} Wins!` : 'Game Drawn!'}
            </p>
            <p className="text-dark-text/70 mb-6">
              {gameOverData.type === 'checkmate' ? `The game is over. ${gameOverData.winner} has achieved checkmate!` :
               gameOverData.type === 'stalemate' ? 'The game is drawn due to stalemate.' :
               'The game is drawn.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowGameOverPopup(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Close
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-dark-accent hover:bg-dark-accent/80 text-white px-6 py-2 rounded-lg font-medium"
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}
      
        <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50">
          <a 
            href="https://github.com/dushyant4665/gambit" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-black hover:bg-gray-900 text-white p-2 sm:p-3 rounded-lg shadow-xl border border-gray-600 hover:border-white transition-all duration-300 hover:scale-105 flex items-center justify-center"
          >
            <svg width="20" height="20" className="sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      
      <div className={`${isFullscreen ? 'fixed inset-0 bg-dark-bg z-40 flex items-center justify-center' : 'max-w-7xl mx-auto'}`}>
        {!isFullscreen && (
          <div className="text-center mb-1 sm:mb-6 px-2">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-dark-text mb-1 sm:mb-2">Room: {roomCode}</h1>
          <p className="text-xs sm:text-base text-dark-text/70 mb-1 sm:mb-2">
            {!gameState.gameStarted 
              ? 'Waiting for Player 2...'
              : gameState.gameStatus === 'checkmate' 
              ? `🏆 Checkmate! ${gameState.activeColor === 'w' ? gameState.playerNames.black : gameState.playerNames.white} Wins!`
              : gameState.gameStatus === 'stalemate'
              ? '🤝 Stalemate - Game Drawn!'
              : gameState.gameStatus === 'draw'
              ? '🤝 Draw!'
              : `${gameState.activeColor === 'w' ? gameState.playerNames.white : gameState.playerNames.black}'s turn`
            }
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-4 mt-1 sm:mt-2">
            <p className="text-xs text-dark-text/50">
              You are <span className="font-semibold text-dark-accent">{playerColor === 'white' ? gameState.playerNames.white : gameState.playerNames.black} ({playerColor === 'white' ? 'White' : 'Black'})</span>
            </p>
            <div className="text-xs text-dark-text/40">
              {gameState.playerCount < 2 ? 'Waiting for Player 2...' : '2 players connected'}
            </div>
          </div>
        </div>
        )}

        <div className={`${isFullscreen ? 'w-full h-full flex items-center justify-center p-2' : 'flex flex-col xl:flex-row gap-2 lg:gap-6 items-start justify-center px-2'}`}>
          <div className={`${isFullscreen ? 'w-full max-w-none aspect-square max-h-full' : 'flex-shrink-0 w-full max-w-[500px] mx-auto xl:mx-0'}`}>
             {/* Opponent Player - Top */}
             {!isFullscreen && (
               <div className="flex items-center justify-center mb-1 sm:mb-4 p-2 bg-dark-surface rounded-lg border border-dark-border">
               <div className="flex items-center gap-2">
                 <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                   playerColor === 'white' ? 'bg-gray-800' : 'bg-white'
                 }`}>
                   <span className={`text-xs ${
                     playerColor === 'white' ? 'text-white' : 'text-black'
                   }`}>
                     {playerColor === 'white' ? '♛' : '♔'}
                   </span>
                 </div>
                 <div>
                   <p className="text-dark-text font-semibold text-sm">
                     {playerColor === 'white' ? gameState.playerNames.black : gameState.playerNames.white}
                   </p>
                   <p className="text-dark-text/60 text-xs">
                     Playing as {playerColor === 'white' ? 'Black' : 'White'}
                   </p>
                 </div>
               </div>
             </div>
             )}
            
            <div 
              className={`chessboard-container w-full aspect-square mx-auto ${
                isFullscreen 
                  ? 'max-w-none max-h-[100vh] h-[100vh]' 
                  : 'max-w-[280px] sm:max-w-[400px] md:max-w-[500px]'
              }`}
              style={{ 
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none'
              }}
            >
              <Chessboard
                position={gameState.position}
                onPieceDrop={handleDrop}
                onSquareClick={handleSquareClick}
                boardOrientation={playerColor === 'white' ? 'white' : 'black'}
                arePiecesDraggable={gameState.gameStarted && connected}
                isDraggablePiece={isDraggablePiece}
                customDarkSquareStyle={{ backgroundColor: '#8b4513' }}
                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
                customSquareStyles={getSquareStyles()}
                areArrowsAllowed={false}
                showBoardNotation={true}
                animationDuration={0}
                snapToCursor={true}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}
              />
            </div>
            
             {/* Current Player - Bottom */}
             {!isFullscreen && (
               <div className="flex items-center justify-center mt-1 sm:mt-4 p-2 bg-dark-surface rounded-lg border border-dark-border">
               <div className="flex items-center gap-2">
                 <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                   playerColor === 'white' ? 'bg-white' : 'bg-gray-800'
                 }`}>
                   <span className={`text-xs ${
                     playerColor === 'white' ? 'text-black' : 'text-white'
                   }`}>
                     {playerColor === 'white' ? '♔' : '♛'}
                   </span>
                 </div>
                 <div>
                   <p className="text-dark-text font-semibold text-sm">
                     {playerColor === 'white' ? gameState.playerNames.white : gameState.playerNames.black}
                   </p>
                   <p className="text-dark-text/60 text-xs">
                     Playing as {playerColor === 'white' ? 'White' : 'Black'} (You)
                   </p>
                 </div>
               </div>
             </div>
             )}
          </div>

          {!isFullscreen && (
            <div className="w-full xl:w-80 bg-dark-surface rounded-lg p-3 border border-dark-border mt-2 xl:mt-0">
            <h3 className="text-base font-semibold text-dark-text mb-3">Game Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-text/70">Status:</span>
                <span className="text-dark-text">{connected ? 'Connected' : 'Connecting...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text/70">Players:</span>
                <span className="text-dark-text">{gameState.playerCount}/2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text/70">Moves:</span>
                <span className="text-dark-text">{gameState.moveCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text/70">Your Turn:</span>
                <span className={`${isPlayerTurn ? 'text-green-400' : 'text-red-400'}`}>
                  {isPlayerTurn ? 'Yes' : 'No'}
                      </span>
                    </div>
              {gameState.gameStatus !== 'waiting' && (
                <div className="flex justify-between">
                  <span className="text-dark-text/70">Game Status:</span>
                  <span className="text-dark-text capitalize">{gameState.gameStatus}</span>
                </div>
              )}
            </div>
            
            {!gameState.gameStarted && (
              <div className="mt-4 p-3 bg-blue-600/20 rounded border border-blue-600/30">
                <p className="text-blue-300 text-sm text-center">
                  {gameState.playerCount < 2 ? 'Waiting for opponent...' : 'Game starting...'}
                </p>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

    </main>
  )
}