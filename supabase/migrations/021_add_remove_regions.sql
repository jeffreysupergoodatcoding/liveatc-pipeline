-- Migration: Add remove_regions column for enhanced audio trimming
-- This allows storing multiple regions that were removed during trimming

ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS remove_regions JSONB;

COMMENT ON COLUMN segments.remove_regions IS 'Array of {start, end} regions removed during trimming to create concatenated audio';
