-- Sample data for testing the RLHF ranking interface
-- Run this in Supabase SQL Editor AFTER running migration 013_add_preference_pairs.sql

-- This script creates sample model_outputs with variations for testing
-- Make sure you have at least one segment in your database first

-- Insert a sample model_output with 3 variations
-- Replace 'YOUR_SEGMENT_ID_HERE' with an actual segment ID from your database

/*
-- First, get a segment ID:
SELECT id FROM segments LIMIT 1;

-- Then use that ID below:
INSERT INTO model_outputs (segment_id, variations, needs_ranking)
VALUES (
  'YOUR_SEGMENT_ID_HERE'::uuid,
  '[
    {
      "text": "Delta 123 cleared for takeoff runway 22 left",
      "confidence": 0.95,
      "rank_position": 1
    },
    {
      "text": "Delta 123 clear for takeoff runway 22 left",
      "confidence": 0.92,
      "rank_position": 2
    },
    {
      "text": "Delta 123 cleared for takeoff runway 20 to left",
      "confidence": 0.88,
      "rank_position": 3
    }
  ]'::jsonb,
  true
);
*/

-- Alternative: Create sample data if you don't have segments yet
-- This creates a complete test segment with recording and model_output

DO $$
DECLARE
  v_recording_id UUID;
  v_segment_id UUID;
BEGIN
  -- Create a sample recording
  INSERT INTO recordings (airport, facility, recorded_at, duration_seconds, source_url, status)
  VALUES ('KJFK', 'ground', NOW(), 300, 'http://example.com/test.mp3', 'segmented')
  RETURNING id INTO v_recording_id;

  -- Create a sample segment
  INSERT INTO segments (
    recording_id, 
    segment_index, 
    file_path, 
    duration_seconds, 
    start_time_in_recording, 
    file_size_bytes,
    transcription_text,
    transcription_confidence,
    status
  )
  VALUES (
    v_recording_id,
    1,
    'test-segment.mp3',
    5.5,
    10.0,
    50000,
    'Delta 123 cleared for takeoff runway 22 left',
    0.95,
    'needs_ranking'
  )
  RETURNING id INTO v_segment_id;

  -- Create model_output with 3 variations
  INSERT INTO model_outputs (segment_id, variations, needs_ranking)
  VALUES (
    v_segment_id,
    '[
      {
        "text": "Delta 123 cleared for takeoff runway 22 left",
        "confidence": 0.95,
        "rank_position": 1
      },
      {
        "text": "Delta 123 clear for takeoff runway 22 left",
        "confidence": 0.92,
        "rank_position": 2
      },
      {
        "text": "Delta 123 cleared for takeoff runway 20 to left",
        "confidence": 0.88,
        "rank_position": 3
      }
    ]'::jsonb,
    true
  );

  RAISE NOTICE 'Created test data: recording_id=%, segment_id=%', v_recording_id, v_segment_id;
END $$;

-- Verify the data was created
SELECT 
  mo.id as model_output_id,
  s.id as segment_id,
  r.airport,
  r.facility,
  s.duration_seconds,
  mo.needs_ranking,
  jsonb_array_length(mo.variations) as variation_count
FROM model_outputs mo
JOIN segments s ON mo.segment_id = s.id
JOIN recordings r ON s.recording_id = r.id
WHERE mo.needs_ranking = true
ORDER BY mo.created_at DESC
LIMIT 5;
