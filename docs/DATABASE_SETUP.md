# Database Setup Guide

This guide walks you through setting up the Supabase database for the LiveATC Pipeline.

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- Your project's SQL Editor access

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter a project name and database password
4. Select a region close to you
5. Wait for the project to provision (2-3 minutes)

## Step 2: Run Database Migrations

Navigate to the SQL Editor in your Supabase dashboard and run the migrations in order:

### Core Schema

```sql
-- Run: supabase/migrations/001_initial_schema.sql
-- Creates: recordings, segments, segment_labels tables
```

### Additional Migrations

Run these in sequence:
- `001_initial_schema.sql` - Core tables
- `006_confidence_scoring_update.sql` - Confidence fields
- `011_add_manual_transcription.sql` - Manual transcription support
- `018_add_audio_trimming.sql` - Trimmed file paths
- `021_add_remove_regions.sql` - Region removal tracking

## Step 3: Set Up Storage Buckets

1. Go to **Storage** in the Supabase dashboard
2. Create two buckets:

| Bucket Name | Public | Purpose |
|-------------|--------|---------|
| `liveatc-raw` | ❌ No | Full recordings (private) |
| `liveatc-segments` | ✅ Yes | Audio segments (public for playback) |

### Storage Policies

For `liveatc-segments` (public bucket), add this policy:

```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'liveatc-segments');

-- Allow authenticated uploads
CREATE POLICY "Authenticated Upload" ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'liveatc-segments');
```

## Step 4: Get API Keys

1. Go to **Settings** → **API**
2. Copy these values to your `.env` file:
   - `SUPABASE_URL` - Project URL
   - `SUPABASE_KEY` - `anon` public key (for frontend)
   - `SUPABASE_SERVICE_KEY` - `service_role` key (for backend)

## Step 5: Environment Configuration

Create your `.env` file:

```bash
cp .env.example .env
```

Required variables:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# For Next.js client-side
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Schema

### Tables

**`recordings`** - Full audio recordings
- `id` (uuid) - Primary key
- `airport` (text) - Airport code (KJFK, KSFO, etc.)
- `facility` (text) - Facility type (tower, ground, etc.)
- `recorded_at` (timestamp) - When recorded
- `duration_seconds` (float) - Total duration
- `status` (text) - processing, segmented, error
- `segment_count` (int) - Auto-updated count

**`segments`** - Individual transmissions
- `id` (uuid) - Primary key
- `recording_id` (uuid) - Foreign key to recordings
- `file_path` (text) - Storage path
- `trimmed_file_path` (text) - Path to trimmed version
- `duration_seconds` (float) - Segment duration
- `transcription` (text) - AI transcription
- `confidence_score` (float) - Transcription confidence

**`segment_labels`** - Human-reviewed labels
- `id` (uuid) - Primary key
- `segment_id` (uuid) - Foreign key to segments
- `transcription` (text) - Verified transcription
- `quality` (text) - good, bad, rejected

## Troubleshooting

### "relation does not exist" error
Run the migrations in order starting with `001_initial_schema.sql`.

### Storage upload fails
Check that:
1. Buckets exist with correct names
2. Storage policies are configured
3. Using `SUPABASE_SERVICE_KEY` for backend uploads

### RLS (Row Level Security) issues
The migrations enable RLS. For development, you can use the service key which bypasses RLS.

## Useful SQL Queries

```sql
-- Check recording/segment counts
SELECT 
  r.airport,
  COUNT(DISTINCT r.id) as recordings,
  COUNT(s.id) as segments
FROM recordings r
LEFT JOIN segments s ON s.recording_id = r.id
GROUP BY r.airport;

-- Find unprocessed segments
SELECT * FROM segments 
WHERE transcription IS NULL
ORDER BY created_at;

-- Storage usage by airport
SELECT 
  airport,
  SUM(file_size_bytes) / 1024 / 1024 as mb_used
FROM segments s
JOIN recordings r ON s.recording_id = r.id
GROUP BY airport;
```
