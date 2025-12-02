-- Audio-First Edge Case Detection Schema Updates
-- Adds fields for audio analysis without transcription

-- Add audio analysis fields to segments table
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS audio_analysis_score FLOAT CHECK (audio_analysis_score >= 0 AND audio_analysis_score <= 1),
  ADD COLUMN IF NOT EXISTS detected_patterns JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS keywords_detected TEXT[],
  ADD COLUMN IF NOT EXISTS transcription_pending BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS audio_features JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS keyword_check_done BOOLEAN DEFAULT FALSE;

-- Create indexes for audio analysis queries
CREATE INDEX IF NOT EXISTS idx_segments_audio_score ON segments(audio_analysis_score DESC);
CREATE INDEX IF NOT EXISTS idx_segments_transcription_pending ON segments(transcription_pending) WHERE transcription_pending = TRUE;
CREATE INDEX IF NOT EXISTS idx_segments_keywords ON segments USING GIN(keywords_detected);
CREATE INDEX IF NOT EXISTS idx_segments_patterns ON segments USING GIN(detected_patterns);

-- Create view for audio-flagged segments (analyzed but not transcribed)
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
  AND s.transcription IS NULL
ORDER BY s.audio_analysis_score DESC;

-- Create view for transcription queue (pending full transcription)
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
  AND s.transcription IS NULL
ORDER BY s.audio_analysis_score DESC, s.created_at ASC;

-- Update statistics view to include audio analysis
DROP VIEW IF EXISTS edge_case_statistics;

CREATE VIEW edge_case_statistics AS
SELECT
    COUNT(*) as total_segments,
    COUNT(*) FILTER (WHERE audio_analysis_score IS NOT NULL) as audio_analyzed_segments,
    COUNT(*) FILTER (WHERE transcription IS NOT NULL) as transcribed_segments,
    COUNT(*) FILTER (WHERE flagged = TRUE) as flagged_segments,
    COUNT(*) FILTER (WHERE reviewed = TRUE) as reviewed_segments,
    COUNT(*) FILTER (WHERE transcription_pending = TRUE) as pending_transcription,
    AVG(audio_analysis_score) FILTER (WHERE audio_analysis_score IS NOT NULL) as avg_audio_score,
    AVG(edge_case_score) FILTER (WHERE edge_case_score IS NOT NULL) as avg_edge_case_score,
    AVG(transcription_confidence) FILTER (WHERE transcription_confidence IS NOT NULL) as avg_transcription_confidence,
    (SELECT COUNT(DISTINCT case_id) FROM edge_case_matches) as unique_edge_cases_detected,
    COUNT(*) FILTER (WHERE array_length(keywords_detected, 1) > 0) as segments_with_keywords
FROM segments;

COMMENT ON VIEW audio_flagged_segments IS 'Segments flagged by audio analysis but not yet transcribed';
COMMENT ON VIEW transcription_queue IS 'Segments pending full transcription approval';
COMMENT ON VIEW edge_case_statistics IS 'Overall statistics including audio-first analysis metrics';
