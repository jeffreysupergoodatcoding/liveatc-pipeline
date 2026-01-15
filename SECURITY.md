# Security Configuration Guide

## ✅ Production-Ready Security

This project is configured for **commercial production use** with the following security measures:

## 🔐 Environment Variables

### Required Configuration

Create a `.env` file in the project root with these variables:

```bash
# Public keys (safe for client-side use)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your_anon_key

# Server-side keys (MUST be kept secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your_service_role_key
```

### Key Types Explained

**Anon Key (Public)** - Safe to expose in frontend code:
- Used by browser clients
- Protected by Row Level Security (RLS) policies
- Included in `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Service Role Key (Secret)** - MUST be kept secure:
- Bypasses Row Level Security
- Used only in API routes and server-side scripts
- Never expose to client-side code
- Included in `SUPABASE_SERVICE_KEY`

## 🛡️ Security Architecture

### Frontend (Client-Side)
- **File**: `lib/supabase.js`
- **Uses**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
- **Access**: Direct database queries from browser
- **Protection**: Row Level Security policies on Supabase

### Backend (Server-Side)
- **File**: `lib/supabase-server.js`
- **Uses**: `SUPABASE_SERVICE_KEY` (secret)
- **Access**: API routes and analysis scripts
- **Protection**: Not exposed to client, runs server-only

### API Routes
- ✅ **`/api/segments/analyze`** - Active, triggers background analysis
- ⚠️ **`/api/segments/active`** - Unused by frontend (can be removed)
- ⚠️ **`/api/segments/analyzed`** - Unused by frontend (can be removed)
- ⚠️ **`/api/segments/stats`** - Unused by frontend (can be removed)

**Note**: Unused API routes are marked with warnings. Consider removing them to reduce attack surface.

## 🚫 What's Protected

### ✅ Secured Elements

1. **No hardcoded credentials** - All secrets in `.env`
2. **Environment variable loading** - All files use `process.env`
3. **Git ignored** - `.env` file in `.gitignore`
4. **Proper key separation** - Public vs private keys clearly separated

### Scripts Security

All scripts properly load environment variables:
- `scripts/detect-edge-cases.js` ✅
- `scripts/upload-to-supabase.js` ✅
- `scripts/fix-statistics-view.js` ✅
- `scripts/scheduled-pipeline.js` ✅

## 🔒 Deployment Checklist

### Before Deploying to Production:

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your actual credentials:**
   - Get keys from [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api)
   - Replace all `your_*_here` placeholders

3. **Verify `.env` is git-ignored:**
   ```bash
   git check-ignore .env
   # Should output: .env
   ```

4. **Set production environment variables:**
   - Vercel: Project Settings → Environment Variables
   - Other platforms: Follow their env variable configuration

5. **Enable Row Level Security (RLS) on Supabase:**
   - Go to Database → Tables
   - Enable RLS on `segments`, `recordings`, `edge_case_matches`
   - Create policies for read/write access

6. **Review API routes:**
   - Delete unused API routes (`active`, `analyzed`, `stats`) if not needed
   - Keep only `/api/segments/analyze` for triggering analysis

7. **Test in staging first:**
   - Deploy to staging environment
   - Verify all features work
   - Check for any exposed credentials in logs

## 🔍 Security Audit

### No Credentials in Code ✅
```bash
# Run this to verify no hardcoded credentials:
grep -r "sb_secret_\|sb_publishable_" --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" --exclude=".env*" .
```

This should only find references in documentation files, not in actual code.

### Environment Variables Usage ✅
All code uses environment variables:
- Frontend: `process.env.NEXT_PUBLIC_*`
- Backend: `process.env.SUPABASE_SERVICE_KEY`
- Scripts: Load via `dotenv`

## 🚨 Security Best Practices

### DO ✅
- Use environment variables for all secrets
- Enable RLS on all database tables
- Use anon key for client-side queries
- Use service key only server-side
- Keep `.env` in `.gitignore`
- Rotate keys periodically
- Use different keys for dev/staging/production

### DON'T ❌
- Hardcode credentials in code
- Commit `.env` file to git
- Expose service role key to client
- Share credentials in Slack/email
- Use production keys in development
- Log credentials (even in debug mode)

## 🔐 Row Level Security (RLS) Policies

### Recommended Policies

**For `segments` table:**
```sql
-- Allow public read access to segments
CREATE POLICY "Public read access" ON segments
  FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON segments
  FOR ALL USING (auth.role() = 'service_role');
```

**For `recordings` table:**
```sql
-- Allow public read access to recordings
CREATE POLICY "Public read access" ON recordings
  FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON recordings
  FOR ALL USING (auth.role() = 'service_role');
```

**For `edge_case_matches` table:**
```sql
-- Allow public read access to edge case matches
CREATE POLICY "Public read access" ON edge_case_matches
  FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON edge_case_matches
  FOR ALL USING (auth.role() = 'service_role');
```

Apply these in Supabase Dashboard → SQL Editor.

## 📝 Commercial Deployment Notes

### Compliance
- No PII (Personally Identifiable Information) is collected
- Audio files are aviation communications (public domain)
- Database contains only aviation metadata

### Licensing
- Ensure Supabase plan supports commercial use
- Verify LiveATC feed usage rights for commercial purposes
- Review Whisper model licensing (MIT license - commercial use allowed)

### Monitoring
- Set up Supabase monitoring for suspicious activity
- Monitor API route usage
- Track failed authentication attempts
- Set up alerts for unusual database queries

## 🆘 Incident Response

### If Credentials are Exposed:
1. **Immediately rotate keys** in Supabase Dashboard
2. Update all deployment environments
3. Restart all services
4. Review access logs for unauthorized access
5. Document the incident

### Key Rotation Steps:
1. Go to Supabase Dashboard → Settings → API
2. Click "Generate new service role key"
3. Update `.env` file
4. Update production environment variables
5. Restart application
6. Revoke old key after confirming new one works

## ✅ Security Verification

Run these commands to verify security:

```bash
# 1. Check .gitignore includes .env
grep "^\.env$" .gitignore

# 2. Verify no credentials in git history
git log --all --full-history --source -- "*secret*" "*key*"

# 3. Check for hardcoded URLs (should only be in docs)
grep -r "wqppszoyvtqauthbvtgc" --exclude-dir=node_modules --exclude="*.md"

# 4. Verify environment variables are loaded
node -e "require('dotenv').config(); console.log('✅ SUPABASE_URL:', !!process.env.SUPABASE_URL)"
```

All checks should pass before deploying to production.

---

## 📞 Support

For security concerns or questions:
- Review this document thoroughly
- Check Supabase documentation: https://supabase.com/docs
- Follow Next.js security best practices: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
