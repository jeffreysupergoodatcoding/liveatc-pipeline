# How to Fix Your Supabase Database Issues

## Quick Start

### Step 1: Run the Audit (5 minutes)

1. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new)
2. Copy the contents of `supabase/AUDIT_DATABASE.sql`
3. Paste and run it
4. Review the output to see current issues

### Step 2: Apply the Fixes (10 minutes)

Apply these migrations **in order**:

#### Migration 015: Enable RLS (CRITICAL - Do First!)
```sql
-- File: supabase/migrations/015_enable_rls_missing_tables.sql
-- What it does: Protects segment_labels, model_outputs, preference_pairs from unauthorized writes
-- Risk: LOW - Only adds security, doesn't change data
-- Required: YES - Critical security fix
```

**How to apply:**
1. Open Supabase SQL Editor
2. Copy contents of `015_enable_rls_missing_tables.sql`
3. Run it
4. Verify: You should see "✅ Protected" for all tables

#### Migration 016: Fix Column Names (Recommended)
```sql
-- File: supabase/migrations/016_consolidate_column_names.sql
-- What it does: Removes duplicate 'transcription' column, keeps 'transcription_text'
-- Risk: LOW - Backs up data before dropping column
-- Required: RECOMMENDED - Fixes data consistency
```

**How to apply:**
1. Open Supabase SQL Editor
2. Copy contents of `016_consolidate_column_names.sql`
3. Run it
4. Verify: Check that only 'transcription_text' exists (not 'transcription')

#### Migration 017: Clean Up Views (Optional)
```sql
-- File: supabase/migrations/017_cleanup_views.sql
-- What it does: Removes duplicate _v2 views
-- Risk: VERY LOW - Just cleanup
-- Required: OPTIONAL - Nice to have
```

**How to apply:**
1. Open Supabase SQL Editor
2. Copy contents of `017_cleanup_views.sql`
3. Run it

### Step 3: Verify Everything Works (5 minutes)

1. Re-run the audit script (`AUDIT_DATABASE.sql`)
2. Check that all tables show "✅ Fully Protected"
3. Test your app to make sure everything still works
4. Check that you can still:
   - View segments
   - Submit rankings
   - Process audio

---

## Detailed Issue Breakdown

### 🚨 CRITICAL: Missing RLS (Fix Immediately)

**What's wrong:**
- 4 tables have NO row-level security
- Anyone with your anon key can modify data
- Your RLHF training data can be corrupted

**Tables affected:**
- `segment_labels`
- `model_outputs`
- `preference_pairs`
- `custom_rules`

**Fix:** Apply migration `015_enable_rls_missing_tables.sql`

**Impact if not fixed:**
- Malicious users could poison your training data
- Someone could delete all your rankings
- Data integrity cannot be guaranteed

---

### ⚠️ MEDIUM: Column Name Conflicts

**What's wrong:**
- `segments` table has both `transcription` and `transcription_text`
- Migrations added duplicate columns
- Confusing which one to use

**Fix:** Apply migration `016_consolidate_column_names.sql`

**Impact if not fixed:**
- Data might be written to wrong column
- Queries might miss data
- Wasted database storage

---

### 🟢 LOW: Duplicate Views

**What's wrong:**
- `flagged_segments_with_matches_v2` is a duplicate
- Created during a migration but old one wasn't dropped

**Fix:** Apply migration `017_cleanup_views.sql`

**Impact if not fixed:**
- Minor database clutter
- Potential confusion about which view to use

---

## Testing After Fixes

### Test 1: Verify RLS is Working

Run this in Supabase SQL Editor:

```sql
-- This should work (read access)
SELECT * FROM segment_labels LIMIT 1;

-- This should FAIL with permission denied (write blocked)
INSERT INTO segment_labels (segment_id, transcription) 
VALUES ('00000000-0000-0000-0000-000000000000', 'test');
```

Expected result:
- ✅ SELECT works
- ❌ INSERT fails with "permission denied" or "policy violation"

### Test 2: Verify Column Names

Run this in Supabase SQL Editor:

```sql
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'segments'
  AND column_name LIKE '%transcription%'
ORDER BY column_name;
```

Expected result:
```
transcription_confidence
transcription_pending
transcription_text
```

Should NOT see `transcription` (without _text suffix).

### Test 3: Verify App Still Works

1. Open your app
2. Navigate to a segment
3. Try to rank outputs
4. Check that data saves correctly

---

## Rollback Plan (If Something Breaks)

### Rollback Migration 017 (Views)
```sql
-- Just re-run migration 006_confidence_scoring_update.sql
-- This recreates the _v2 view
```

### Rollback Migration 016 (Column Names)
```sql
-- Re-add the transcription column
ALTER TABLE segments ADD COLUMN transcription TEXT;

-- Copy data back
UPDATE segments SET transcription = transcription_text;
```

### Rollback Migration 015 (RLS)
```sql
-- Disable RLS (NOT RECOMMENDED - security risk!)
ALTER TABLE segment_labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE model_outputs DISABLE ROW LEVEL SECURITY;
ALTER TABLE preference_pairs DISABLE ROW LEVEL SECURITY;
```

**Note:** Only rollback if absolutely necessary. The RLS fix is critical for security.

---

## FAQ

**Q: Will this break my app?**  
A: No, these migrations are designed to be non-breaking. Migration 016 preserves all data before making changes.

**Q: Do I need to update my code?**  
A: No, your code already uses `transcription_text`, which is the column we're keeping.

**Q: Can I run these in production?**  
A: Yes, but test in staging first if you have one. The migrations are designed to be safe.

**Q: What if I get an error?**  
A: Check the error message. Most common issues:
- "column already exists" - migration already applied
- "permission denied" - you need admin access to Supabase
- "relation does not exist" - table name typo

**Q: How long will this take?**  
A: Each migration runs in < 1 second. Total time: ~5-10 minutes including verification.

**Q: Will there be downtime?**  
A: No, these migrations run instantly with no downtime.

---

## Next Steps After Fixing

1. **Set up monitoring:**
   - Enable Supabase query performance insights
   - Set up alerts for slow queries

2. **Regular audits:**
   - Run `AUDIT_DATABASE.sql` monthly
   - Check for new security issues

3. **Migration hygiene:**
   - Rename duplicate migration files (002, 006)
   - Keep migrations sequential

4. **Documentation:**
   - Update your README with security practices
   - Document which columns to use

---

## Need Help?

If you encounter issues:

1. Check the error message carefully
2. Review the `AUDIT_REPORT.md` for context
3. Check Supabase logs in the dashboard
4. Try the rollback steps if needed

**Remember:** The RLS fix (migration 015) is **critical** for security. The others are improvements but less urgent.
