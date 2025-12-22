-- Add preference_pairs table for RLHF training data
-- This stores pairwise comparisons from human rankings

CREATE TABLE IF NOT EXISTS preference_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
  model_output_id UUID REFERENCES model_outputs(id) ON DELETE CASCADE,
  prompt TEXT,
  chosen TEXT NOT NULL,
  rejected TEXT NOT NULL,
  chosen_confidence FLOAT,
  rejected_confidence FLOAT,
  chosen_accuracy_score INT CHECK (chosen_accuracy_score >= 1 AND chosen_accuracy_score <= 5),
  chosen_completeness_score INT CHECK (chosen_completeness_score >= 1 AND chosen_completeness_score <= 5),
  chosen_clarity_score INT CHECK (chosen_clarity_score >= 1 AND chosen_clarity_score <= 5),
  rejected_accuracy_score INT CHECK (rejected_accuracy_score >= 1 AND rejected_accuracy_score <= 5),
  rejected_completeness_score INT CHECK (rejected_completeness_score >= 1 AND rejected_completeness_score <= 5),
  rejected_clarity_score INT CHECK (rejected_clarity_score >= 1 AND rejected_clarity_score <= 5),
  notes TEXT,
  source VARCHAR(50) DEFAULT 'rlhf',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_preference_pairs_segment ON preference_pairs(segment_id);
CREATE INDEX idx_preference_pairs_model_output ON preference_pairs(model_output_id);
CREATE INDEX idx_preference_pairs_source ON preference_pairs(source);
CREATE INDEX idx_preference_pairs_created_at ON preference_pairs(created_at DESC);

-- Add columns to model_outputs table for detailed ranking data
ALTER TABLE model_outputs 
  ADD COLUMN IF NOT EXISTS detailed_scores JSONB,
  ADD COLUMN IF NOT EXISTS overall_ranking INT[],
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS ranked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ranking_time_seconds INT;

-- Add comments for documentation
COMMENT ON TABLE preference_pairs IS 'Stores pairwise preference comparisons for RLHF training';
COMMENT ON COLUMN preference_pairs.chosen IS 'The preferred transcription text';
COMMENT ON COLUMN preference_pairs.rejected IS 'The less preferred transcription text';
COMMENT ON COLUMN preference_pairs.source IS 'Source of the preference (e.g., rlhf, automated)';
COMMENT ON COLUMN model_outputs.detailed_scores IS 'JSONB object with accuracy, completeness, clarity scores for each output';
COMMENT ON COLUMN model_outputs.overall_ranking IS 'Array of output indices in ranked order [1, 3, 2] means output 1 is best';
COMMENT ON COLUMN model_outputs.ranking_time_seconds IS 'Time spent by human ranker on this segment';
