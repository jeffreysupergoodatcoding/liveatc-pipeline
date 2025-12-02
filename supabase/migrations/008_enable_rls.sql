-- ============================================================================
-- Row Level Security (RLS) Setup - REQUIRED FOR PRODUCTION
-- ============================================================================
-- This migration enables RLS and creates policies that:
-- 1. Allow public READ access (for frontend queries)
-- 2. Block public WRITE/DELETE access
-- 3. Allow service role full access (for backend scripts)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_case_matches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECORDINGS TABLE POLICIES
-- ============================================================================

-- Allow public read access to recordings
CREATE POLICY "Public users can view recordings"
  ON recordings
  FOR SELECT
  USING (true);

-- Only service role can insert recordings
CREATE POLICY "Service role can insert recordings"
  ON recordings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can update recordings
CREATE POLICY "Service role can update recordings"
  ON recordings
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Only service role can delete recordings
CREATE POLICY "Service role can delete recordings"
  ON recordings
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- SEGMENTS TABLE POLICIES
-- ============================================================================

-- Allow public read access to segments
CREATE POLICY "Public users can view segments"
  ON segments
  FOR SELECT
  USING (true);

-- Only service role can insert segments
CREATE POLICY "Service role can insert segments"
  ON segments
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can update segments
CREATE POLICY "Service role can update segments"
  ON segments
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Only service role can delete segments
CREATE POLICY "Service role can delete segments"
  ON segments
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- EDGE_CASE_MATCHES TABLE POLICIES
-- ============================================================================

-- Allow public read access to edge case matches
CREATE POLICY "Public users can view edge case matches"
  ON edge_case_matches
  FOR SELECT
  USING (true);

-- Only service role can insert edge case matches
CREATE POLICY "Service role can insert edge case matches"
  ON edge_case_matches
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can update edge case matches
CREATE POLICY "Service role can update edge case matches"
  ON edge_case_matches
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Only service role can delete edge case matches
CREATE POLICY "Service role can delete edge case matches"
  ON edge_case_matches
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying this migration, verify RLS is working:
--
-- 1. With anon key (should work):
--    SELECT * FROM segments LIMIT 1;
--
-- 2. With anon key (should FAIL with permission denied):
--    UPDATE segments SET active = true WHERE id = 'some-id';
--
-- 3. With service role key (should work):
--    UPDATE segments SET active = true WHERE id = 'some-id';
-- ============================================================================
