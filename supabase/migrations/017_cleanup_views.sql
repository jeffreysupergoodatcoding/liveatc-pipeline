-- ============================================================================
-- Clean Up Duplicate and Versioned Views
-- ============================================================================
-- This migration removes duplicate views and consolidates to single versions
-- ============================================================================

-- Drop the versioned view (flagged_segments_with_matches_v2)
-- The main view (flagged_segments_with_matches) is kept and updated in migration 016
DROP VIEW IF EXISTS flagged_segments_with_matches_v2 CASCADE;

-- Drop any other duplicate or unused views
-- (Add more here if you find others during the audit)

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with:
--
-- SELECT schemaname, viewname
-- FROM pg_views
-- WHERE schemaname = 'public'
-- ORDER BY viewname;
--
-- Should NOT include any _v2 or duplicate views
-- ============================================================================
