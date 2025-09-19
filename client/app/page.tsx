'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      console.log('Creating room...')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ player_name: playerName.trim() }),
      })
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      
      const { code } = await response.json()
      console.log('Room created:', code)
      
      const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
      createdRooms.push(code)
      localStorage.setItem('createdRooms', JSON.stringify(createdRooms))
      localStorage.setItem(`player_name_${code}`, playerName.trim())
      
      router.push(`/room/${code}`)
    } catch (err) {
      console.error('Room creation error:', err)
      setError(`Failed to create room: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code')
      return
    }
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode.toUpperCase()}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          localStorage.setItem(`player_name_${roomCode.toUpperCase()}`, playerName.trim())
          router.push(`/room/${roomCode.toUpperCase()}`)
        } else {
          setError('Room not found')
        }
      } else {
        setError('Room not found')
      }
    } catch (err) {
      setError('Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50">
        <a 
          href="https://github.com/dushyant4665/gambit" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-black hover:bg-gray-900 text-white p-2 sm:p-3 rounded-lg shadow-xl border border-gray-600 hover:border-white transition-all duration-300 hover:scale-105 flex items-center justify-center"
        >
          <svg width="20" height="20" className="sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-dark-text mb-4">Gambit</h1>
          <p className="text-sm sm:text-base text-dark-text/70">Real-time multiplayer chess</p>
        </div>

        {!showCreateForm && !showJoinInput && (
          <div className="space-y-4">
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={loading}
              className="w-full bg-dark-accent hover:bg-dark-accent/80 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              Create Room
            </button>

            <button
              onClick={() => setShowJoinInput(true)}
              disabled={loading}
              className="w-full bg-dark-surface hover:bg-dark-surface/80 text-dark-text font-semibold py-4 px-6 rounded-lg border border-dark-border transition-colors disabled:opacity-50"
            >
              Join Room
            </button>
          </div>
        )}

        {showCreateForm && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold text-dark-text">Create Room</h2>
              <p className="text-dark-text/70 text-sm">Enter your name to create a new game</p>
            </div>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-3 text-dark-text placeholder-dark-text/50 focus:outline-none focus:ring-2 focus:ring-dark-accent"
              maxLength={20}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {setShowCreateForm(false); setPlayerName(''); setError('')}}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="flex-1 bg-dark-accent hover:bg-dark-accent/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {showJoinInput && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold text-dark-text">Join Room</h2>
              <p className="text-dark-text/70 text-sm">Enter your name and room code</p>
            </div>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-3 text-dark-text placeholder-dark-text/50 focus:outline-none focus:ring-2 focus:ring-dark-accent"
              maxLength={20}
            />
            <input
              type="text"
              placeholder="Enter room code (e.g., A7B2C9)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-3 text-dark-text placeholder-dark-text/50 focus:outline-none focus:ring-2 focus:ring-dark-accent"
              maxLength={6}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {setShowJoinInput(false); setPlayerName(''); setRoomCode(''); setError('')}}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className="flex-1 bg-dark-accent hover:bg-dark-accent/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-center text-sm mt-4">
            {error}
          </div>
        )}
      </div>
    </main>
  )
}