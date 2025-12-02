-- Fix edge_case_statistics view to avoid counting duplicates from joins
-- The original view was counting rows after joining with edge_case_matches,
-- which inflated counts when segments had multiple matches

DROP VIEW IF EXISTS edge_case_statistics;

CREATE VIEW edge_case_statistics AS
SELECT
    COUNT(*) as total_segments,
    COUNT(*) FILTER (WHERE transcription IS NOT NULL) as transcribed_segments,
    COUNT(*) FILTER (WHERE flagged = TRUE) as flagged_segments,
    COUNT(*) FILTER (WHERE reviewed = TRUE) as reviewed_segments,
    AVG(edge_case_score) FILTER (WHERE edge_case_score IS NOT NULL) as avg_edge_case_score,
    AVG(transcription_confidence) FILTER (WHERE transcription_confidence IS NOT NULL) as avg_transcription_confidence,
    (SELECT COUNT(DISTINCT case_id) FROM edge_case_matches) as unique_edge_cases_detected
FROM segments;

COMMENT ON VIEW edge_case_statistics IS 'Overall statistics for edge case detection system (fixed to avoid duplicate counting)';
