-- ============================================================================
-- PROPERLY Fix RLS - Use auth.jwt() instead of auth.role()
-- ============================================================================
-- The issue: auth.role() doesn't work reliably with anon keys
-- The fix: Check auth.jwt() which contains the actual JWT claims
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Public users can view recordings" ON recordings;
DROP POLICY IF EXISTS "Service role can insert recordings" ON recordings;
DROP POLICY IF EXISTS "Service role can update recordings" ON recordings;
DROP POLICY IF EXISTS "Service role can delete recordings" ON recordings;
DROP POLICY IF EXISTS "recordings_select_policy" ON recordings;
DROP POLICY IF EXISTS "recordings_insert_policy" ON recordings;
DROP POLICY IF EXISTS "recordings_update_policy" ON recordings;
DROP POLICY IF EXISTS "recordings_delete_policy" ON recordings;

DROP POLICY IF EXISTS "Public users can view segments" ON segments;
DROP POLICY IF EXISTS "Service role can insert segments" ON segments;
DROP POLICY IF EXISTS "Service role can update segments" ON segments;
DROP POLICY IF EXISTS "Service role can delete segments" ON segments;
DROP POLICY IF EXISTS "segments_select_policy" ON segments;
DROP POLICY IF EXISTS "segments_insert_policy" ON segments;
DROP POLICY IF EXISTS "segments_update_policy" ON segments;
DROP POLICY IF EXISTS "segments_delete_policy" ON segments;

DROP POLICY IF EXISTS "Public users can view edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "Service role can insert edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "Service role can update edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "Service role can delete edge case matches" ON edge_case_matches;
DROP POLICY IF EXISTS "edge_case_matches_select_policy" ON edge_case_matches;
DROP POLICY IF EXISTS "edge_case_matches_insert_policy" ON edge_case_matches;
DROP POLICY IF EXISTS "edge_case_matches_update_policy" ON edge_case_matches;
DROP POLICY IF EXISTS "edge_case_matches_delete_policy" ON edge_case_matches;

-- Ensure RLS is enabled
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_case_matches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECORDINGS TABLE - Using JWT role check
-- ============================================================================

-- Allow all users (anon + authenticated) to read
CREATE POLICY "recordings_allow_read"
  ON recordings
  FOR SELECT
  TO public
  USING (true);

-- Only service_role can insert/update/delete
-- Service role is identified by the 'role' claim in the JWT
CREATE POLICY "recordings_service_only_insert"
  ON recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "recordings_service_only_update"
  ON recordings
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "recordings_service_only_delete"
  ON recordings
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- ============================================================================
-- SEGMENTS TABLE - Using JWT role check
-- ============================================================================

CREATE POLICY "segments_allow_read"
  ON segments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "segments_service_only_insert"
  ON segments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "segments_service_only_update"
  ON segments
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "segments_service_only_delete"
  ON segments
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- ============================================================================
-- EDGE_CASE_MATCHES TABLE - Using JWT role check
-- ============================================================================

CREATE POLICY "edge_case_matches_allow_read"
  ON edge_case_matches
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "edge_case_matches_service_only_insert"
  ON edge_case_matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "edge_case_matches_service_only_update"
  ON edge_case_matches
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "edge_case_matches_service_only_delete"
  ON edge_case_matches
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, test with: node test-rls.js
-- Expected:
--   ✅ READ allowed (anon key can read)
--   ✅ WRITE blocked (anon key cannot write - no 'service_role' in JWT)
--   ✅ DELETE blocked (anon key cannot delete - no 'service_role' in JWT)
-- ============================================================================
