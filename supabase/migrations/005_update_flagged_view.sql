-- Update flagged_segments_with_matches view to include audio-first fields
-- Fixed to work without edge_cases table

-- Drop the existing view first
DROP VIEW IF EXISTS flagged_segments_with_matches;

-- Create the updated view with audio-first fields
CREATE VIEW flagged_segments_with_matches AS
SELECT
    s.id,
    s.recording_id,
    s.segment_index,
    s.file_path,
    s.duration_seconds,
    s.transcription,
    s.transcription_confidence,
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

COMMENT ON VIEW flagged_segments_with_matches IS 'Flagged segments with all associated edge case matches and audio-first analysis data';
