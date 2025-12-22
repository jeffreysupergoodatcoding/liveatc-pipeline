-- ============================================================================
-- Enable Row Level Security on Missing Tables
-- ============================================================================
-- This migration enables RLS and creates policies for tables that were
-- created without RLS protection, exposing them to unauthorized modifications.
-- ============================================================================

-- Enable RLS on all unprotected tables
ALTER TABLE segment_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_pairs ENABLE ROW LEVEL SECURITY;

-- Check if custom_rules table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_rules') THEN
        ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- SEGMENT_LABELS TABLE POLICIES
-- ============================================================================

-- Allow all users (anon + authenticated) to read
CREATE POLICY "segment_labels_allow_read"
  ON segment_labels
  FOR SELECT
  TO public
  USING (true);

-- Only service_role can insert/update/delete
CREATE POLICY "segment_labels_service_only_insert"
  ON segment_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "segment_labels_service_only_update"
  ON segment_labels
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "segment_labels_service_only_delete"
  ON segment_labels
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- ============================================================================
-- MODEL_OUTPUTS TABLE POLICIES
-- ============================================================================

CREATE POLICY "model_outputs_allow_read"
  ON model_outputs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "model_outputs_service_only_insert"
  ON model_outputs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "model_outputs_service_only_update"
  ON model_outputs
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "model_outputs_service_only_delete"
  ON model_outputs
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- ============================================================================
-- PREFERENCE_PAIRS TABLE POLICIES
-- ============================================================================

CREATE POLICY "preference_pairs_allow_read"
  ON preference_pairs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "preference_pairs_service_only_insert"
  ON preference_pairs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "preference_pairs_service_only_update"
  ON preference_pairs
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "preference_pairs_service_only_delete"
  ON preference_pairs
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- ============================================================================
-- CUSTOM_RULES TABLE POLICIES (if table exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_rules') THEN
        EXECUTE 'CREATE POLICY "custom_rules_allow_read"
          ON custom_rules
          FOR SELECT
          TO public
          USING (true)';

        EXECUTE 'CREATE POLICY "custom_rules_service_only_insert"
          ON custom_rules
          FOR INSERT
          TO authenticated
          WITH CHECK (
            (auth.jwt() ->> ''role'')::text = ''service_role''
          )';

        EXECUTE 'CREATE POLICY "custom_rules_service_only_update"
          ON custom_rules
          FOR UPDATE
          TO authenticated
          USING (
            (auth.jwt() ->> ''role'')::text = ''service_role''
          )';

        EXECUTE 'CREATE POLICY "custom_rules_service_only_delete"
          ON custom_rules
          FOR DELETE
          TO authenticated
          USING (
            (auth.jwt() ->> ''role'')::text = ''service_role''
          )';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('segment_labels', 'model_outputs', 'preference_pairs', 'custom_rules');
--
-- All should show rowsecurity = true
-- ============================================================================
