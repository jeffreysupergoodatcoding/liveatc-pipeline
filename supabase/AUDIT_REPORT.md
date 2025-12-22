# Supabase Database Audit Report

**Generated:** 2025-12-21  
**Project:** LiveATC Pipeline

---

## 🚨 CRITICAL ISSUES (Must Fix)

### 1. **Missing Row Level Security (RLS) on 3 Tables**

**Severity:** 🔴 **CRITICAL - Security Vulnerability**

The following tables are **completely unprotected** and can be modified by anyone with your anon key (which is exposed in the frontend):

- ❌ `segment_labels` - Contains human-reviewed transcriptions
- ❌ `model_outputs` - Contains Deepgram transcription variations
- ❌ `preference_pairs` - Contains RLHF training data
- ❌ `custom_rules` - Contains custom detection rules (if exists)

**Impact:**
- Anyone can INSERT fake training data
- Anyone can UPDATE/DELETE your RLHF rankings
- Your training dataset can be corrupted
- Malicious users could poison your model

**Fix:** Apply migration `015_enable_rls_missing_tables.sql` (I'll create this)

---

### 2. **Column Name Conflict in `segments` Table**

**Severity:** 🟡 **MEDIUM - Data Consistency Issue**

Your migrations have created **duplicate/conflicting columns**:

```sql
-- From migration 001_initial_schema.sql:
transcription_text TEXT
transcription_confidence FLOAT

-- From migration 002_edge_case_detection.sql:
transcription TEXT
transcription_confidence FLOAT  -- DUPLICATE!

-- From migration 006_confidence_scoring_update.sql:
transcription_text TEXT  -- DUPLICATE!
transcription_confidence FLOAT  -- DUPLICATE!
```

**Impact:**
- Confusion about which column to use
- Potential data inconsistency
- Wasted database storage

**Fix:** Consolidate to single column names (I'll create a migration)

---

## ⚠️ WARNINGS (Should Fix)

### 3. **Duplicate Migration File Numbers**

**Severity:** 🟡 **MEDIUM - Maintenance Issue**

You have duplicate migration numbers:

```
002_edge_case_detection.sql
002_edge_case_detection_clean.sql  ← Same number!

006_add_active_field.sql
006_confidence_scoring_update.sql  ← Same number!
```

**Impact:**
- Confusing migration history
- Unclear which ran first
- Makes rollbacks difficult

**Fix:** Rename to sequential numbers (015, 016, etc.)

---

### 4. **Versioned View (`flagged_segments_with_matches_v2`)**

**Severity:** 🟢 **LOW - Code Cleanup**

Migration `006_confidence_scoring_update.sql` created a `_v2` view but didn't drop the old one.

**Impact:**
- Cluttered database
- Confusion about which view to use
- Potential performance impact

**Fix:** Drop old view or consolidate

---

### 5. **Missing Index on Foreign Keys**

**Severity:** 🟡 **MEDIUM - Performance Issue**

Some foreign key columns may not have indexes, which can slow down JOIN queries.

**Fix:** Run the audit script to identify and add missing indexes

---

## ✅ GOOD PRACTICES FOUND

1. ✅ **RLS enabled on core tables** (`recordings`, `segments`, `edge_case_matches`)
2. ✅ **Proper CASCADE deletes** to prevent orphaned data
3. ✅ **Check constraints** on confidence scores (0-1 range)
4. ✅ **Indexes on frequently queried columns**
5. ✅ **Environment variables** properly configured
6. ✅ **Service role key** separated from anon key

---

## 📋 RECOMMENDED ACTIONS

### Immediate (Do Now)

1. **Run the audit script** in Supabase SQL Editor:
   - File: `supabase/AUDIT_DATABASE.sql`
   - This will show you the current state of your database

2. **Enable RLS on missing tables**:
   - Apply migration `015_enable_rls_missing_tables.sql`
   - This protects your RLHF training data

3. **Fix column name conflicts**:
   - Apply migration `016_consolidate_column_names.sql`
   - Standardize on `transcription` (not `transcription_text`)

### Short-term (This Week)

4. **Rename duplicate migration files**:
   - `002_edge_case_detection_clean.sql` → `015_edge_case_detection_clean.sql`
   - `006_confidence_scoring_update.sql` → `016_confidence_scoring_update.sql`

5. **Clean up versioned views**:
   - Decide on `flagged_segments_with_matches` vs `_v2`
   - Drop the unused one

6. **Add missing indexes** (if any found by audit)

### Long-term (Nice to Have)

7. **Set up database monitoring**:
   - Enable Supabase query performance insights
   - Set up alerts for slow queries

8. **Regular RLS testing**:
   - Create a test script to verify RLS is working
   - Run before each deployment

9. **Migration cleanup**:
   - Consider squashing old migrations into a single schema file
   - Keep only recent migrations for rollback capability

---

## 🔧 HOW TO FIX

### Step 1: Run the Audit

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new)
2. Copy contents of `supabase/AUDIT_DATABASE.sql`
3. Run it
4. Review the output for issues

### Step 2: Apply Security Fixes

I'll create these migration files for you:

```bash
# Enable RLS on missing tables
supabase/migrations/015_enable_rls_missing_tables.sql

# Fix column name conflicts
supabase/migrations/016_consolidate_column_names.sql

# Clean up duplicate views
supabase/migrations/017_cleanup_views.sql
```

### Step 3: Verify

After applying migrations, re-run the audit script to confirm all issues are resolved.

---

## 📊 CURRENT DATABASE STATUS

### Tables (7 total)
- ✅ `recordings` - Protected with RLS
- ✅ `segments` - Protected with RLS (but has column conflicts)
- ✅ `edge_case_matches` - Protected with RLS
- ❌ `segment_labels` - **NO RLS**
- ❌ `model_outputs` - **NO RLS**
- ❌ `preference_pairs` - **NO RLS**
- ❌ `custom_rules` - **NO RLS** (if exists)

### Views (5+ total)
- `flagged_segments_with_matches` - Active
- `flagged_segments_with_matches_v2` - Duplicate/versioned
- `edge_case_statistics` - Active
- `audio_flagged_segments` - Active
- `transcription_queue` - Active

### Security Status
- 🟢 **3 tables** fully protected
- 🔴 **4 tables** completely unprotected
- 🟡 **Overall:** 43% protected (NEEDS IMPROVEMENT)

---

## 💡 QUESTIONS?

**Q: Is this safe to run in production?**  
A: The audit script is read-only and safe. The fix migrations should be tested in a staging environment first.

**Q: Will fixing these break my app?**  
A: The RLS fixes won't break anything (they just add protection). The column consolidation might require code changes if you're using `transcription_text` instead of `transcription`.

**Q: How urgent is this?**  
A: The RLS issue is **critical** if your app is public. If it's internal-only, it's still important but less urgent.

---

**Next Steps:** Let me know if you want me to create the fix migrations!
