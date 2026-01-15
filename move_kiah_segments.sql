-- Move 6 KIAH approach segments from high confidence to low confidence for manual labeling
-- Run date: 2025-12-27

-- First, let's see what we're moving
SELECT 
  s.id,
  s.transcription_text,
  s.transcription_confidence,
  s.rlhf_candidate,
  s.needs_human_review,
  s.created_at,
  r.airport,
  r.facility
FROM segments s
JOIN recordings r ON s.recording_id = r.id
WHERE r.airport = 'KIAH'
  AND r.facility LIKE '%app%'
  AND s.created_at::date = '2025-12-27'
  AND s.rlhf_candidate = true
ORDER BY s.created_at DESC
LIMIT 6;

-- Now update them to be low confidence (needs human review)
UPDATE segments
SET 
  rlhf_candidate = false,
  needs_human_review = true,
  status = 'needs_human_review'
WHERE id IN (
  SELECT s.id
  FROM segments s
  JOIN recordings r ON s.recording_id = r.id
  WHERE r.airport = 'KIAH'
    AND r.facility LIKE '%app%'
    AND s.created_at::date = '2025-12-27'
    AND s.rlhf_candidate = true
  ORDER BY s.created_at DESC
  LIMIT 6
);

-- Verify the update
SELECT 
  s.id,
  s.transcription_confidence,
  s.rlhf_candidate,
  s.needs_human_review,
  s.status,
  r.airport,
  r.facility
FROM segments s
JOIN recordings r ON s.recording_id = r.id
WHERE r.airport = 'KIAH'
  AND r.facility LIKE '%app%'
  AND s.created_at::date = '2025-12-27'
  AND s.needs_human_review = true
ORDER BY s.created_at DESC
LIMIT 6;
