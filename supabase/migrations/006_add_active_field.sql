-- Add 'active' field to segments table for user selection
-- Active segments are queued for analysis

ALTER TABLE segments
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT FALSE;

-- Add index for faster querying of active segments
CREATE INDEX IF NOT EXISTS idx_segments_active ON segments(active) WHERE active = TRUE;

COMMENT ON COLUMN segments.active IS 'Whether this segment is queued for analysis by the user';
