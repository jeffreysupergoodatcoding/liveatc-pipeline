-- Add manual_transcription column to segments table
ALTER TABLE segments
ADD COLUMN IF NOT EXISTS manual_transcription BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN segments.manual_transcription IS 'Indicates if the transcription was manually entered by a human reviewer';
