# Fix Statistics View

## Issue
The `edge_case_statistics` view is showing incorrect counts because it's joining with `edge_case_matches`, which inflates the numbers when segments have multiple matches.

## Current State
- View shows: 16 segments, 5 transcribed, 5 flagged
- Actual data: 12 segments, 1 transcribed, 1 flagged

## Solution
Apply this SQL migration to fix the view:

```sql
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
```

## How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard/project/wqppszoyvtqauthbvtgc/sql
2. Copy the SQL above
3. Paste and click "Run"

### Option 2: Helper Script
```bash
./scripts/fix-statistics-view.js
```

This will display the SQL for you to copy/paste into Supabase dashboard.

## Verification
After applying, run:
```bash
curl -s "https://wqppszoyvtqauthbvtgc.supabase.co/rest/v1/edge_case_statistics" \
  -H "apikey: YOUR_SERVICE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

You should see correct counts matching the actual data.
