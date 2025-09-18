import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface Room {
  id: string
  code: string
  created_at: string
}

export interface Move {
  id: string
  room_code: string
  move_number: number
  from_sq: string
  to_sq: string
  piece: string
  promotion?: string
  san?: string
  created_at: string
}
