'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
// import { api } from '../lib/api' - using direct fetch

export default function Home() {
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCreateRoom = async () => {
    setLoading(true)
    setError('')
    
    try {
      console.log('Creating room...')
      
      const response = await fetch('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      
      const { code } = await response.json()
      console.log('Room created:', code)
      
      // Store room code in localStorage to identify creator
      const createdRooms = JSON.parse(localStorage.getItem('createdRooms') || '[]')
      createdRooms.push(code)
      localStorage.setItem('createdRooms', JSON.stringify(createdRooms))
      
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

    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`http://localhost:3001/api/rooms/${roomCode.toUpperCase()}`)
      const { exists } = await response.json()
      
      if (exists) {
        router.push(`/room/${roomCode.toUpperCase()}`)
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
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-dark-text mb-4">Chess MLT</h1>
          <p className="text-dark-text/70">Real-time multiplayer chess</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full bg-dark-accent hover:bg-dark-accent/80 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>

          <button
            onClick={() => setShowJoinInput(!showJoinInput)}
            disabled={loading}
            className="w-full bg-dark-surface hover:bg-dark-surface/80 text-dark-text font-semibold py-4 px-6 rounded-lg border border-dark-border transition-colors disabled:opacity-50"
          >
            Join Room
          </button>

          {showJoinInput && (
            <div className="space-y-3 mt-4">
              <input
                type="text"
                placeholder="Enter room code (e.g., A7B2C9)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-3 text-dark-text placeholder-dark-text/50 focus:outline-none focus:ring-2 focus:ring-dark-accent"
                maxLength={6}
              />
              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className="w-full bg-dark-accent hover:bg-dark-accent/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-center text-sm mt-4">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
