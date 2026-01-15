-- Quick Migration Guide for Audio Trimmer Feature
-- Run this in your Supabase SQL Editor or via CLI

-- Step 1: Add the trim columns to segments table
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS trim_start FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_end FLOAT,
  ADD COLUMN IF NOT EXISTS trimmed_file_path TEXT;

-- Step 2: Add helpful comments
COMMENT ON COLUMN segments.trim_start IS 'Seconds trimmed from the start of the original audio';
COMMENT ON COLUMN segments.trim_end IS 'End time of the trim (not duration from end), in seconds from start of original audio';
COMMENT ON COLUMN segments.trimmed_file_path IS 'Path to the trimmed audio file in storage (if trimmed)';

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_segments_trimmed ON segments(trimmed_file_path) WHERE trimmed_file_path IS NOT NULL;

-- ✅ Done! The audio trimmer feature is now ready to use.
