# Quick Start Guide

Get the LiveATC pipeline up and running in 10 minutes.

## Prerequisites

1. Install ffmpeg:
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu
   sudo apt-get install ffmpeg
   ```

2. Create a Supabase account at [supabase.com](https://supabase.com)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

#### Create Project
- Go to Supabase Dashboard
- Click "New Project"
- Choose a name and password
- Wait 2-3 minutes for setup

#### Run Migration
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run

#### Create Storage Buckets
1. Go to Storage
2. Create bucket `liveatc-raw` (Private)
3. Create bucket `liveatc-segments` (Public)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
- Set `SUPABASE_URL` (from Project Settings → API)
- Set `SUPABASE_KEY` (anon public key)
- Set `SUPABASE_SERVICE_KEY` (service_role key)
- Change `RECORDING_DURATION` to `60` for testing

### 4. Test the System

Run the automated test:

```bash
./scripts/test-pipeline.sh
```

This will:
1. Record 30 seconds from KJFK Ground
2. Segment the audio
3. Upload to Supabase

### 5. View in Admin Interface

```bash
npm run dev
```

Open: [http://localhost:3000/admin/liveatc](http://localhost:3000/admin/liveatc)

## What's Next?

### Run a Full Recording (10 minutes)

```bash
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 600
```

### Run Complete Pipeline

```bash
node scripts/scheduled-pipeline.js --feed kjfk --once
```

### Schedule Automatic Recording

```bash
# Run every hour
node scripts/scheduled-pipeline.js --schedule
```

### Add More Feeds

Edit `.env` and add to `LIVEATC_FEEDS`:

```json
[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"},
  {"airport": "KJFK", "facility": "tower", "url": "http://d.liveatc.net/kjfk_twr"},
  {"airport": "KSFO", "facility": "ground", "url": "http://d.liveatc.net/ksfo_gnd"}
]
```

## Troubleshooting

### "ffmpeg not found"
Install ffmpeg using package manager (see Prerequisites)

### "Upload failed"
- Check Supabase credentials in `.env`
- Verify storage buckets exist
- Make sure you're using `SUPABASE_SERVICE_KEY` for uploads

### "No segments created"
- Audio might be too quiet (lower `SILENCE_THRESHOLD` to -50)
- Recording might be too short (try 60+ seconds)
- Check if feed URL is working

### "Cannot connect to Supabase"
- Verify `SUPABASE_URL` format: `https://xxx.supabase.co`
- Check that project is not paused
- Try regenerating API keys

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start scripts/scheduled-pipeline.js --name liveatc -- --schedule
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "scripts/scheduled-pipeline.js", "--schedule"]
```

## Need Help?

See the full [README.md](README.md) for detailed documentation.
