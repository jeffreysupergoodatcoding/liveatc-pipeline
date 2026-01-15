# LiveATC Pipeline Usage Guide

## Complete Pipeline Flow

```
1. Record  →  2. Segment  →  3. Upload  →  4. Detect (Manual)
   ↓              ↓              ↓              ↓
  .mp3        .mp3 clips    Supabase      Edge Cases
```

## Individual Steps

### 1. Record Audio from LiveATC
```bash
npm run record -- --airport KJFK --facility tower --url http://d.liveatc.net/kjfk_twr --duration 180
```

**Output**: `recordings/raw/kjfk_tower_YYYYMMDD_HHMMSS.mp3`

### 2. Segment Audio into Clips
```bash
npm run segment -- --input recordings/raw/kjfk_tower_20250119_143000.mp3
```

**Output**: `recordings/segments/kjfk_tower_20250119_143000/seg_001.mp3`, `seg_002.mp3`, etc.

### 3. Upload to Supabase
```bash
npm run upload -- --recording-metadata <path> --segment-metadata <path>
```

**Result**: Recordings and segments stored in Supabase database + storage

### 4. Detect Edge Cases (Manual)

Process all unanalyzed segments:
```bash
npm run detect
```

Process first 10 unanalyzed segments:
```bash
npm run detect -- --limit 10
```

Process all segments from a specific recording:
```bash
npm run detect -- --recording-id <uuid>
```

Process a single segment:
```bash
npm run detect -- --segment-id <uuid>
```

Reprocess already analyzed segments:
```bash
npm run detect -- --reprocess --limit 5
```

## Automated Pipeline

Run the complete pipeline (steps 1-3) automatically:

**Once:**
```bash
npm run pipeline -- --once
```

**On a schedule:**
```bash
npm run pipeline  # Uses cron schedule from .env
```

**For a specific feed:**
```bash
npm run pipeline -- --feed kjfk_gnd
```

## Typical Workflow

### Development/Testing
```bash
# 1. Record a short test clip (3 minutes)
RECORDING_DURATION=180 npm run pipeline -- --once --feed kjfk_twr2

# 2. Check the admin UI to see recordings
# Visit: http://localhost:3000/admin/liveatc

# 3. Manually run edge case detection on new segments
npm run detect -- --limit 5

# 4. Review flagged segments in admin UI
# Visit: http://localhost:3000/admin/liveatc → Edge Cases tab
```

### Production
```bash
# 1. Start the scheduled pipeline (runs every hour)
npm run pipeline

# 2. Periodically run edge case detection on batches
# Run this daily or after each recording session
npm run detect -- --limit 50

# 3. Monitor and review flagged segments via admin UI
```

## Edge Case Detection Details

### What it does:
1. **Downloads** segment audio from Supabase storage
2. **Transcribes** using Deepgram API
3. **Analyzes** audio features (volume, speech density, overlaps)
4. **Detects** 57 built-in edge cases (emergencies, conflicts, etc.)
5. **Applies** custom rules (if configured)
6. **Calculates** edge case score (0-1 scale)
7. **Flags** segments with score > 0.5 for review
8. **Saves** all results to database

### Processing Speed:
- ~4-5 seconds per segment
- 50 segments = ~4 minutes
- 240 segments/day = ~20 minutes

### Cost Estimate:
- Deepgram: $0.0043/min of audio
- Average segment: 5 seconds
- 240 segments/day × 5s = 1,200s = 20 min/day
- Daily cost: ~$0.086/day (~$2.60/month)

## Environment Variables

Required for edge case detection:
```bash
DEEPGRAM_API_KEY=your_deepgram_api_key
EDGE_CASE_DETECTION_ENABLED=true
DETECTION_MODE=hybrid  # 'built-in', 'custom', or 'hybrid'
```

## Monitoring

View statistics and flagged segments:
```bash
npm run dev
# Visit: http://localhost:3000/admin/liveatc
# Click: "Edge Cases" tab
```

## Troubleshooting

**No segments to process:**
- Check if segments have been uploaded: `npm run detect -- --reprocess --limit 1`
- Verify Supabase storage has files

**Transcription errors:**
- Check DEEPGRAM_API_KEY is valid
- Verify audio files are accessible in Supabase storage

**Database errors:**
- Check SUPABASE_SERVICE_KEY is set correctly
- Verify migrations have been applied

## Advanced Usage

### Process only high-quality segments:
```bash
# First, manually filter in admin UI or add quality threshold to script
```

### Schedule detection to run automatically:
```bash
# Add to crontab:
0 */6 * * * cd /path/to/liveatc-pipeline && npm run detect -- --limit 100
```

### Export flagged segments for review:
Use the admin UI or query the database directly:
```sql
SELECT * FROM flagged_segments_with_matches
WHERE edge_case_score > 0.7
ORDER BY edge_case_score DESC;
```
