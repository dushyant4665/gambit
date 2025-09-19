import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export interface Room {
  id: string
  code: string
  status: 'waiting' | 'playing' | 'finished'
  white_player_name?: string
  black_player_name?: string
  white_socket_id?: string
  black_socket_id?: string
  white_assigned: boolean
  black_assigned: boolean
  current_fen: string
  current_turn: 'w' | 'b'
  winner?: 'w' | 'b' | 'd'
  created_at: string
  updated_at: string
}

export interface Move {
  id: string
  room_id: string
  move_number: number
  color: 'w' | 'b'
  from_square: string
  to_square: string
  piece: string
  captured_piece?: string
  promotion?: 'q' | 'r' | 'b' | 'n'
  san: string
  is_check: boolean
  is_checkmate: boolean
  is_stalemate?: boolean
  fen_after: string
  created_at: string
}