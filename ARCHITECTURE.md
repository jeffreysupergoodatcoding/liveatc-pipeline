# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         LiveATC Servers                          │
│              (http://d.liveatc.net/kjfk_gnd, etc.)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Stream (MP3)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Recording Pipeline (Node.js)                  │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Recorder   │───▶│  Segmenter   │───▶│   Uploader   │      │
│  │   (ffmpeg)   │    │   (ffmpeg)   │    │  (Supabase)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                     │              │
│         ▼                   ▼                     │              │
│   recordings/raw/    recordings/segments/        │              │
│                                                   │              │
└───────────────────────────────────────────────────┼──────────────┘
                                                    │
                                                    │ Upload
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                              │
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │   PostgreSQL DB      │         │   Storage Buckets    │     │
│  │                      │         │                      │     │
│  │  - recordings        │         │  - liveatc-raw       │     │
│  │  - segments          │         │  - liveatc-segments  │     │
│  │  - segment_labels    │         │                      │     │
│  └──────────────────────┘         └──────────────────────┘     │
│           │                                    │                 │
└───────────┼────────────────────────────────────┼─────────────────┘
            │                                    │
            │ API (REST)                         │ Storage API
            ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Admin Interface (Next.js/React)                 │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Recordings  │  │   Segments   │  │  Statistics  │          │
│  │     List     │  │     List     │  │   Dashboard  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│                    http://localhost:3000                         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Recording Flow

```
1. Scheduler triggers (cron)
   └─▶ For each feed in LIVEATC_FEEDS:

2. liveatc-recorder.js
   ├─▶ Connect to LiveATC stream
   ├─▶ Record for N seconds (default: 600s)
   ├─▶ Save to recordings/raw/airport_facility_timestamp.mp3
   └─▶ Output metadata (JSON)

3. segment-audio.js
   ├─▶ Load recording
   ├─▶ Detect silence periods (ffmpeg silencedetect)
   ├─▶ Calculate segment boundaries
   ├─▶ Extract segments (2-20 seconds)
   ├─▶ Calculate quality scores
   ├─▶ Save to recordings/segments/recording_name/seg_NNN.mp3
   └─▶ Output segment metadata (JSON)

4. upload-to-supabase.js
   ├─▶ Upload raw recording → liveatc-raw bucket
   ├─▶ Insert recording metadata → recordings table
   ├─▶ For each segment:
   │   ├─▶ Upload segment → liveatc-segments bucket
   │   └─▶ Insert segment metadata → segments table
   └─▶ Update recording status to 'segmented'

5. Database triggers automatically update counts
```

### Admin Interface Flow

```
User loads /admin/liveatc
   └─▶ RecordingsList component

User clicks filter
   ├─▶ Query: SELECT * FROM recordings WHERE airport = 'KJFK'
   └─▶ Display filtered results

User clicks "View Segments"
   ├─▶ Navigate to SegmentsList component
   ├─▶ Query: SELECT * FROM segments WHERE recording_id = ?
   └─▶ Display segments with audio players

User clicks play button
   ├─▶ Get public URL from Supabase Storage
   ├─▶ Load audio in <audio> element
   └─▶ Stream from liveatc-segments bucket

User marks segment as good
   ├─▶ UPDATE segments SET status = 'active' WHERE id = ?
   └─▶ Refresh segment list

User views statistics
   ├─▶ Query recordings, segments, aggregate data
   ├─▶ Calculate totals, distributions, coverage
   └─▶ Render charts and metrics
```

## Component Architecture

### Backend Scripts

```
scripts/
├── liveatc-recorder.js
│   ├── parseArgs()           - Parse CLI arguments
│   ├── getTimestamp()        - Generate timestamp
│   ├── ensureDirectory()     - Create output dirs
│   └── recordStream()        - Record using ffmpeg
│
├── segment-audio.js
│   ├── parseArgs()           - Parse CLI arguments
│   ├── detectSilences()      - Find silence periods
│   ├── calculateSegments()   - Compute segment boundaries
│   ├── getTotalDuration()    - Get audio duration
│   ├── extractSegment()      - Extract segment
│   └── getAudioQualityScore()- Calculate quality metric
│
├── upload-to-supabase.js
│   ├── initSupabase()        - Initialize client
│   ├── uploadToStorage()     - Upload file
│   ├── insertRecording()     - Create DB record
│   ├── insertSegment()       - Create segment record
│   └── updateRecordingStatus() - Update status
│
└── scheduled-pipeline.js
    ├── parseArgs()           - Parse CLI arguments
    ├── processFeed()         - Run complete pipeline
    ├── processAllFeeds()     - Process multiple feeds
    ├── runOnce()             - Single execution
    └── runScheduled()        - Cron-based execution
```

### Frontend Components

```
app/admin/liveatc/
├── page.js (Main Container)
│   ├── State: view, selectedRecording
│   ├── Navigation between views
│   └── Renders active component
│
├── components/RecordingsList.js
│   ├── State: recordings, loading, filters
│   ├── fetchRecordings() - Load from DB
│   ├── Filter UI - airport, facility, status
│   └── Table with action buttons
│
├── components/SegmentsList.js
│   ├── State: segments, playingSegment, selectedSegments
│   ├── fetchSegments() - Load from DB
│   ├── Audio player with controls
│   ├── Bulk actions toolbar
│   └── Table with segment details
│
└── components/Statistics.js
    ├── State: stats, loading
    ├── fetchStatistics() - Aggregate queries
    ├── Metric cards
    └── Bar charts
```

## Database Schema

### Table Relationships

```
recordings (1) ──── (N) segments (1) ──── (N) segment_labels
    │                      │
    │                      │
    ├─ id (PK)            ├─ id (PK)
    ├─ airport            ├─ recording_id (FK)
    ├─ facility           ├─ segment_index
    ├─ recorded_at        ├─ file_path
    ├─ duration_seconds   ├─ duration_seconds
    ├─ raw_file_path      ├─ audio_quality_score
    ├─ status             ├─ label_count
    └─ segment_count      └─ status
```

### Triggers

```
recordings.updated_at
   └─▶ ON UPDATE → update_updated_at_column()

recordings.segment_count
   ├─▶ ON INSERT segments → update_recording_segment_count()
   └─▶ ON DELETE segments → update_recording_segment_count()

segments.label_count
   ├─▶ ON INSERT segment_labels → update_segment_label_count()
   └─▶ ON DELETE segment_labels → update_segment_label_count()
```

## Storage Structure

### Supabase Storage

```
liveatc-raw/ (Private)
├── kjfk_ground/
│   └── 2025/
│       └── 01/
│           └── 18/
│               ├── kjfk_gnd_20250118_120000.mp3
│               └── kjfk_gnd_20250118_130000.mp3
└── ksfo_ground/
    └── 2025/
        └── 01/
            └── 18/
                └── ksfo_gnd_20250118_120000.mp3

liveatc-segments/ (Public)
├── kjfk_gnd_20250118_120000/
│   ├── seg_001.mp3
│   ├── seg_002.mp3
│   └── seg_003.mp3
└── kjfk_gnd_20250118_130000/
    ├── seg_001.mp3
    └── seg_002.mp3
```

### Local Storage

```
recordings/
├── raw/
│   ├── kjfk_gnd_20250118_120000.mp3
│   └── kjfk_gnd_20250118_130000.mp3
└── segments/
    ├── kjfk_gnd_20250118_120000/
    │   ├── seg_001.mp3
    │   ├── seg_002.mp3
    │   └── seg_003.mp3
    └── kjfk_gnd_20250118_130000/
        ├── seg_001.mp3
        └── seg_002.mp3
```

## Scheduling Architecture

### Cron-Based Scheduler

```
scheduled-pipeline.js
   │
   ├─▶ Parse RECORDING_SCHEDULE from .env
   │   (default: "0 * * * *" = every hour)
   │
   └─▶ For each trigger:
       │
       ├─▶ Load LIVEATC_FEEDS from .env
       │
       └─▶ For each feed (sequential):
           │
           ├─▶ Run liveatc-recorder.js
           │   └─ Wait for completion
           │
           ├─▶ Run segment-audio.js
           │   └─ Wait for completion
           │
           ├─▶ Run upload-to-supabase.js
           │   └─ Wait for completion
           │
           ├─▶ Log results to logs/pipeline_TIMESTAMP.json
           │
           └─▶ Wait 30 seconds (stagger)
```

## Deployment Architecture

### Development

```
Local Machine
├── Node.js scripts (backend)
├── Next.js dev server (frontend)
└── Connects to Supabase Cloud
```

### Production

```
                        ┌────────────────┐
                        │   User Browser │
                        └───────┬────────┘
                                │
                                │ HTTPS
                                ▼
                        ┌────────────────┐
                        │   Vercel CDN   │
                        │  (Frontend)    │
                        └───────┬────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │  Supabase    │        │   VPS/VM     │
            │  (Database   │        │  (Pipeline)  │
            │   Storage)   │        │              │
            └──────────────┘        └──────────────┘
                                           │
                                           │ PM2
                                           ▼
                                    ┌──────────────┐
                                    │ scheduled-   │
                                    │ pipeline.js  │
                                    └──────────────┘
```

## Security Architecture

### Authentication (Future)

```
User ──▶ Login Form ──▶ Supabase Auth ──▶ JWT Token
                                            │
                                            ▼
                        Protected Routes ◀─ Verify Token
                                            │
                                            ▼
                                        Allow Access
```

### Access Control

```
Public:
  - liveatc-segments bucket (read-only for playback)

Authenticated (Service Role):
  - liveatc-raw bucket (write)
  - liveatc-segments bucket (write)
  - All database tables (read/write)

Future (Row Level Security):
  - User-specific access to segment_labels
  - Admin-only access to recordings management
```

## Performance Optimizations

### Database Indexes

```sql
-- Fast queries by airport/facility
CREATE INDEX idx_recordings_airport_facility ON recordings(airport, facility);

-- Fast queries by date
CREATE INDEX idx_recordings_recorded_at ON recordings(recorded_at DESC);

-- Fast filtering by status
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_segments_status ON segments(status);

-- Fast segment lookups
CREATE INDEX idx_segments_recording_id ON segments(recording_id);
```

### Caching Strategy

- Frontend: Use SWR or React Query for data caching
- Storage: CDN caching for public segments (automatic with Supabase)
- Database: Connection pooling (automatic with Supabase)

## Monitoring & Logging

### Pipeline Logs

```
logs/
└── pipeline_2025-01-18T12-00-00.json
    ├── feed: { airport, facility, url }
    ├── startTime: ISO timestamp
    ├── status: "success" | "error"
    ├── steps:
    │   ├── record: { status, duration, outputPath }
    │   ├── segment: { status, duration, segmentCount }
    │   └── upload: { status, duration }
    └── totalDuration: milliseconds
```

### Error Tracking (Future)

- Sentry for frontend errors
- Winston for backend logging
- Email alerts on critical failures
- Slack/Discord webhooks for notifications

## Scalability Considerations

### Current Limitations

- Single-threaded recording (sequential)
- No distributed processing
- Local storage before upload

### Future Scaling

1. **Parallel Recording**: Use worker threads or separate processes
2. **Distributed Pipeline**: Queue-based system (Bull/Redis)
3. **Cloud Processing**: Lambda functions for segmentation
4. **CDN**: CloudFront or Cloudflare for segment delivery
5. **Database Sharding**: Partition by airport/date

## API Design (Future)

### REST API Endpoints

```
GET    /api/recordings              - List recordings
GET    /api/recordings/:id          - Get recording details
GET    /api/recordings/:id/segments - List segments
POST   /api/recordings              - Trigger new recording
DELETE /api/recordings/:id          - Delete recording

GET    /api/segments                - List segments
GET    /api/segments/:id            - Get segment details
PATCH  /api/segments/:id            - Update segment
DELETE /api/segments/:id            - Delete segment

GET    /api/statistics              - Get statistics
GET    /api/health                  - Health check
```

---

This architecture is designed to be:
- **Modular**: Each component can be developed/deployed independently
- **Scalable**: Can grow from single machine to distributed system
- **Maintainable**: Clear separation of concerns
- **Extensible**: Easy to add features like transcription, labeling, etc.
