# LiveATC Pipeline - Project Summary

## Overview

Complete end-to-end system for collecting, segmenting, and managing LiveATC audio recordings. Built with Node.js for the backend pipeline and Next.js/React for the admin interface.

## What's Been Built

### ✅ Phase 1: Recording & Segmentation

**Scripts Created:**
- [scripts/liveatc-recorder.js](scripts/liveatc-recorder.js) - Records audio from LiveATC streams
- [scripts/segment-audio.js](scripts/segment-audio.js) - Splits recordings into individual transmissions
- [scripts/upload-to-supabase.js](scripts/upload-to-supabase.js) - Uploads to Supabase Storage & Database
- [scripts/scheduled-pipeline.js](scripts/scheduled-pipeline.js) - Orchestrates complete pipeline

**Features:**
- Records 10-minute chunks from LiveATC feeds (configurable)
- Uses ffmpeg for audio processing
- Silence-based segmentation (500ms+ silence at -40dB threshold)
- Filters segments by duration (2-20 seconds)
- Calculates audio quality scores
- Supports 4 feeds: KJFK Ground/Tower, KSFO Ground, KORD Ground

### ✅ Phase 2: Database & Storage

**Database Schema:**
- `recordings` table - Stores recording metadata
- `segments` table - Stores segment metadata
- `segment_labels` table - For future transcription/labeling
- Automatic triggers for updating counts

**Storage Buckets:**
- `liveatc-raw` - Full recordings (private)
- `liveatc-segments` - Individual segments (public for playback)

**Features:**
- PostgreSQL database with proper indexes
- Foreign key relationships with cascade delete
- Auto-incrementing segment and label counts
- Updated timestamps

### ✅ Phase 3: Admin Interface

**Pages Created:**
- [app/admin/liveatc/page.js](app/admin/liveatc/page.js) - Main admin page
- [app/admin/liveatc/components/RecordingsList.js](app/admin/liveatc/components/RecordingsList.js) - View all recordings
- [app/admin/liveatc/components/SegmentsList.js](app/admin/liveatc/components/SegmentsList.js) - View & manage segments
- [app/admin/liveatc/components/Statistics.js](app/admin/liveatc/components/Statistics.js) - Dashboard with stats

**Features:**
- View all recordings with filtering (airport, facility, status)
- View segments for each recording
- Inline audio player for segment preview
- Mark segments as good/bad/rejected
- Bulk operations (mark multiple, delete multiple)
- Statistics dashboard:
  - Total recordings & segments
  - Storage usage
  - Segments by airport (bar chart)
  - Quality distribution (bar chart)
  - Label coverage percentage

### ✅ Additional Tools

- [scripts/test-pipeline.sh](scripts/test-pipeline.sh) - Automated test script
- [QUICKSTART.md](QUICKSTART.md) - 10-minute setup guide
- [README.md](README.md) - Comprehensive documentation
- `.env.example` - Environment template
- `supabase/migrations/001_initial_schema.sql` - Database schema
- `supabase/setup-storage.md` - Storage setup guide

## Technical Stack

**Backend:**
- Node.js 18+ with ES modules
- ffmpeg for audio processing
- @supabase/supabase-js for database/storage
- node-cron for scheduling
- fluent-ffmpeg wrapper (optional)

**Frontend:**
- Next.js 14 (App Router)
- React 18
- CSS Modules for styling
- Supabase client for data fetching

**Infrastructure:**
- Supabase (PostgreSQL + Storage)
- Cloud or VPS for running pipeline
- PM2 for process management (optional)

## File Structure

```
liveatc-pipeline/
├── scripts/                      # Backend pipeline scripts
│   ├── liveatc-recorder.js      # Record audio
│   ├── segment-audio.js         # Segment recordings
│   ├── upload-to-supabase.js    # Upload to cloud
│   ├── scheduled-pipeline.js    # Orchestration
│   └── test-pipeline.sh         # Testing script
├── app/                         # Next.js frontend
│   ├── admin/liveatc/           # Admin interface
│   │   ├── page.js              # Main page
│   │   ├── page.module.css      # Page styles
│   │   └── components/          # React components
│   ├── layout.js                # Root layout
│   ├── page.js                  # Home page
│   └── globals.css              # Global styles
├── lib/                         # Shared utilities
│   ├── supabase.js              # Supabase client
│   └── utils/format.js          # Formatting functions
├── supabase/                    # Database migrations
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── setup-storage.md
├── recordings/                  # Local recordings (gitignored)
│   ├── raw/                     # Full recordings
│   └── segments/                # Segmented audio
├── logs/                        # Pipeline logs (gitignored)
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── package.json                 # Dependencies
├── next.config.js               # Next.js config
├── tsconfig.json                # TypeScript config
├── README.md                    # Full documentation
├── QUICKSTART.md                # Quick setup guide
└── PROJECT_SUMMARY.md           # This file
```

## How It Works

### Recording Pipeline

1. **Scheduler** runs every hour (configurable)
2. **Recorder** downloads 10-minute chunks from LiveATC
3. **Segmenter** splits audio on silence periods
4. **Filter** removes segments <2s or >20s
5. **Quality** calculates amplitude-based quality score
6. **Upload** sends files to Supabase Storage
7. **Database** stores metadata for querying

### Admin Interface Flow

1. User opens admin interface
2. Fetches recordings from Supabase database
3. User selects a recording
4. Fetches segments for that recording
5. Audio player streams from Supabase Storage (public bucket)
6. User can mark segments as good/bad or delete
7. Statistics aggregates data from database

## API Endpoints (Database Queries)

All queries use Supabase client:

```javascript
// Get all recordings
supabase.from('recordings').select('*').order('recorded_at', { ascending: false })

// Get segments for recording
supabase.from('segments').select('*').eq('recording_id', id).order('segment_index')

// Update segment status
supabase.from('segments').update({ status: 'active' }).eq('id', segmentId)

// Delete segment
supabase.from('segments').delete().eq('id', segmentId)

// Statistics queries
supabase.from('recordings').select('*', { count: 'exact', head: true })
supabase.from('segments').select('file_size_bytes, audio_quality_score, label_count')
```

## Configuration

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Feeds
LIVEATC_FEEDS='[{"airport":"KJFK","facility":"ground","url":"..."}]'

# Recording
RECORDING_DURATION=600        # 10 minutes
RECORDING_SCHEDULE="0 * * * *"  # Every hour

# Segmentation
SILENCE_THRESHOLD=-40         # dB
SILENCE_DURATION=0.5          # seconds
MIN_SEGMENT_DURATION=2        # seconds
MAX_SEGMENT_DURATION=20       # seconds
```

## Testing

### Quick Test (30 seconds)

```bash
./scripts/test-pipeline.sh
```

### Manual Testing

```bash
# Test recording (1 minute)
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 60

# Test segmentation
node scripts/segment-audio.js --input recordings/raw/kjfk_gnd_*.mp3

# Test upload
node scripts/upload-to-supabase.js --raw-file ... --segment-dir ...

# Test complete pipeline
node scripts/scheduled-pipeline.js --feed kjfk --once
```

### Admin Interface

```bash
npm run dev
# Open http://localhost:3000/admin/liveatc
```

## Production Deployment

### Backend Pipeline

```bash
# Using PM2
npm install -g pm2
pm2 start scripts/scheduled-pipeline.js --name liveatc -- --schedule
pm2 save
pm2 startup
```

### Frontend

```bash
# Build
npm run build

# Start
npm start

# Or deploy to Vercel
vercel deploy
```

## Future Enhancements

### Short Term
1. Add authentication (Supabase Auth)
2. Implement transcription (OpenAI Whisper)
3. Add export functionality (CSV, JSON)
4. Create labeling interface
5. Add search on transcriptions

### Medium Term
6. Real-time monitoring dashboard
7. Automated quality checks
8. Email alerts for failures
9. Storage cleanup automation
10. API for external access

### Long Term
11. Machine learning for quality detection
12. Automatic speaker identification
13. Multi-language support
14. Advanced analytics
15. Mobile app

## Known Limitations

1. **Single-threaded recording** - Feeds recorded sequentially, not in parallel
2. **No retry logic** - Failed recordings are logged but not retried
3. **Basic quality scoring** - Uses amplitude only, not SNR or other metrics
4. **No authentication** - Admin interface is public (add auth before production)
5. **No rate limiting** - Could overwhelm LiveATC servers if misconfigured

## Performance Characteristics

- **Recording**: 1x realtime (10 min recording takes 10 min)
- **Segmentation**: ~2-5 seconds for 10-minute recording
- **Upload**: Depends on internet speed (~30-60s for 10 min recording)
- **Total pipeline**: ~11-15 minutes for 10-minute recording

## Storage Estimates

- **Raw recording**: ~0.75 MB/minute (128kbps MP3)
- **Segments**: Same bitrate, varies by transmission count
- **10 hours/day**: ~450 MB/day (~13.5 GB/month)
- **Supabase free tier**: 1 GB storage (need paid plan for production)

## Cost Estimates (Monthly)

- **Supabase Pro**: $25/month (100 GB storage, 50 GB bandwidth)
- **VPS (for pipeline)**: $5-10/month (DigitalOcean, Hetzner)
- **Total**: ~$30-35/month for production system

## Support

- Documentation: [README.md](README.md)
- Quick Start: [QUICKSTART.md](QUICKSTART.md)
- Database Schema: [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql)
- Storage Setup: [supabase/setup-storage.md](supabase/setup-storage.md)

## License

MIT License - Feel free to use and modify for your needs.

---

**Status**: ✅ Complete and ready for testing

**Next Step**: Follow [QUICKSTART.md](QUICKSTART.md) to set up and test the system
