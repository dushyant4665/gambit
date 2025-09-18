-- Create rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create moves table
CREATE TABLE moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT NOT NULL REFERENCES rooms(code),
    move_number INTEGER NOT NULL,
    from_sq TEXT NOT NULL,
    to_sq TEXT NOT NULL,
    piece TEXT NOT NULL,
    promotion TEXT,
    san TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_moves_room_code ON moves(room_code);
CREATE INDEX idx_moves_room_code_move_number ON moves(room_code, move_number);

-- Enable RLS (Row Level Security) - optional but recommended
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Create policies to allow read access to all users
CREATE POLICY "Allow read access to rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Allow read access to moves" ON moves FOR SELECT USING (true);
