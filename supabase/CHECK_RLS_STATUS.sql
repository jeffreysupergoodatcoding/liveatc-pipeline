-- ============================================================================
-- Check RLS Status and Policies
-- ============================================================================
-- Copy and paste this into Supabase SQL Editor to see current RLS status
-- https://supabase.com/dashboard/project/wqppszoyvtqauthbvtgc/sql/new
-- ============================================================================

-- Check if RLS is enabled on tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('segments', 'recordings', 'edge_case_matches')
  AND schemaname = 'public'
ORDER BY tablename;

-- Check what policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  CASE
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as check_clause
FROM pg_policies
WHERE tablename IN ('segments', 'recordings', 'edge_case_matches')
ORDER BY tablename, cmd, policyname;

-- Test if policies are working (this should show role)
SELECT current_user, current_setting('role', true) as current_role;
