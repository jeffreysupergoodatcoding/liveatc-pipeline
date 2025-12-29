-- Add columns to track audio chunking from unknown region splitting
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS split_into_chunks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unknown_regions JSONB,
  ADD COLUMN IF NOT EXISTS is_chunk BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS chunk_index INTEGER;

-- Add comments
COMMENT ON COLUMN segments.split_into_chunks IS 'Number of clean chunks created from splitting out unknown regions';
COMMENT ON COLUMN segments.unknown_regions IS 'Array of {start, end} regions marked as [UNKNOWN] and removed';
COMMENT ON COLUMN segments.is_chunk IS 'True if this segment is a chunk created from splitting another segment';
COMMENT ON COLUMN segments.parent_segment_id IS 'ID of the parent segment if this is a chunk';
COMMENT ON COLUMN segments.chunk_index IS 'Index of this chunk within the parent segment (0-based)';

-- Create index for querying split segments
CREATE INDEX IF NOT EXISTS idx_segments_split_chunks ON segments(split_into_chunks) WHERE split_into_chunks > 0;

-- Create index for querying chunks
CREATE INDEX IF NOT EXISTS idx_segments_chunks ON segments(parent_segment_id, chunk_index) WHERE is_chunk = TRUE;
