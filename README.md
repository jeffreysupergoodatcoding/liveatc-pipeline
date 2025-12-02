# LiveATC Pipeline

A complete system to collect, segment, and store LiveATC audio recordings with an admin interface for reviewing and managing segments.

## Architecture

**Backend Pipeline (Node.js):**
1. Recording: Download LiveATC streams periodically using ffmpeg
2. Segmentation: Split recordings into individual transmissions based on silence detection
3. Storage: Upload to Supabase Storage + save metadata to PostgreSQL database

**Frontend Admin Interface (Next.js/React):**
- View all recordings and segments
- Play/review segments with inline audio player
- Mark segments as good/bad quality
- See storage usage and statistics
- Bulk operations on segments

## Prerequisites

- Node.js 18+ and npm
- ffmpeg installed and available in PATH
  - macOS: `brew install ffmpeg`
  - Ubuntu: `apt-get install ffmpeg`
  - Windows: Download from ffmpeg.org
- Supabase account (free tier is fine)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

#### Create a New Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned

#### Run Database Migration
1. Go to SQL Editor in Supabase Dashboard
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL to create tables and triggers

#### Set Up Storage Buckets
1. Go to Storage in Supabase Dashboard
2. Create two buckets:
   - `liveatc-raw` (Private)
   - `liveatc-segments` (Public)
3. For policies, refer to `supabase/setup-storage.md`

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"}
]'

RECORDING_DURATION=60
RECORDING_SCHEDULE="0 * * * *"
```

**Important:** Start with `RECORDING_DURATION=60` (1 minute) for testing!

## Testing the Pipeline

### Test 1: Record Audio (1 minute test)

```bash
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 60
```

This will:
- Record 1 minute of audio from KJFK Ground
- Save to `recordings/raw/kjfk_gnd_YYYYMMDD_HHMMSS.mp3`
- Output metadata as JSON

**Expected output:**
```
Starting recording...
  Airport: KJFK
  Facility: ground
  Duration: 60s
  Progress: 100% (60/60s)
Recording completed successfully!
```

### Test 2: Segment Audio

```bash
node scripts/segment-audio.js --input recordings/raw/kjfk_gnd_20250118_143000.mp3
```

This will:
- Detect silence periods in the recording
- Split into individual transmission segments
- Calculate quality scores for each segment
- Save segments to `recordings/segments/kjfk_gnd_20250118_143000/`

**Expected output:**
```
Detecting silence periods...
  Found 15 silence periods
Calculating segment boundaries...
  Created 12 segments
Extracting segments...
  Extracting segment 12/12...

Segmentation complete!
  Total segments: 12
  Total duration: 45.30s
  Average quality: 0.67
```

### Test 3: Upload to Supabase

```bash
node scripts/upload-to-supabase.js \
  --raw-file recordings/raw/kjfk_gnd_20250118_143000.mp3 \
  --segment-dir recordings/segments/kjfk_gnd_20250118_143000
```

This will:
- Upload raw recording to Supabase Storage
- Upload all segments to Supabase Storage
- Insert metadata into database

**Expected output:**
```
=== Uploading Recording ===
  Uploading kjfk_gnd_20250118_143000.mp3 (7.50 MB)...
Recording ID: abc-123-def

=== Uploading Segments ===
  Uploading segment 12/12...
  Uploaded 12/12 segments

=== Upload Complete ===
```

### Test 4: End-to-End Pipeline

Run the complete pipeline (record → segment → upload) for KJFK Ground:

```bash
node scripts/scheduled-pipeline.js --feed kjfk --once
```

Or run for all configured feeds:

```bash
node scripts/scheduled-pipeline.js --once
```

**Expected output:**
```
============================================================
Processing feed: KJFK ground
============================================================

STEP 1: Recording...
[... recording output ...]

STEP 2: Segmenting...
[... segmentation output ...]

STEP 3: Uploading to Supabase...
[... upload output ...]

============================================================
PIPELINE COMPLETE
Total time: 125.43s
============================================================
```

### Test 5: Admin Interface

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000/admin/liveatc](http://localhost:3000/admin/liveatc)

**Features to test:**
- View recordings list
- Filter by airport/facility/status
- Click "View Segments" on a recording
- Play segments using the inline player
- Mark segments as good/bad
- Use bulk actions to mark/delete multiple segments
- View statistics dashboard

## Running on a Schedule

To run the pipeline automatically every hour:

```bash
node scripts/scheduled-pipeline.js --schedule
```

This will:
- Run every hour (configurable via `RECORDING_SCHEDULE` in `.env`)
- Process all feeds in `LIVEATC_FEEDS`
- Stagger recordings by 30 seconds to avoid overload
- Log results to `logs/pipeline_TIMESTAMP.json`

**Using PM2 for production:**

```bash
npm install -g pm2
pm2 start scripts/scheduled-pipeline.js --name liveatc-pipeline -- --schedule
pm2 save
pm2 startup
```

## Project Structure

```
liveatc-pipeline/
├── scripts/
│   ├── liveatc-recorder.js       # Audio recording script
│   ├── segment-audio.js          # Segmentation script
│   ├── upload-to-supabase.js     # Upload script
│   └── scheduled-pipeline.js     # Orchestration script
├── app/
│   ├── admin/liveatc/            # Admin interface
│   │   ├── page.js               # Main admin page
│   │   └── components/           # React components
│   └── globals.css               # Global styles
├── lib/
│   ├── supabase.js               # Supabase client
│   └── utils/format.js           # Formatting utilities
├── supabase/
│   ├── migrations/               # Database migrations
│   └── setup-storage.md          # Storage setup guide
├── recordings/
│   ├── raw/                      # Raw recordings
│   └── segments/                 # Segmented audio
├── logs/                         # Pipeline logs
├── .env                          # Environment variables
├── package.json                  # Dependencies
└── README.md                     # This file
```

## Script Reference

### liveatc-recorder.js

Records audio from LiveATC streams.

**Usage:**
```bash
# Using predefined feed
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 600

# Custom feed
node scripts/liveatc-recorder.js \
  --airport KJFK \
  --facility ground \
  --url http://d.liveatc.net/kjfk_gnd \
  --duration 600
```

**Options:**
- `--feed`: Predefined feed name (kjfk_gnd, kjfk_twr, ksfo_gnd, kord_gnd)
- `--airport`: Airport code (e.g., KJFK)
- `--facility`: Facility type (ground, tower, etc.)
- `--url`: LiveATC stream URL
- `--duration`: Recording duration in seconds (default: 600)

### segment-audio.js

Segments audio files based on silence detection.

**Usage:**
```bash
node scripts/segment-audio.js --input path/to/recording.mp3
```

**Options:**
- `--input`: Path to input audio file (required)
- `--silence-threshold`: Silence threshold in dB (default: -40)
- `--silence-duration`: Minimum silence duration in seconds (default: 0.5)
- `--min-duration`: Minimum segment duration in seconds (default: 2)
- `--max-duration`: Maximum segment duration in seconds (default: 20)

### upload-to-supabase.js

Uploads recordings and segments to Supabase.

**Usage:**
```bash
# Using file paths
node scripts/upload-to-supabase.js \
  --raw-file recordings/raw/kjfk_gnd_20250118_143000.mp3 \
  --segment-dir recordings/segments/kjfk_gnd_20250118_143000

# Using metadata JSON files
node scripts/upload-to-supabase.js \
  --recording-metadata recording.json \
  --segment-metadata segments.json
```

### scheduled-pipeline.js

Orchestrates the complete pipeline.

**Usage:**
```bash
# Run once for all feeds
node scripts/scheduled-pipeline.js --once

# Run once for specific feed
node scripts/scheduled-pipeline.js --feed kjfk

# Run on schedule
node scripts/scheduled-pipeline.js --schedule
```

## Configuration

### Audio Processing Settings

Adjust in `.env`:

```bash
# Silence detection
SILENCE_THRESHOLD=-40        # dB (lower = more sensitive)
SILENCE_DURATION=0.5         # seconds

# Segment filtering
MIN_SEGMENT_DURATION=2       # seconds (discard shorter)
MAX_SEGMENT_DURATION=20      # seconds (discard longer)
```

### Feed Configuration

Edit `LIVEATC_FEEDS` in `.env`:

```bash
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"},
  {"airport": "KJFK", "facility": "tower", "url": "http://d.liveatc.net/kjfk_twr"},
  {"airport": "KSFO", "facility": "ground", "url": "http://d.liveatc.net/ksfo_gnd"}
]'
```

### Schedule Configuration

Cron syntax for `RECORDING_SCHEDULE`:

```bash
"0 * * * *"      # Every hour at :00
"*/30 * * * *"   # Every 30 minutes
"0 */2 * * *"    # Every 2 hours
```

## Troubleshooting

### ffmpeg not found
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Verify installation
ffmpeg -version
```

### No segments created
- Check if the audio file has actual content (not just silence)
- Lower the `SILENCE_THRESHOLD` (e.g., -50 instead of -40)
- Check minimum/maximum duration constraints

### Upload fails
- Verify Supabase credentials in `.env`
- Check that storage buckets exist
- Ensure storage policies are set correctly
- Use `SUPABASE_SERVICE_KEY` for backend operations

### Admin interface shows no data
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`
- Check browser console for errors
- Ensure database tables exist (run migration)

## Performance Tips

1. **Storage**: Use 128kbps MP3 encoding (default) for good quality at reasonable file sizes
2. **Segmentation**: Adjust silence parameters based on your needs:
   - Noisier feeds: Use lower threshold (e.g., -50dB)
   - Cleaner feeds: Use higher threshold (e.g., -35dB)
3. **Scheduling**: Stagger multiple feeds by 30+ seconds to avoid concurrent recordings
4. **Cleanup**: Regularly archive or delete old recordings from Supabase Storage

## Next Steps

1. Add authentication to admin interface
2. Implement transcription using Whisper API
3. Add export functionality (CSV, JSON)
4. Create labeling interface for training data
5. Implement search and filtering on transcriptions
6. Add real-time monitoring dashboard
7. Set up automated quality checks
8. Implement automatic cleanup of low-quality segments

## License

MIT
