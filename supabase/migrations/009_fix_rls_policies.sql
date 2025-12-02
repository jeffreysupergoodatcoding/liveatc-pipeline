-- ============================================================================
-- FIX RLS Policies - Replace incorrect existing policies with secure ones
-- ============================================================================

-- Drop all existing policies (they're not blocking writes correctly)
DROP POLICY IF EXISTS "Public users can view recordings" ON recordings;
DROP POLICY IF EXISTS "Service role can insert recordings" ON recordings;
DROP POLICY IF EXISTS "Service role can update recordings" ON recordings;
DROP POLICY IF EXISTS "Service role can delete recordings" ON recordings;

DROP POLICY IF EXISTS "Public users can view segments" ON segments;
DROP POLICY IF EXISTS "Service role can insert segments" ON segments;
DROP POLICY IF EXISTS "Service role can update segments" ON segments;
DROP POLICY IF EXISTS "Service role can delete segments" ON segments;

DROP POLICY IF EXISTS "Public users can view edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "Service role can insert edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "Service role can update edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "Service role can delete edge case matches" ON edge_case_matches;

-- Also drop any permissive policies that might exist
DROP POLICY IF EXISTS "Enable read access for all users" ON recordings;
DROP POLICY IF EXISTS "Enable read access for all users" ON segments;
DROP POLICY IF EXISTS "Enable read access for all users" ON edge_case_matches;

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON recordings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON segments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON edge_case_matches;

-- Ensure RLS is enabled
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_case_matches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECORDINGS TABLE - SECURE POLICIES
-- ============================================================================

CREATE POLICY "recordings_select_policy"
  ON recordings
  FOR SELECT
  USING (true);

CREATE POLICY "recordings_insert_policy"
  ON recordings
  FOR INSERT
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "recordings_update_policy"
  ON recordings
  FOR UPDATE
  USING (
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "recordings_delete_policy"
  ON recordings
  FOR DELETE
  USING (
    (SELECT auth.role()) = 'service_role'
  );

-- ============================================================================
-- SEGMENTS TABLE - SECURE POLICIES
-- ============================================================================

CREATE POLICY "segments_select_policy"
  ON segments
  FOR SELECT
  USING (true);

CREATE POLICY "segments_insert_policy"
  ON segments
  FOR INSERT
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "segments_update_policy"
  ON segments
  FOR UPDATE
  USING (
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "segments_delete_policy"
  ON segments
  FOR DELETE
  USING (
    (SELECT auth.role()) = 'service_role'
  );

-- ============================================================================
-- EDGE_CASE_MATCHES TABLE - SECURE POLICIES
-- ============================================================================

CREATE POLICY "edge_case_matches_select_policy"
  ON edge_case_matches
  FOR SELECT
  USING (true);

CREATE POLICY "edge_case_matches_insert_policy"
  ON edge_case_matches
  FOR INSERT
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "edge_case_matches_update_policy"
  ON edge_case_matches
  FOR UPDATE
  USING (
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "edge_case_matches_delete_policy"
  ON edge_case_matches
  FOR DELETE
  USING (
    (SELECT auth.role()) = 'service_role'
  );
