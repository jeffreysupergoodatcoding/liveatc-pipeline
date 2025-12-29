# Storage Capacity Analysis - LiveATC Pipeline

## Current Setup Overview

### Configuration
- **Number of Feeds Available**: 31 feeds across 7 airports
- **Default Recording Duration**: 600 seconds (10 minutes)
- **Default Schedule**: Every hour (`0 * * * *`)
- **Audio Format**: MP3, 128kbps, 22050 Hz sample rate

### Supabase Free Tier Limits
- **Database Storage**: 500 MB
- **File Storage**: 1 GB
- **Bandwidth**: 2 GB/month
- **Database Rows**: Unlimited (within 500 MB limit)

---

## Storage Calculations

### Audio File Size Estimates

#### Raw Recordings (128kbps MP3)
- **1 minute**: ~960 KB (0.94 MB)
- **10 minutes**: ~9.6 MB
- **1 hour**: ~57.6 MB

#### Segmented Audio
Segments are typically 2-20 seconds each:
- **Average segment**: 5 seconds = ~80 KB
- **Typical 10-min recording**: 12-20 segments = ~1-1.6 MB total

### Storage Formula
```
Storage per recording = Raw file + Segments
                      = 9.6 MB + 1.5 MB (avg)
                      = ~11 MB per 10-minute recording
```

---

## Scenario Analysis

### Scenario 1: Single Feed (Conservative)
**Configuration**: 1 feed, recording every hour

**Daily Storage**:
- Recordings per day: 24
- Raw audio: 24 × 9.6 MB = 230.4 MB
- Segments: 24 × 1.5 MB = 36 MB
- **Total per day**: ~266 MB

**Monthly Storage**:
- **Total**: ~7.98 GB (266 MB × 30 days)

**Supabase Free Tier**: ❌ Exceeds 1 GB limit after ~4 days

---

### Scenario 2: Multiple Feeds (4 feeds)
**Configuration**: 4 feeds, recording every hour, staggered

**Daily Storage**:
- Recordings per day: 24 × 4 = 96
- Raw audio: 96 × 9.6 MB = 921.6 MB
- Segments: 96 × 1.5 MB = 144 MB
- **Total per day**: ~1.04 GB

**Monthly Storage**:
- **Total**: ~31.2 GB

**Supabase Free Tier**: ❌ Exceeds 1 GB limit in 1 day

---

### Scenario 3: All 31 Feeds (Maximum)
**Configuration**: 31 feeds, recording every hour

**Daily Storage**:
- Recordings per day: 24 × 31 = 744
- Raw audio: 744 × 9.6 MB = 7.14 GB
- Segments: 744 × 1.5 MB = 1.12 GB
- **Total per day**: ~8.26 GB

**Monthly Storage**:
- **Total**: ~248 GB

**Supabase Free Tier**: ❌ Exceeds 1 GB limit in ~3 hours

---

## Recommended Configurations for Free Tier

### Option A: Short Recordings, Single Feed
```bash
RECORDING_DURATION=60        # 1 minute instead of 10
RECORDING_SCHEDULE="0 * * * *"  # Every hour
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"}
]'
```

**Storage**:
- Per recording: ~1.1 MB (raw) + 0.15 MB (segments) = 1.25 MB
- Per day: 24 × 1.25 MB = 30 MB
- **Per month**: ~900 MB ✅ Fits in 1 GB!

**Capacity**: ~33 days of continuous recording

---

### Option B: Longer Recordings, Less Frequent
```bash
RECORDING_DURATION=600       # 10 minutes
RECORDING_SCHEDULE="0 */6 * * *"  # Every 6 hours
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"}
]'
```

**Storage**:
- Per recording: ~11 MB
- Per day: 4 × 11 MB = 44 MB
- **Per month**: ~1.32 GB ⚠️ Slightly over, but manageable with cleanup

**Capacity**: ~22 days before hitting 1 GB

---

### Option C: Multiple Feeds, Very Short Recordings
```bash
RECORDING_DURATION=30        # 30 seconds
RECORDING_SCHEDULE="0 * * * *"  # Every hour
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"},
  {"airport": "KSFO", "facility": "tower", "url": "http://d.liveatc.net/ksfo_twr"},
  {"airport": "KIAH", "facility": "approach", "url": "http://d.liveatc.net/kiah1_2"}
]'
```

**Storage**:
- Per recording: ~0.6 MB
- Per day: 24 × 3 feeds × 0.6 MB = 43.2 MB
- **Per month**: ~1.3 GB ⚠️ Slightly over

**Capacity**: ~23 days with 3 feeds

---

## Database Storage Considerations

### Metadata Size
Each recording creates:
- 1 row in `recordings` table (~500 bytes)
- 12-20 rows in `segments` table (~300 bytes each)
- Total per recording: ~6-7 KB

### Database Capacity
With 500 MB database limit:
- **Maximum recordings**: ~71,000 recordings
- At 1 recording/hour: ~8 years of metadata
- **Database is NOT the limiting factor** ✅

---

## Paid Tier Options

### Supabase Pro ($25/month)
- **Database Storage**: 8 GB
- **File Storage**: 100 GB
- **Bandwidth**: 50 GB/month

**Capacity with Pro**:
- **Scenario 1** (1 feed/hour): ~12 days
- **Scenario 2** (4 feeds/hour): ~3 days
- **With cleanup**: Sustainable for 4-6 feeds

### Supabase Team ($599/month)
- **Database Storage**: 8 GB
- **File Storage**: 200 GB
- **Bandwidth**: 250 GB/month

**Capacity with Team**:
- **All 31 feeds**: ~24 days
- **With cleanup**: Sustainable for 10-15 feeds

---

## Storage Optimization Strategies

### 1. Automatic Cleanup
Delete old recordings after X days:
```sql
-- Delete recordings older than 7 days
DELETE FROM recordings 
WHERE created_at < NOW() - INTERVAL '7 days';
```

**Impact**: With 7-day retention
- 1 feed/hour: 7 × 266 MB = 1.86 GB (needs Pro tier)
- 1 feed/hour with 1-min recordings: 7 × 30 MB = 210 MB ✅ Free tier!

### 2. Segment-Only Storage
Keep only segments, delete raw recordings:
- Reduces storage by ~85%
- 1 feed/hour: 36 MB/day instead of 266 MB/day
- **Per month**: ~1.08 GB (fits in free tier with cleanup!)

### 3. Lower Bitrate
Use 64kbps instead of 128kbps:
- Reduces file size by 50%
- Still acceptable quality for ATC
- 1 feed/hour: 133 MB/day instead of 266 MB/day

### 4. Selective Recording
Record only during peak hours:
```bash
RECORDING_SCHEDULE="0 6-22 * * *"  # 6 AM to 10 PM only
```
- Reduces daily recordings from 24 to 17
- Saves ~30% storage

---

## Recommended Setup for Free Tier

### Best Configuration for Maximum Data
```bash
# .env configuration
RECORDING_DURATION=60        # 1 minute
RECORDING_SCHEDULE="0 * * * *"  # Every hour

# Single feed
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"}
]'
```

**Plus automated cleanup script** (run daily):
```javascript
// Delete recordings older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

await supabase
  .from('recordings')
  .delete()
  .lt('created_at', thirtyDaysAgo.toISOString());
```

**Result**:
- ✅ Stays within 1 GB free tier
- ✅ 30 days of rolling data
- ✅ 720 recordings (24/day × 30 days)
- ✅ ~8,640 segments for training

---

## Summary Table

| Configuration | Feeds | Duration | Frequency | Daily Storage | Monthly Storage | Free Tier? |
|--------------|-------|----------|-----------|---------------|-----------------|------------|
| Conservative | 1 | 1 min | Hourly | 30 MB | 900 MB | ✅ Yes |
| Moderate | 1 | 10 min | Every 6h | 44 MB | 1.3 GB | ⚠️ With cleanup |
| Aggressive | 4 | 10 min | Hourly | 1.04 GB | 31 GB | ❌ No |
| Maximum | 31 | 10 min | Hourly | 8.26 GB | 248 GB | ❌ No |

---

## Recommendations

### For Free Tier (1 GB storage)
1. **Use 1-2 feeds maximum**
2. **Record 1-minute clips every hour**
3. **Implement 30-day auto-cleanup**
4. **Expected capacity**: ~720-1,440 recordings/month

### For Pro Tier ($25/month, 100 GB)
1. **Use 4-6 feeds**
2. **Record 10-minute clips every hour**
3. **Implement 7-day auto-cleanup**
4. **Expected capacity**: ~2,000-3,000 recordings/week

### For Team Tier ($599/month, 200 GB)
1. **Use 10-15 feeds**
2. **Record 10-minute clips every hour**
3. **Implement 7-14 day auto-cleanup**
4. **Expected capacity**: ~5,000-10,000 recordings/week

---

## Next Steps

1. **Decide on your recording strategy** based on budget
2. **Set up automated cleanup** to maintain storage limits
3. **Monitor storage usage** via Supabase dashboard
4. **Adjust configuration** as needed based on actual usage

See `scripts/cleanup-old-recordings.js` (to be created) for automated cleanup implementation.
