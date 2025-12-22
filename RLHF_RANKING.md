# RLHF Ranking Interface

A fast, intuitive interface for ranking transcription outputs to generate RLHF training data.

## Overview

This interface allows human reviewers to:
- Rate 3 transcription outputs on Accuracy, Completeness, and Clarity (1-5 stars each)
- Rank outputs overall using drag-and-drop
- Add contextual notes
- Target: 5 minutes per segment

## Setup

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```bash
supabase/migrations/013_add_preference_pairs.sql
```

This creates:
- `preference_pairs` table for storing pairwise comparisons
- Additional columns on `model_outputs` for detailed ranking data

### 2. Access the Interface

Navigate to: `http://localhost:3000/rank-outputs`

## Features

### Audio Playback
- Auto-plays on page load
- Standard HTML5 audio controls
- Keyboard shortcut: **Space** = Play/Pause

### Rating System
Each output gets rated on 3 metrics (1-5 stars):
- **Accuracy**: Callsigns, numbers, and critical aviation terms are correct
- **Completeness**: All information from the audio is included
- **Clarity**: Understandable without ambiguity or confusion

### Overall Ranking
- Drag outputs to reorder (top = best)
- Creates 3 preference pairs from ranking:
  - 1st > 2nd
  - 1st > 3rd
  - 2nd > 3rd

### Progress Tracking
- Segments ranked today
- Total segments ranked
- Average time per segment

### Auto-Save
- Draft rankings saved to localStorage
- Restored on page refresh
- Cleared after successful submission

### Keyboard Shortcuts
- **Space**: Play/Pause audio
- **S**: Submit rankings
- **N**: Load next segment

## Workflow

1. Audio auto-plays when segment loads
2. Listen to audio while reviewing 3 transcription outputs
3. Rate each output on all 3 metrics (1-5 stars)
4. Drag outputs to set overall ranking
5. Add notes (optional) about edge cases or observations
6. Click "Submit Rankings" (stays on page)
7. Click "Next Segment" to manually load next unranked segment

## Validation

Before submission, the interface validates:
- All 9 star ratings are filled (3 metrics × 3 outputs)
- Overall ranking is set (via drag-and-drop)

## Data Storage

### preference_pairs Table
Each submission creates 3 preference pairs with:
- `chosen` and `rejected` transcription text
- Confidence scores from Deepgram
- All metric scores for both outputs
- Notes from reviewer
- Source = 'rlhf'

### model_outputs Table
Updated with:
- `detailed_scores`: All 9 metric scores
- `overall_ranking`: Array like [1, 3, 2]
- `notes`: Reviewer notes
- `ranked_at`: Timestamp
- `ranking_time_seconds`: Time spent
- `needs_ranking`: Set to false

## API Endpoints

### GET /api/rank-outputs/next
Fetches next unranked segment with:
- Model output ID
- Segment metadata (airport, facility, duration)
- Audio URL
- 3 transcription variations
- Original transcription

### POST /api/rank-outputs
Submits rankings:
- Creates 3 preference pairs
- Updates model_outputs table
- Returns success status

### GET /api/rank-outputs/stats
Returns statistics:
- Ranked today count
- Total ranked count
- Average time in minutes

## Performance Target

**Goal**: 5 minutes per segment

Current average is displayed in the progress tracker.

## Tips for Reviewers

1. **Listen First**: Play the audio before rating
2. **Be Consistent**: Use the same standards across all segments
3. **Use Notes**: Document edge cases, unusual terminology, or difficult audio
4. **Take Breaks**: Maintain quality by avoiding fatigue
5. **Check Confidence**: Deepgram confidence scores can guide your ratings

## Troubleshooting

### No segments available
- Check that `model_outputs` table has rows with `needs_ranking=true`
- Verify that segments have been processed for RLHF

### Audio won't play
- Check Supabase Storage bucket permissions
- Verify audio file exists at the URL
- Try clicking play manually (browser auto-play restrictions)

### Submission fails
- Check browser console for errors
- Verify all ratings are filled
- Ensure database connection is working

## Future Enhancements

- [ ] Batch mode: Load multiple segments at once
- [ ] Filtering: Skip certain airports/facilities
- [ ] Analytics: Show inter-rater reliability
- [ ] Export: Download preference pairs as JSON/CSV
- [ ] Playback speed control
- [ ] Waveform visualization
