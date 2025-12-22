-- ============================================================================
-- COMPREHENSIVE SUPABASE DATABASE AUDIT
-- ============================================================================
-- Run this in Supabase SQL Editor to check for errors and warnings
-- Copy and paste this entire file into the SQL Editor and run it
-- ============================================================================

SELECT '========================================' AS "SECTION 1: ROW LEVEL SECURITY STATUS";

-- Check if RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity THEN '✅ Protected'
    ELSE '❌ UNPROTECTED - SECURITY RISK!'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity ASC, tablename;

SELECT '========================================' AS "SECTION 2: RLS POLICIES";

-- Check what policies exist for each table
SELECT
  tablename,
  COUNT(*) as policy_count,
  string_agg(DISTINCT cmd::text, ', ') as operations_covered
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Detailed policy view
SELECT
  tablename,
  policyname,
  cmd as operation,
  roles,
  CASE
    WHEN permissive = 'PERMISSIVE' THEN '✅ Permissive'
    ELSE '⚠️ Restrictive'
  END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

SELECT '========================================' AS "SECTION 3: DUPLICATE MIGRATIONS";

-- Check for duplicate migration files (002 appears twice, 006 appears twice)
SELECT 
  '⚠️ WARNING: You have duplicate migration files:' as warning,
  '- 002_edge_case_detection.sql AND 002_edge_case_detection_clean.sql' as duplicate_1,
  '- 006_add_active_field.sql AND 006_confidence_scoring_update.sql' as duplicate_2,
  'Recommendation: Rename to sequential numbers (015, 016, etc.)' as recommendation;

SELECT '========================================' AS "SECTION 4: TABLE STRUCTURE";

-- List all tables
SELECT
  schemaname,
  tablename,
  CASE
    WHEN tablename IN ('recordings', 'segments', 'edge_case_matches', 'segment_labels', 'model_outputs', 'preference_pairs', 'custom_rules') THEN '✅ Core table'
    ELSE '⚠️ Unknown table'
  END as table_type
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

SELECT '========================================' AS "SECTION 5: MISSING INDEXES ON FOREIGN KEYS";

-- Check for foreign keys without indexes (performance issue)
SELECT
  tc.table_name,
  kcu.column_name,
  CASE
    WHEN i.indexname IS NULL THEN '❌ Missing index on FK - PERFORMANCE ISSUE'
    ELSE '✅ Indexed'
  END as index_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_indexes i
  ON i.tablename = tc.table_name
  AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

SELECT '========================================' AS "SECTION 6: VIEWS";

-- List all views
SELECT
  schemaname,
  viewname,
  CASE
    WHEN viewname LIKE '%_v2' THEN '⚠️ Versioned view - consider cleanup'
    ELSE '✅ Active view'
  END as status
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

SELECT '========================================' AS "SECTION 7: ORPHANED DATA";

-- Check for segments without recordings (should be 0 due to CASCADE)
SELECT
  COUNT(*) as orphaned_segments,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No orphaned segments'
    ELSE '❌ Found orphaned segments - DATA INTEGRITY ISSUE'
  END as status
FROM segments s
LEFT JOIN recordings r ON s.recording_id = r.id
WHERE r.id IS NULL;

-- Check for edge_case_matches without segments
SELECT
  COUNT(*) as orphaned_matches,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No orphaned edge case matches'
    ELSE '❌ Found orphaned matches - DATA INTEGRITY ISSUE'
  END as status
FROM edge_case_matches ecm
LEFT JOIN segments s ON ecm.segment_id = s.id
WHERE s.id IS NULL;

-- Check for segment_labels without segments
SELECT
  COUNT(*) as orphaned_labels,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No orphaned segment labels'
    ELSE '❌ Found orphaned labels - DATA INTEGRITY ISSUE'
  END as status
FROM segment_labels sl
LEFT JOIN segments s ON sl.segment_id = s.id
WHERE s.id IS NULL;

SELECT '========================================' AS "SECTION 8: COLUMN CONFLICTS";

-- Check for duplicate/conflicting columns in segments table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN column_name = 'transcription' THEN '⚠️ OLD - Should be removed'
    WHEN column_name = 'transcription_text' THEN '✅ CURRENT - Keep this one'
    ELSE '✅ OK'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'segments'
  AND column_name IN ('transcription', 'transcription_text', 'transcription_confidence')
ORDER BY column_name;

SELECT '========================================' AS "SECTION 9: CHECK CONSTRAINTS";

-- List all check constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

SELECT '========================================' AS "SECTION 10: SECURITY SUMMARY";

-- Final security summary
WITH table_security AS (
  SELECT
    tablename,
    rowsecurity as has_rls,
    (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as policy_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
)
SELECT
  tablename,
  CASE
    WHEN has_rls AND policy_count >= 4 THEN '✅ Fully Protected'
    WHEN has_rls AND policy_count > 0 THEN '⚠️ Partially Protected'
    WHEN has_rls AND policy_count = 0 THEN '❌ RLS Enabled but NO POLICIES'
    ELSE '❌ NO RLS - CRITICAL SECURITY RISK'
  END as security_status,
  has_rls as rls_enabled,
  policy_count as policies
FROM table_security
ORDER BY has_rls ASC, policy_count ASC, tablename;

SELECT '========================================' AS "AUDIT COMPLETE";

SELECT 
  'CRITICAL ISSUES TO FIX:' as summary,
  '1. Enable RLS on tables without it' as issue_1,
  '2. Add policies to tables with RLS but no policies' as issue_2,
  '3. Fix any orphaned data' as issue_3,
  '4. Resolve column name conflicts (transcription vs transcription_text)' as issue_4;
