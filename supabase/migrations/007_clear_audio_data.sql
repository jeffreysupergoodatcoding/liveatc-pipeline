-- Clear audio analysis data to start fresh
UPDATE segments
SET
  audio_analysis_score = NULL,
  detected_patterns = NULL,
  audio_features = NULL,
  transcription = NULL,
  transcription_confidence = NULL,
  edge_case_score = NULL,
  speaker_count = NULL,
  flagged = FALSE,
  detected_edge_cases = NULL;

-- Clear edge case matches
DELETE FROM edge_case_matches;
