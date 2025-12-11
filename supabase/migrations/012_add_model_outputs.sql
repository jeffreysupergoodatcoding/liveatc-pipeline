-- Add model_outputs table for storing transcription variations from Deepgram
-- This supports the RL environment for high-confidence segments (>90%)

-- Create model_outputs table
CREATE TABLE model_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
    variations JSONB NOT NULL,
    needs_ranking BOOLEAN DEFAULT true,
    rankings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_model_outputs_segment ON model_outputs(segment_id);
CREATE INDEX idx_model_outputs_needs_ranking ON model_outputs(needs_ranking);

-- Update segments table status enum to include 'needs_ranking'
-- First, add the new value to the check constraint
ALTER TABLE segments DROP CONSTRAINT IF EXISTS segments_status_check;
ALTER TABLE segments ADD CONSTRAINT segments_status_check 
    CHECK (status IN ('pending', 'active', 'reviewed', 'rejected', 'needs_ranking', 'needs_human_review'));

-- Add comment for documentation
COMMENT ON TABLE model_outputs IS 'Stores multiple transcription variations from Deepgram for RLHF training';
COMMENT ON COLUMN model_outputs.variations IS 'JSONB array containing 3 transcription alternatives with text, confidence, and rank_position';
COMMENT ON COLUMN model_outputs.needs_ranking IS 'Flag indicating if this output needs human ranking for RLHF';
COMMENT ON COLUMN model_outputs.rankings IS 'JSONB object storing human rankings when completed';
