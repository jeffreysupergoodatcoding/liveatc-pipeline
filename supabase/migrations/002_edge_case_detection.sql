-- Edge Case Detection Schema Updates
-- Adds support for transcription, edge case detection, and review workflow

-- Add transcription and edge case fields to segments table
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS transcription_confidence FLOAT CHECK (transcription_confidence >= 0 AND transcription_confidence <= 1),
  ADD COLUMN IF NOT EXISTS detected_edge_cases JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS edge_case_score FLOAT CHECK (edge_case_score >= 0 AND edge_case_score <= 1),
  ADD COLUMN IF NOT EXISTS custom_flags JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS speaker_count INTEGER DEFAULT 1;

-- Create index on edge case score for filtering
CREATE INDEX IF NOT EXISTS idx_segments_edge_case_score ON segments(edge_case_score DESC);
CREATE INDEX IF NOT EXISTS idx_segments_flagged ON segments(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_segments_reviewed ON segments(reviewed);

-- Create custom_rules table to store user-defined detection rules
CREATE TABLE IF NOT EXISTS custom_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    enabled BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on custom_rules
CREATE INDEX IF NOT EXISTS idx_custom_rules_enabled ON custom_rules(enabled) WHERE enabled = TRUE;

-- Create edge_case_matches table for detailed match tracking
CREATE TABLE IF NOT EXISTS edge_case_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    case_id TEXT NOT NULL,
    case_name TEXT NOT NULL,
    category TEXT NOT NULL,
    severity FLOAT NOT NULL CHECK (severity >= 0 AND severity <= 1),
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    match_type TEXT NOT NULL,
    evidence JSONB,
    is_custom_rule BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on edge_case_matches
CREATE INDEX IF NOT EXISTS idx_edge_case_matches_segment_id ON edge_case_matches(segment_id);
CREATE INDEX IF NOT EXISTS idx_edge_case_matches_case_id ON edge_case_matches(case_id);
CREATE INDEX IF NOT EXISTS idx_edge_case_matches_category ON edge_case_matches(category);
CREATE INDEX IF NOT EXISTS idx_edge_case_matches_severity ON edge_case_matches(severity DESC);

-- Create function to update updated_at on custom_rules
CREATE OR REPLACE FUNCTION update_custom_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for custom_rules updated_at
CREATE TRIGGER update_custom_rules_updated_at_trigger
    BEFORE UPDATE ON custom_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_rules_updated_at();

-- Create view for flagged segments with match details
CREATE OR REPLACE VIEW flagged_segments_with_matches AS
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
    r.airport,
    r.facility,
    r.recorded_at,
    COALESCE(
        json_agg(
            json_build_object(
                'case_id', m.case_id,
                'case_name', m.case_name,
                'category', m.category,
                'severity', m.severity,
                'confidence', m.confidence,
                'match_type', m.match_type,
                'evidence', m.evidence,
                'is_custom_rule', m.is_custom_rule
            ) ORDER BY m.severity DESC, m.confidence DESC
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
    ) as matches
FROM segments s
LEFT JOIN recordings r ON s.recording_id = r.id
LEFT JOIN edge_case_matches m ON s.id = m.segment_id
WHERE s.flagged = TRUE
GROUP BY s.id, r.id;

-- Create view for detection statistics
CREATE OR REPLACE VIEW edge_case_statistics AS
SELECT
    COUNT(*) as total_segments,
    COUNT(*) FILTER (WHERE transcription IS NOT NULL) as transcribed_segments,
    COUNT(*) FILTER (WHERE flagged = TRUE) as flagged_segments,
    COUNT(*) FILTER (WHERE reviewed = TRUE) as reviewed_segments,
    AVG(edge_case_score) FILTER (WHERE edge_case_score IS NOT NULL) as avg_edge_case_score,
    AVG(transcription_confidence) FILTER (WHERE transcription_confidence IS NOT NULL) as avg_transcription_confidence,
    COUNT(DISTINCT m.case_id) as unique_edge_cases_detected
FROM segments s
LEFT JOIN edge_case_matches m ON s.id = m.segment_id;

-- Create function to get edge cases by category
CREATE OR REPLACE FUNCTION get_edge_cases_by_category()
RETURNS TABLE (
    category TEXT,
    case_count BIGINT,
    avg_severity FLOAT,
    total_matches BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.category,
        COUNT(DISTINCT m.case_id) as case_count,
        AVG(m.severity) as avg_severity,
        COUNT(*) as total_matches
    FROM edge_case_matches m
    GROUP BY m.category
    ORDER BY total_matches DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment on tables
COMMENT ON TABLE custom_rules IS 'User-defined custom detection rules for edge case identification';
COMMENT ON TABLE edge_case_matches IS 'Detailed matches of edge cases detected in segments';
COMMENT ON VIEW flagged_segments_with_matches IS 'Flagged segments with all associated edge case matches';
COMMENT ON VIEW edge_case_statistics IS 'Overall statistics for edge case detection system';
