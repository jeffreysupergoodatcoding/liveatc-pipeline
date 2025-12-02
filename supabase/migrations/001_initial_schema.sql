-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create recordings table
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    airport TEXT NOT NULL,
    facility TEXT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_seconds INTEGER NOT NULL,
    source_url TEXT NOT NULL,
    raw_file_path TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'segmented', 'error')),
    segment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on recordings for common queries
CREATE INDEX idx_recordings_airport_facility ON recordings(airport, facility);
CREATE INDEX idx_recordings_recorded_at ON recordings(recorded_at DESC);
CREATE INDEX idx_recordings_status ON recordings(status);

-- Create segments table
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    duration_seconds FLOAT NOT NULL,
    start_time_in_recording FLOAT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    audio_quality_score FLOAT CHECK (audio_quality_score >= 0 AND audio_quality_score <= 1),
    label_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'reviewed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recording_id, segment_index)
);

-- Create index on segments for common queries
CREATE INDEX idx_segments_recording_id ON segments(recording_id);
CREATE INDEX idx_segments_status ON segments(status);
CREATE INDEX idx_segments_label_count ON segments(label_count);

-- Create segment_labels table
CREATE TABLE segment_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    user_id UUID,
    transcription TEXT,
    response TEXT,
    confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
    replay_count INTEGER DEFAULT 0,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on segment_labels
CREATE INDEX idx_segment_labels_segment_id ON segment_labels(segment_id);
CREATE INDEX idx_segment_labels_user_id ON segment_labels(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on recordings
CREATE TRIGGER update_recordings_updated_at
    BEFORE UPDATE ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to update segment count when segments are added/removed
CREATE OR REPLACE FUNCTION update_recording_segment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE recordings
        SET segment_count = segment_count + 1
        WHERE id = NEW.recording_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE recordings
        SET segment_count = segment_count - 1
        WHERE id = OLD.recording_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update segment count
CREATE TRIGGER update_segment_count_on_insert
    AFTER INSERT ON segments
    FOR EACH ROW
    EXECUTE FUNCTION update_recording_segment_count();

CREATE TRIGGER update_segment_count_on_delete
    AFTER DELETE ON segments
    FOR EACH ROW
    EXECUTE FUNCTION update_recording_segment_count();

-- Create function to update label count when labels are added/removed
CREATE OR REPLACE FUNCTION update_segment_label_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE segments
        SET label_count = label_count + 1
        WHERE id = NEW.segment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE segments
        SET label_count = label_count - 1
        WHERE id = OLD.segment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update label count
CREATE TRIGGER update_label_count_on_insert
    AFTER INSERT ON segment_labels
    FOR EACH ROW
    EXECUTE FUNCTION update_segment_label_count();

CREATE TRIGGER update_label_count_on_delete
    AFTER DELETE ON segment_labels
    FOR EACH ROW
    EXECUTE FUNCTION update_segment_label_count();
