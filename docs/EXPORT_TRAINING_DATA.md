# ✅ Training Data Export Script - WITH CHUNKS

## Script Created: `scripts/export-training-data.js`

This script exports **ALL** your training data including:
1. ✅ Clean labeled segments (no [UNKNOWN])
2. ✅ Audio chunks from split unknown regions

---

## Before Running:

### **Step 1: Apply Database Migration**

The migration SQL has been **copied to your clipboard**!

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. **Paste** the migration (already in clipboard!)
4. Click **Run**

**What it adds:**
- `split_into_chunks` column (tracks number of chunks)
- `unknown_regions` column (stores region boundaries)
- Index for fast queries

---

## How to Run:

```bash
node -r dotenv/config scripts/export-training-data.js
```

---

## What It Does:

### **Step 1: Export Clean Segments**
- Fetches all labeled segments WITHOUT [UNKNOWN]
- Downloads audio from Supabase Storage
- Saves to `training_data/audio/clean_{id}.mp3`
- Creates metadata entries

### **Step 2: Export Chunks**
- Finds all segments where `split_into_chunks > 0`
- Downloads each chunk from `liveatc-segments/chunks/`
- Splits the label text at [UNKNOWN] markers
- Saves to `training_data/audio/chunk_{id}_{index}.mp3`
- Creates metadata entries

### **Step 3: Write Metadata**
- Combines all samples into `training_data/metadata.jsonl`
- Each line is a JSON object:

```json
{
  "audio": "audio/clean_abc123.mp3",
  "text": "United 234 cleared to land runway 27 left",
  "duration": 4.2,
  "source": "clean_segment",
  "metadata": {
    "segment_id": "abc123",
    "context": "emergency situation"
  }
}
```

OR for chunks:

```json
{
  "audio": "audio/chunk_abc123_0.mp3",
  "text": "United 234 cleared to land",
  "duration": 2.1,
  "source": "split_chunk",
  "metadata": {
    "segment_id": "abc123",
    "chunk_index": 0,
    "context": "emergency situation"
  }
}
```

---

## Output Structure:

```
training_data/
  audio/
    clean_abc123.mp3      ← Full clean segment
    clean_def456.mp3      ← Another clean segment
    chunk_xyz789_0.mp3    ← First chunk from split segment
    chunk_xyz789_1.mp3    ← Second chunk from split segment
    ...
  metadata.jsonl          ← All training data metadata
```

---

## Example Output:

```
🚀 Exporting training data...

📦 Fetching clean labeled segments...
✅ Found 22 clean labeled segments
  Exported 10/22 clean segments...
  Exported 20/22 clean segments...
✅ Exported 22 clean segments

🔪 Fetching split segments with chunks...
✅ Found 1 segments with chunks
✅ Exported 2 chunks from 1 split segments

💾 Writing metadata file...
✅ Wrote 24 training samples to /path/to/training_data/metadata.jsonl

═══════════════════════════════════════════════
📊 EXPORT SUMMARY
═══════════════════════════════════════════════
Total training samples:  24
  - Clean segments:      22
  - Split chunks:        2

Output directory:        /path/to/training_data
Audio files:             /path/to/training_data/audio
Metadata:                /path/to/training_data/metadata.jsonl
═══════════════════════════════════════════════

📈 STATISTICS
═══════════════════════════════════════════════
Total audio duration:    95.3s (1.6 minutes)
Average duration:        4.0s
═══════════════════════════════════════════════

✅ Export complete!
```

---

## How Text Splitting Works:

If your label is:
```
"United 234 [UNKNOWN] cleared to land [UNKNOWN] runway 27 left"
```

And you have 2 unknown regions:
- Region 1: 1.0s - 1.5s
- Region 2: 3.0s - 3.5s

The script will:
1. Split text by `[UNKNOWN]` → `["United 234", "cleared to land", "runway 27 left"]`
2. Match each text chunk with its audio chunk:
   - Chunk 0 (0.0s - 1.0s): "United 234"
   - Chunk 1 (1.5s - 3.0s): "cleared to land"
   - Chunk 2 (3.5s - end): "runway 27 left"

---

## Training Data Format:

The `metadata.jsonl` file can be used directly with most ASR training frameworks:

### **For HuggingFace datasets:**
```python
from datasets import load_dataset

dataset = load_dataset('json', data_files='training_data/metadata.jsonl')

# Audio paths are relative to training_data/
# So prepend the base path when loading audio
```

### **For Custom Training:**
```python
import json

with open('training_data/metadata.jsonl') as f:
    for line in f:
        sample = json.loads(line)
        audio_path = f"training_data/{sample['audio']}"
        text = sample['text']
        duration = sample['duration']
        # Use for training...
```

---

## Next Steps:

1. ✅ Apply the database migration (already in clipboard!)
2. ✅ Run the export script when ready
3. ✅ Use exported data to train your model!

---

## Summary:

You now have a **complete export pipeline** that:
- ✅ Exports all clean labeled segments
- ✅ Exports all audio chunks from split unknowns
- ✅ Automatically splits label text to match chunks
- ✅ Creates training-ready JSONL metadata
- ✅ Organizes everything in `training_data/` directory

**Total training samples = clean segments + chunks from splits!** 🎉

With your current 50 labels:
- 22 clean segments
- ~2-4 split segments with ~4-8 chunks
- **Total: ~26-30 training samples!**
