-- Add audio trimming fields to segments table
-- This allows users to trim silence/static from segment beginnings and endings

ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS trim_start FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_end FLOAT,
  ADD COLUMN IF NOT EXISTS trimmed_file_path TEXT;

-- Add comment to document the columns
COMMENT ON COLUMN segments.trim_start IS 'Seconds trimmed from the start of the original audio';
COMMENT ON COLUMN segments.trim_end IS 'End time of the trim (not duration from end), in seconds from start of original audio';
COMMENT ON COLUMN segments.trimmed_file_path IS 'Path to the trimmed audio file in storage (if trimmed)';

-- Create index for trimmed segments
CREATE INDEX IF NOT EXISTS idx_segments_trimmed ON segments(trimmed_file_path) WHERE trimmed_file_path IS NOT NULL;
