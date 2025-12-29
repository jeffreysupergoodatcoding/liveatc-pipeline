# Enhanced Audio Trimmer - Remove Multiple Regions

## Feature: Remove sections from audio and concatenate the rest into one continuous segment

### How It Works:

**Example:**
- Original audio: `[A----B----C----D----E]` (5 seconds)
- Mark to remove: region 1 (1s-2s) and region 2 (3.5s-4.5s)
- Result: `[A] + [C] + [E]` = one continuous 3s audio file

---

## UI Changes (AudioTrimmer.js):

### New Features:
1. **"+ Add Region to Remove"** button - adds a new region to cut out
2. **Multiple regions** - each with its own Start/End sliders
3. **Remove button** for each region
4. **Live preview** showing final duration after all removals

### What You See:
```
┌─────────────────────────────────────┐
│ Trim Audio    [+ Add Region to Remove] │
├─────────────────────────────────────┤
│ Remove Region 1          [Remove]   │
│ Start: 1.0s  [========●─────]        │
│ End: 2.0s    [=============●]        │
│ Removing: 1.0s                      │
├─────────────────────────────────────┤
│ Remove Region 2          [Remove]   │
│ Start: 3.5s  [==================●]  │
│ End: 4.5s    [=====================●]│
│ Removing: 1.0s                      │
├─────────────────────────────────────┤
│ Result: 3.0s continuous audio       │
│ (removed 2.0s)                      │
│                                     │
│           [Save Trim]               │
└─────────────────────────────────────┘
```

---

## Backend Processing (trim API):

### Algorithm:
1. **Calculate kept segments** (parts NOT being removed):
   ```javascript
   Input: duration=5s, remove=[[1,2], [3.5,4.5]]
   Kept: [0-1], [2-3.5], [4.5-5]
   ```

2. **Extract each kept segment** using ffmpeg:
   ```bash
   ffmpeg -i input.mp3 -ss 0 -t 1 -c copy seg0.mp3
   ffmpeg -i input.mp3 -ss 2 -t 1.5 -c copy seg1.mp3
   ffmpeg -i input.mp3 -ss 4.5 -t 0.5 -c copy seg2.mp3
   ```

3. **Concatenate segments** into one file:
   ```bash
   # Create concat list
   file 'seg0.mp3'
   file 'seg1.mp3'
   file 'seg2.mp3'
   
   # Concatenate
   ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp3
   ```

4. **Upload to Supabase** as `{original}_trimmed_{timestamp}.mp3`

5. **Update database** with new duration and trimmed file path

---

## Use Cases:

### 1. Remove [UNKNOWN] parts from middle:
```
Original: "United 234 [UNKNOWN] cleared to land"
Mark: 2s-3s (the unknown part)
Result: "United 234 cleared to land" (continuous)
```

### 2. Remove multiple [UNKNOWN] sections:
```
Original: "[UNKNOWN] heading [UNKNOWN] runway 27"
Mark: 0s-1s and 2s-3s
Result: "heading runway 27" (continuous)
```

### 3. Clean up noise/silence:
```
Original: <noise> good_audio <silence> more_good_audio
Mark: noise and silence regions
Result: continuous clean audio
```

---

## Database Schema:

The `segments` table needs a `remove_regions` column:

```sql
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS remove_regions JSONB;

COMMENT ON COLUMN segments.remove_regions IS 'Array of {start, end} regions removed during trimming';
```

---

## Testing:

1. Open a segment in review mode
2. Click **"+ Add Region to Remove"**
3. Adjust sliders to mark unwanted parts
4. Add more regions if needed
5. Click **"Save Trim"**
6. Audio automatically updates to the trimmed version
7. Play it - should be continuous with no gaps

---

## Key Benefits:

✅ **One continuous file** - not multiple chunks
✅ **No page reload** - audio updates instantly
✅ **No popups** - saves silently like current trim
✅ **Flexible** - remove from anywhere (start, middle, end)
✅ **Multiple regions** - remove as many parts as needed
✅ **Simple** - still just one segment to manage

---

## Files Changed:

1. `app/admin/liveatc/components/AudioTrimmer.js` - Added multi-region UI
2. `app/admin/liveatc/components/FlaggedSegments.js` - Updated to pass removeRegions
3. `app/api/segments/[id]/trim/route.js` - Added concatenation logic

---

## Next Step:

Apply the database migration to add the `remove_regions` column, then test it!
