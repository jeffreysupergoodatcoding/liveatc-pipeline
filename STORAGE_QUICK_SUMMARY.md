# Storage Capacity - Quick Summary

## 📊 Your Current Setup

### Supabase Free Tier
- **File Storage Limit**: 1 GB
- **Database Limit**: 500 MB (not a concern - can hold millions of records)

---

## 🎯 How Much Audio Can You Store?

### Quick Answer by Configuration

| Setup | Audio Data | Recordings | Duration |
|-------|------------|------------|----------|
| **1 feed, 1-min clips, hourly** | 900 MB/month | 720/month | 12 hours total |
| **1 feed, 10-min clips, hourly** | 7.98 GB/month | 720/month | 120 hours total |
| **4 feeds, 10-min clips, hourly** | 31.2 GB/month | 2,880/month | 480 hours total |
| **31 feeds, 10-min clips, hourly** | 248 GB/month | 22,320/month | 3,720 hours total |

---

## ✅ Recommended for FREE Tier (1 GB)

### Best Option: 1 Feed with Auto-Cleanup
```bash
# Configuration
RECORDING_DURATION=60        # 1 minute
RECORDING_SCHEDULE="0 * * * *"  # Every hour
```

**Result:**
- ✅ 30 days of rolling data
- ✅ 720 recordings per month
- ✅ ~8,640 audio segments
- ✅ Stays under 1 GB limit

### Run cleanup monthly:
```bash
node scripts/cleanup-old-recordings.js --days 30
```

---

## 💰 Paid Tier Comparison

### Pro Tier ($25/month) - 100 GB Storage

**Capacity:**
- **1 feed**: ~12 months of 10-min hourly recordings
- **4 feeds**: ~3 months of 10-min hourly recordings
- **With 7-day cleanup**: Sustainable for 4-6 feeds indefinitely

### Team Tier ($599/month) - 200 GB Storage

**Capacity:**
- **All 31 feeds**: ~24 days without cleanup
- **With 7-day cleanup**: Sustainable for 10-15 feeds indefinitely

---

## 📈 Storage Math

### File Sizes (128kbps MP3)
- **1 minute**: ~1 MB
- **10 minutes**: ~10 MB
- **1 hour**: ~58 MB

### Per Recording (10 minutes)
- Raw file: ~10 MB
- Segments: ~1.5 MB
- **Total**: ~11 MB

### Daily Storage (1 feed, hourly)
- 24 recordings × 11 MB = **264 MB/day**
- **Free tier fills in ~4 days** without cleanup

---

## 🔧 Optimization Strategies

### 1. Shorter Recordings ⭐ Best for Free Tier
```bash
RECORDING_DURATION=60  # 1 minute instead of 10
```
**Saves**: 90% storage

### 2. Less Frequent Recording
```bash
RECORDING_SCHEDULE="0 */6 * * *"  # Every 6 hours instead of hourly
```
**Saves**: 75% storage

### 3. Auto-Cleanup ⭐ Essential
```bash
# Delete recordings older than 30 days
node scripts/cleanup-old-recordings.js --days 30
```
**Maintains**: Fixed storage footprint

### 4. Segment-Only Storage
Keep segments, delete raw files
**Saves**: 85% storage

---

## 🎓 Example Scenarios

### Scenario A: Maximum Free Tier Usage
```
1 feed × 1-min clips × hourly × 30-day retention
= 900 MB total
= 720 recordings
= ~8,640 segments
✅ Fits in free tier!
```

### Scenario B: Research Project (Pro Tier)
```
6 feeds × 10-min clips × hourly × 7-day retention
= ~46 GB total
= ~1,000 recordings/week
= ~12,000 segments/week
✅ Fits in Pro tier ($25/month)
```

### Scenario C: Production Pipeline (Team Tier)
```
15 feeds × 10-min clips × hourly × 7-day retention
= ~115 GB total
= ~2,500 recordings/week
= ~30,000 segments/week
✅ Fits in Team tier ($599/month)
```

---

## 🚀 Getting Started

### Step 1: Choose Your Configuration
Start conservative with free tier:
```bash
RECORDING_DURATION=60
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"}
]'
```

### Step 2: Set Up Auto-Cleanup
Add to crontab:
```bash
# Run cleanup daily at 3 AM
0 3 * * * cd /path/to/liveatc-pipeline && node scripts/cleanup-old-recordings.js --days 30
```

### Step 3: Monitor Storage
Check Supabase dashboard regularly:
- Settings → Storage → Usage

### Step 4: Scale Up
When you need more:
1. Upgrade to Pro tier ($25/month)
2. Add more feeds
3. Adjust retention period

---

## 📝 Quick Commands

```bash
# Test cleanup (no changes)
node scripts/cleanup-old-recordings.js --days 30 --dry-run

# Actually delete old recordings
node scripts/cleanup-old-recordings.js --days 30

# Delete recordings older than 7 days
node scripts/cleanup-old-recordings.js --days 7
```

---

## 💡 Pro Tips

1. **Start small**: Test with 1 feed and 1-minute recordings
2. **Monitor usage**: Check Supabase dashboard weekly
3. **Automate cleanup**: Set up cron job for hands-off operation
4. **Adjust as needed**: Scale up when you understand your needs
5. **Consider segments only**: If you don't need raw files, delete them to save 85% space

---

For detailed analysis, see `STORAGE_CAPACITY_ANALYSIS.md`
