-- Migration to add confidence scoring fields and update views
-- Run this in the Supabase SQL Editor

-- 1. Add new columns to segments table
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS transcription_text TEXT,
  ADD COLUMN IF NOT EXISTS transcription_confidence FLOAT CHECK (transcription_confidence >= 0 AND transcription_confidence <= 1),
  ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rlhf_candidate BOOLEAN DEFAULT FALSE;

-- 2. Create new flagged_segments_with_matches_v2 view (leaving original intact)
-- DROP VIEW IF EXISTS flagged_segments_with_matches; -- Commented out to preserve existing view

CREATE OR REPLACE VIEW flagged_segments_with_matches_v2 AS
SELECT
    s.id,
    s.recording_id,
    s.segment_index,
    s.file_path,
    s.duration_seconds,
    s.transcription,
    s.transcription_confidence,
    s.needs_human_review,
    s.rlhf_candidate,
    s.edge_case_score,
    s.flagged,
    s.reviewed,
    s.reviewed_by,
    s.reviewed_at,
    s.review_notes,
    s.speaker_count,
    s.created_at,
    -- Audio-first analysis fields
    s.audio_analysis_score,
    s.detected_patterns,
    s.keywords_detected,
    s.transcription_pending,
    s.audio_features,
    s.keyword_check_done,
    -- Recording info
    r.airport,
    r.facility,
    r.recorded_at,
    -- Edge case matches (from edge_case_matches table)
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'case_id', ecm.case_id,
                    'case_name', ecm.case_name,
                    'category', ecm.category,
                    'severity', ecm.severity,
                    'match_type', ecm.match_type,
                    'confidence', ecm.confidence,
                    'evidence', ecm.evidence
                )
                ORDER BY ecm.severity DESC, ecm.confidence DESC
            )
            FROM edge_case_matches ecm
            WHERE ecm.segment_id = s.id
        ),
        '[]'::jsonb
    ) as matches
FROM segments s
JOIN recordings r ON s.recording_id = r.id
WHERE s.flagged = TRUE
ORDER BY s.edge_case_score DESC, s.created_at DESC;

COMMENT ON VIEW flagged_segments_with_matches_v2 IS 'Flagged segments V2 (Confidence Scoring) with all associated edge case matches and audio-first analysis data';
