# RLHF Batch Processing Pipeline

Automated pipeline to process high-confidence segments through the RLHF workflow, generating 3 model variations for human ranking.

## Overview

This pipeline automatically:
1. Finds segments with transcription confidence > 90%
2. Calls 3 different Deepgram models (nova-2, enhanced, base)
3. Stores variations in `model_outputs` table
4. Marks segments as `needs_ranking` for human annotation

## Usage

### Command Line (Recommended for Batch Processing)

```bash
# Process 10 high-confidence segments (default)
npm run process-rlhf

# Process specific number of segments
npm run process-rlhf -- --limit 50

# Process ALL high-confidence segments
npm run process-rlhf -- --all

# Custom confidence threshold
npm run process-rlhf -- --min-confidence 0.85 --limit 20
```

### API Endpoint (For UI Integration)

**Check eligible segments:**
```bash
GET /api/segments/process-batch?minConfidence=0.90
```

Response:
```json
{
  "eligibleCount": 42,
  "minConfidence": 0.90,
  "message": "42 segments ready for processing"
}
```

**Queue batch processing:**
```bash
POST /api/segments/process-batch
Content-Type: application/json

{
  "limit": 10,
  "minConfidence": 0.90
}
```

Response:
```json
{
  "status": "queued",
  "message": "Queued 10 segments for processing",
  "segmentIds": ["uuid1", "uuid2", ...],
  "count": 10
}
```

## How It Works

### 1. Segment Selection

Finds segments that:
- ✅ Have `transcription_confidence >= 0.90` (configurable)
- ✅ Have a valid `file_path` (audio file exists)
- ✅ Are NOT already processed (`status != 'needs_ranking'`)

Ordered by confidence (highest first).

### 2. Processing

For each segment:
1. Calls `/api/process-audio` with segment ID
2. API generates 3 variations using different models
3. Stores in database with model metadata
4. Updates segment status

### 3. Rate Limiting

- 1 second delay between segments (configurable)
- Prevents overwhelming Deepgram API
- Can be adjusted based on your API tier

## Output

### Console Output

```
🚀 Starting high-confidence segment processing...

🔍 Finding high-confidence segments...
   Min confidence: 90%
   Limit: 10

📊 Found 10 segments to process

[1/10] Processing segment f1bfe393-3c4d-4b1e-bf01-fac01ead0db4
   Current confidence: 95.23%
   ✅ High confidence: 95.23%
   📝 Generated 3 variations
   🎯 Status: needs_ranking

[2/10] Processing segment ...
...

============================================================
📊 PROCESSING SUMMARY
============================================================
Total segments:        10
Successfully processed: 10
High confidence:       8 (ready for ranking)
Low confidence:        2 (needs human review)
Errors:                0
============================================================
```

### Database Changes

**Segments Table:**
```sql
-- Before
status: 'pending'

-- After (high confidence)
status: 'needs_ranking'
transcription_text: '...'
transcription_confidence: 0.95
```

**Model Outputs Table:**
```sql
INSERT INTO model_outputs (segment_id, variations, needs_ranking)
VALUES (
  'segment-uuid',
  '[
    {"text": "...", "confidence": 0.95, "model": "nova-2", ...},
    {"text": "...", "confidence": 0.92, "model": "enhanced", ...},
    {"text": "...", "confidence": 0.88, "model": "base", ...}
  ]',
  true
);
```

## Workflow Integration

### Typical Workflow

```
1. LiveATC Recording Pipeline
   ↓
2. Segment Detection
   ↓
3. Initial Transcription (Deepgram nova-2)
   ↓
4. Confidence Check
   ↓
5. IF confidence > 90%:
   ├─▶ Run RLHF Batch Processing (this script)
   ├─▶ Generate 3 model variations
   ├─▶ Store in model_outputs
   └─▶ Mark as needs_ranking
   ↓
6. Human Ranking Interface (Phase 3)
   ↓
7. Export Preference Dataset
   ↓
8. Train Reward Model / Fine-tune Custom Model
```

### Automated Pipeline

You can integrate this into your scheduled pipeline:

```javascript
// In scheduled-pipeline.js
async function runPipeline() {
  // 1. Record audio
  await recordAudio();
  
  // 2. Segment audio
  await segmentAudio();
  
  // 3. Upload to Supabase
  await uploadToSupabase();
  
  // 4. Detect edge cases
  await detectEdgeCases();
  
  // 5. Process high-confidence segments for RLHF
  await processHighConfidence({ limit: 50 });
}
```

## Configuration

### Environment Variables

No additional environment variables needed - uses existing:
- `DEEPGRAM_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Script Options

| Option | Default | Description |
|--------|---------|-------------|
| `--limit N` | 10 | Process N segments |
| `--all` | - | Process all eligible segments |
| `--min-confidence X` | 0.90 | Minimum confidence threshold (0.0-1.0) |

## Performance

### Processing Time

- **Per segment**: ~7-18 seconds (3 parallel API calls)
- **10 segments**: ~2-3 minutes (with 1s delay between)
- **100 segments**: ~20-30 minutes

### API Costs

Assuming 10-second audio segments:
- **Per segment**: ~$0.00215 (3 API calls)
- **100 segments**: ~$0.22
- **1000 segments**: ~$2.15

## Monitoring

### Check Processing Status

```sql
-- Count segments ready for ranking
SELECT COUNT(*) 
FROM segments 
WHERE status = 'needs_ranking';

-- View recent model outputs
SELECT 
  mo.id,
  mo.segment_id,
  mo.variations->0->>'model' as model_1,
  mo.variations->1->>'model' as model_2,
  mo.variations->2->>'model' as model_3,
  mo.created_at
FROM model_outputs mo
ORDER BY mo.created_at DESC
LIMIT 10;

-- Check eligible segments
SELECT COUNT(*) 
FROM segments 
WHERE transcription_confidence >= 0.90
  AND file_path IS NOT NULL
  AND status != 'needs_ranking';
```

## Troubleshooting

### "No high-confidence segments found"

Check if segments have been transcribed:
```sql
SELECT COUNT(*) FROM segments WHERE transcription_confidence IS NOT NULL;
```

### API Errors

- Check Deepgram API key is valid
- Verify Supabase connection
- Check audio files exist in storage

### Rate Limiting

If hitting Deepgram rate limits:
- Increase delay between segments (edit script)
- Process in smaller batches
- Upgrade Deepgram API tier

## Next Steps

After batch processing:

1. **Phase 3**: Build human ranking interface
2. **Export**: Generate preference dataset
3. **Train**: Use preferences to train reward model
4. **Fine-tune**: Improve custom STT model with RLHF

## Example: Full Batch Run

```bash
# Process all segments with confidence > 85%
npm run process-rlhf -- --all --min-confidence 0.85
```

Expected output for 100 segments:
- Processing time: ~25 minutes
- API cost: ~$0.22
- Result: 100 segments ready for human ranking
- Database: 100 new rows in `model_outputs` table
