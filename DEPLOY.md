# Deploy Gambit

## Render (Backend)

**Environment Variables:**
```
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-vercel-app.vercel.app
SUPABASE_URL=https://padgdvljkfysfuilyvcn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZGdkdmxqa2Z5c2Z1aWx5dmNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzg0MTk0OCwiZXhwIjoyMDczNDE3OTQ4fQ.Nss8peme-4P1BT7FRJghIFLQ-VIUbWrntY2J1k9jVBk
```

**Build Settings:**
- Build Command: `cd server && npm install && npm run build`
- Start Command: `cd server && npm start`

## Vercel (Frontend)

**Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://your-render-app.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://padgdvljkfysfuilyvcn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZGdkdmxqa2Z5c2Z1aWx5dmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NDE5NDgsImV4cCI6MjA3MzQxNzk0OH0.uDjrsZr6tWBVHdNhaVzBX7S1aX7at24FNxSv6d6XRuA
```

**Build Settings:**
- Framework: Next.js
- Root Directory: `client`
- Build Command: `npm run build`

## Steps

1. Deploy backend to Render with environment variables
2. Deploy frontend to Vercel with environment variables  
3. Update `CLIENT_URL` in Render with actual Vercel URL
4. Redeploy backend

Done.
