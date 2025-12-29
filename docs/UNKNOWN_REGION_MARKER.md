# ✅ Unknown Region Marker - Feature Complete

## Status: WORKING ✅

Successfully tested end-to-end on 2025-12-28.

---

## What It Does:

Allows you to **manually mark audio regions containing [UNKNOWN] tokens** and **automatically split the audio** into clean chunks, removing the unclear parts.

### Example:
```
Original Audio (4.6s):
[═══clear═══][XXXX unknown XXXX][════════clear════════]
 0s ———— 0.5s ———— 1.5s ———————— 4.6s

Mark unknown region: 0.5s - 1.5s

Result - 2 clean chunks:
✅ Chunk 0: 0.0s - 0.5s (0.5s)
✅ Chunk 1: 1.5s - 4.6s (3.1s)

Total clean audio: 3.6s (removed 1.0s)
```

---

## How to Use:

### Step 1: Review a Segment with [UNKNOWN]
1. Go to **Confidence Pipeline → Low Confidence**
2. Select a segment
3. Click **Start Review**
4. In the **Manual Transcription** field, add `[UNKNOWN]` where audio is unclear

### Step 2: Mark the Unknown Regions
5. The button **"Mark [UNKNOWN] Regions"** will appear
6. Click it to show the region marker
7. Click **"Add [UNKNOWN] Region"** to create a new region
8. Use the **Start** and **End** sliders to mark the unclear audio portion
9. You can add multiple regions if needed

### Step 3: Save and Split
10. Click **"Save & Split Audio into Clean Chunks"**
11. Wait for success message
12. Done! Clean audio chunks are created and stored

---

## What Happens Behind the Scenes:

### 1. API Call (`/api/segments/[id]/split-unknown`)
- Receives the marked unknown regions
- Downloads original audio from Supabase Storage
- Uses FFmpeg to split audio at region boundaries
- Creates clean chunks (minimum 0.5s each)
- Uploads chunks to `liveatc-segments/chunks/{segment_id}/`

### 2. Storage Structure:
```
liveatc-segments/
  chunks/
    {segment-id}/
      segment_chunk0.mp3  ← First clean chunk
      segment_chunk1.mp3  ← Second clean chunk
      ...
```

### 3. Database Updates:
The `segments` table is updated with:
- `split_into_chunks`: Number of chunks created
- `unknown_regions`: JSON array of marked regions
- `updated_at`: Timestamp

### 4. Response:
```json
{
  "success": true,
  "totalChunks": 2,
  "chunks": [
    {
      "chunkIndex": 0,
      "start": 0,
      "end": 0.5,
      "duration": 0.5,
      "filePath": "chunks/.../segment_chunk0.mp3"
    },
    {
      "chunkIndex": 1,
      "start": 1.5,
      "end": 4.6,
      "duration": 3.1,
      "filePath": "chunks/.../segment_chunk1.mp3"
    }
  ],
  "removedDuration": 1.0,
  "cleanDuration": 3.6
}
```

---

## Integration with Labeled Data:

### Current State:
✅ Audio chunks are created and stored in Supabase
✅ Chunk metadata is logged in database
✅ Original segment is updated with chunk info

### Next Step (TODO):
Create a script to export chunks as training data:

```javascript
// scripts/export-chunks-for-training.js
async function exportChunks() {
  // 1. Query segments where split_into_chunks > 0
  const { data: segments } = await supabase
    .from('segments')
    .select('*, segment_labels(*)')
    .gt('split_into_chunks', 0);
  
  // 2. For each segment:
  segments.forEach(async segment => {
    // Get the original label text
    const label = segment.segment_labels[0];
    
    // Split label text at [UNKNOWN] boundaries
    const textChunks = splitTextAtUnknowns(
      label.transcription,
      segment.unknown_regions
    );
    
    // 3. Match each audio chunk with its text chunk
    for (let i = 0; i < segment.split_into_chunks; i++) {
      const audioPath = `chunks/${segment.id}/segment_chunk${i}.mp3`;
      const text = textChunks[i];
      
      // 4. Export as training sample
      trainingData.push({
        audio: audioPath,
        text: text,
        duration: chunks[i].duration,
        source: 'split_unknown'
      });
    }
  });
}
```

---

## Expected Impact (Based on Your 50 Labeled Segments):

**Before Unknown Region Marker:**
- 22 clean segments (44%)
- 28 with [UNKNOWN] (56% wasted)

**After Using Unknown Region Marker:**
- ~22 original clean segments
- ~10-15 additional chunks from splitting [UNKNOWN] segments
- **Total: ~32-37 usable training samples (+45-68% more data!)**

**Segments that benefit most:**
- ✅ Segments with 1-2 [UNKNOWN] markers
- ✅ [UNKNOWN] at start/end OR in middle
- ✅ Remaining chunks ≥0.5s each

**Segments that won't benefit:**
- ❌ 3+ [UNKNOWNs] scattered throughout (creates tiny chunks)
- ❌ Entire segment is [UNKNOWN]

---

## Testing Results (2025-12-28):

### Test Case:
- Segment: KIAH-app (4.6s duration)
- Marked Region: 0.5s - 1.5s (1.0s to remove)
- Expected: 2 clean chunks

### Result: ✅ SUCCESS
- Created 2 chunks successfully
- Chunk 0: 0.0s - 0.5s (0.5s)
- Chunk 1: 1.5s - 4.6s (3.1s)
- Total clean: 3.6s, Removed: 1.0s
- Chunks uploaded to Supabase Storage
- No console errors
- UI behaved correctly

### Console Output:
```
Chunks created: [Object, Object]
- Chunk 0: 0.5s at chunks/.../segment_chunk0.mp3
- Chunk 1: 3.1s at chunks/.../segment_chunk1.mp3
```

---

##  UI Features:

### Clean, Minimal Design:
- ✅ White background (matches Trim Audio)
- ✅ No emojis
- ✅ Blue theme
- ✅ Slider-based (not waveform)
- ✅ Clear labels and stats

### Real-time Feedback:
- Shows total/removed/clean duration
- Previews chunks that will be created
- Updates as you adjust sliders

### Multiple Regions:
- Can add unlimited regions
- Each has independent Start/End sliders
- Each can be removed individually

---

## Files Modified:

### Component:
- `app/admin/liveatc/components/UnknownRegionMarker.js`
- `app/admin/liveatc/components/UnknownRegionMarker.module.css`

### API:
- `app/api/segments/[id]/split-unknown/route.js`

### Integration:
- `app/admin/liveatc/components/FlaggedSegments.js` (added integration)

---

## Known Limitations:

1. **Minimum chunk size: 0.5s**
   - Chunks shorter than 0.5s are automatically filtered out
   - This is intentional (too short = not useful for training)

2. **No automatic alignment**
   - User must manually mark regions (not automatic)
   - This is intentional (gives user full control)

3. **No text chunk splitting yet**
   - Chunks are created, but labeled text isn't automatically split
   - Need to create export script to match text with audio chunks

---

## Next Steps:

1. ✅ **Feature works end-to-end** - Confirmed!
2. ⏸️ **Use it to process your 28 [UNKNOWN] segments**
   - Should yield ~10-15 extra training samples
3. ⏸️ **Create export script** to automatically:
   - Load chunk metadata from database
   - Split label text at [UNKNOWN] boundaries
   - Match audio chunks with text chunks
   - Export to training data format

---

## Summary:

✅ The Unknown Region Marker is **fully functional** and tested!

You can now:
- Mark unclear audio portions with sliders
- Automatically split audio into clean chunks
- Remove [UNKNOWN] parts from training data
- Get +45-68% more usable training samples from your existing labels!

Ready to use! 🚀
