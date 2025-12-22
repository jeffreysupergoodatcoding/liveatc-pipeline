-- ============================================================================
-- Remove Duplicate Column: transcription
-- ============================================================================
-- The segments table has both 'transcription' and 'transcription_text' columns.
-- The codebase uses 'transcription_text', so we'll remove the duplicate
-- 'transcription' column that was added by later migrations.
-- 
-- NOTE: This will drop and recreate views that depend on the transcription column
-- ============================================================================

-- First, check if there's any data in the 'transcription' column that's not in 'transcription_text'
-- If so, copy it over before dropping
DO $$
BEGIN
    -- Check if both columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'segments' AND column_name = 'transcription'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'segments' AND column_name = 'transcription_text'
    ) THEN
        -- Copy any data from 'transcription' to 'transcription_text' if transcription_text is null
        UPDATE segments
        SET transcription_text = transcription
        WHERE transcription IS NOT NULL
          AND (transcription_text IS NULL OR transcription_text = '');
        
        -- Drop the duplicate column with CASCADE to drop dependent views
        ALTER TABLE segments DROP COLUMN transcription CASCADE;
        
        RAISE NOTICE 'Dropped duplicate column: segments.transcription and dependent views';
    ELSE
        RAISE NOTICE 'Column conflict does not exist or already resolved';
    END IF;
END $$;

-- Update any views that might reference the old 'transcription' column
-- Note: Most views should already use the correct column name

-- Update flagged_segments_with_matches view if it exists
DROP VIEW IF EXISTS flagged_segments_with_matches CASCADE;

CREATE VIEW flagged_segments_with_matches AS
SELECT
    s.id,
    s.recording_id,
    s.segment_index,
    s.file_path,
    s.duration_seconds,
    s.transcription_text,  -- Using correct column name
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
    -- Edge case matches
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

COMMENT ON VIEW flagged_segments_with_matches IS 'Flagged segments with all associated edge case matches (using transcription_text column)';

-- Update edge_case_statistics view to use correct column
DROP VIEW IF EXISTS edge_case_statistics CASCADE;

CREATE VIEW edge_case_statistics AS
SELECT
    COUNT(*) as total_segments,
    COUNT(*) FILTER (WHERE audio_analysis_score IS NOT NULL) as audio_analyzed_segments,
    COUNT(*) FILTER (WHERE transcription_text IS NOT NULL) as transcribed_segments,  -- Fixed column name
    COUNT(*) FILTER (WHERE flagged = TRUE) as flagged_segments,
    COUNT(*) FILTER (WHERE reviewed = TRUE) as reviewed_segments,
    COUNT(*) FILTER (WHERE transcription_pending = TRUE) as pending_transcription,
    AVG(audio_analysis_score) FILTER (WHERE audio_analysis_score IS NOT NULL) as avg_audio_score,
    AVG(edge_case_score) FILTER (WHERE edge_case_score IS NOT NULL) as avg_edge_case_score,
    AVG(transcription_confidence) FILTER (WHERE transcription_confidence IS NOT NULL) as avg_transcription_confidence,
    (SELECT COUNT(DISTINCT case_id) FROM edge_case_matches) as unique_edge_cases_detected,
    COUNT(*) FILTER (WHERE array_length(keywords_detected, 1) > 0) as segments_with_keywords
FROM segments;

COMMENT ON VIEW edge_case_statistics IS 'Overall statistics including audio-first analysis metrics (using transcription_text column)';

-- Recreate audio_flagged_segments view (was dropped by CASCADE)
CREATE OR REPLACE VIEW audio_flagged_segments AS
SELECT
    s.id,
    s.recording_id,
    s.segment_index,
    s.file_path,
    s.duration_seconds,
    s.audio_analysis_score,
    s.detected_patterns,
    s.keywords_detected,
    s.transcription_pending,
    s.audio_features,
    s.keyword_check_done,
    s.created_at,
    r.airport,
    r.facility,
    r.recorded_at
FROM segments s
JOIN recordings r ON s.recording_id = r.id
WHERE s.audio_analysis_score IS NOT NULL
  AND s.audio_analysis_score >= 0.65
  AND s.transcription_text IS NULL  -- Fixed column name
ORDER BY s.audio_analysis_score DESC;

COMMENT ON VIEW audio_flagged_segments IS 'Segments flagged by audio analysis but not yet transcribed';

-- Recreate transcription_queue view (was dropped by CASCADE)
CREATE OR REPLACE VIEW transcription_queue AS
SELECT
    s.id,
    s.recording_id,
    s.segment_index,
    s.file_path,
    s.duration_seconds,
    s.audio_analysis_score,
    s.detected_patterns,
    s.keywords_detected,
    s.audio_features,
    s.created_at,
    r.airport,
    r.facility,
    r.recorded_at
FROM segments s
JOIN recordings r ON s.recording_id = r.id
WHERE s.transcription_pending = TRUE
  AND s.transcription_text IS NULL  -- Fixed column name
ORDER BY s.audio_analysis_score DESC, s.created_at ASC;

COMMENT ON VIEW transcription_queue IS 'Segments pending full transcription approval';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with:
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'segments'
--   AND column_name LIKE '%transcription%'
-- ORDER BY column_name;
--
-- Should only show:
-- - transcription_confidence
-- - transcription_pending
-- - transcription_text
-- ============================================================================
