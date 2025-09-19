import { io, Socket } from 'socket.io-client'

class SocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    })

    this.socket.on('connect', () => {
      console.log('Connected to server')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this.reconnectAttempts++
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        this.socket?.disconnect()
      }
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export const socketManager = new SocketManager()
export default socketManager