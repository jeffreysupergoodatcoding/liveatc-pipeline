-- ============================================================================
-- QUICK AUDIT - Shows Only Critical Issues
-- ============================================================================
-- Run this in Supabase SQL Editor
-- This version shows only the most important checks
-- ============================================================================

-- 1. RLS STATUS - Which tables are unprotected?
SELECT
  '1. RLS STATUS' as check_name,
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity THEN '✅ Protected'
    ELSE '❌ UNPROTECTED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('recordings', 'segments', 'edge_case_matches', 'segment_labels', 'model_outputs', 'preference_pairs', 'custom_rules')
ORDER BY rowsecurity ASC, tablename;

-- 2. POLICY COUNT - How many policies per table?
SELECT
  '2. POLICY COUNT' as check_name,
  t.tablename,
  t.rowsecurity as has_rls,
  COALESCE(p.policy_count, 0) as policy_count,
  CASE
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) >= 4 THEN '✅ Fully Protected'
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN '⚠️ Partially Protected'
    WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) = 0 THEN '❌ RLS but NO POLICIES'
    ELSE '❌ NO RLS'
  END as status
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, COUNT(*) as policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('recordings', 'segments', 'edge_case_matches', 'segment_labels', 'model_outputs', 'preference_pairs', 'custom_rules')
ORDER BY has_rls ASC, policy_count ASC;

-- 3. COLUMN CONFLICTS - Do you have duplicate transcription columns?
SELECT
  '3. COLUMN CONFLICTS' as check_name,
  column_name,
  data_type,
  CASE
    WHEN column_name = 'transcription' THEN '⚠️ OLD - Should be removed'
    WHEN column_name = 'transcription_text' THEN '✅ CURRENT - Keep this'
    ELSE '✅ OK'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'segments'
  AND column_name IN ('transcription', 'transcription_text', 'transcription_confidence')
ORDER BY column_name;

-- 4. SUMMARY - What needs to be fixed?
SELECT
  '4. SUMMARY' as check_name,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('segment_labels', 'model_outputs', 'preference_pairs', 'custom_rules') AND rowsecurity = false) as tables_without_rls,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'segments' AND column_name = 'transcription') as has_old_transcription_column,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('segment_labels', 'model_outputs', 'preference_pairs', 'custom_rules') AND rowsecurity = false) > 0 
    THEN '❌ CRITICAL: Apply migration 015 to enable RLS'
    ELSE '✅ All tables have RLS'
  END as rls_status,
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'segments' AND column_name = 'transcription') > 0
    THEN '⚠️ WARNING: Apply migration 016 to fix column conflict'
    ELSE '✅ No column conflicts'
  END as column_status;
