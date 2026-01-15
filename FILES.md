# Project Files

Complete list of all files in the LiveATC Pipeline project.

## Documentation (4 files)

- [README.md](README.md) - Complete documentation with setup instructions, usage examples, and troubleshooting
- [QUICKSTART.md](QUICKSTART.md) - 10-minute quick start guide for getting the system running
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed system architecture diagrams and design decisions
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - High-level project overview with features and capabilities

## Configuration (5 files)

- [package.json](package.json) - Node.js dependencies and scripts
- [.env.example](.env.example) - Environment variables template
- [.gitignore](.gitignore) - Git ignore patterns
- [next.config.js](next.config.js) - Next.js configuration
- [tsconfig.json](tsconfig.json) - TypeScript configuration

## Backend Scripts (5 files)

- [scripts/liveatc-recorder.js](scripts/liveatc-recorder.js) - Records audio from LiveATC streams using ffmpeg
- [scripts/segment-audio.js](scripts/segment-audio.js) - Segments audio files based on silence detection
- [scripts/upload-to-supabase.js](scripts/upload-to-supabase.js) - Uploads recordings and segments to Supabase
- [scripts/scheduled-pipeline.js](scripts/scheduled-pipeline.js) - Orchestrates the complete pipeline with scheduling
- [scripts/test-pipeline.sh](scripts/test-pipeline.sh) - Automated test script for verifying the pipeline

## Database & Storage (2 files)

- [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) - PostgreSQL schema with tables, indexes, and triggers
- [supabase/setup-storage.md](supabase/setup-storage.md) - Instructions for setting up Supabase Storage buckets

## Frontend - Core (3 files)

- [app/layout.js](app/layout.js) - Root layout component for Next.js
- [app/page.js](app/page.js) - Home page with link to admin interface
- [app/globals.css](app/globals.css) - Global CSS styles

## Frontend - Admin Interface (8 files)

### Main Admin Page
- [app/admin/liveatc/page.js](app/admin/liveatc/page.js) - Main admin page with navigation and state management
- [app/admin/liveatc/page.module.css](app/admin/liveatc/page.module.css) - Styles for main admin page

### Components
- [app/admin/liveatc/components/RecordingsList.js](app/admin/liveatc/components/RecordingsList.js) - List and filter recordings
- [app/admin/liveatc/components/RecordingsList.module.css](app/admin/liveatc/components/RecordingsList.module.css) - Styles for recordings list
- [app/admin/liveatc/components/SegmentsList.js](app/admin/liveatc/components/SegmentsList.js) - View and manage segments with audio player
- [app/admin/liveatc/components/SegmentsList.module.css](app/admin/liveatc/components/SegmentsList.module.css) - Styles for segments list
- [app/admin/liveatc/components/Statistics.js](app/admin/liveatc/components/Statistics.js) - Statistics dashboard with charts
- [app/admin/liveatc/components/Statistics.module.css](app/admin/liveatc/components/Statistics.module.css) - Styles for statistics dashboard

## Shared Libraries (2 files)

- [lib/supabase.js](lib/supabase.js) - Supabase client configuration
- [lib/utils/format.js](lib/utils/format.js) - Formatting utilities for duration, file size, dates, and quality scores

## Total: 29 files

## File Statistics

- **Lines of Code**: ~3,500+ lines
- **Backend Scripts**: ~1,500 lines
- **Frontend Components**: ~1,200 lines
- **Documentation**: ~800 lines
- **Database Schema**: ~200 lines
- **Configuration**: ~100 lines

## Usage by Phase

### Phase 1: Setup
1. `package.json` - Install dependencies
2. `.env.example` - Configure environment
3. `supabase/migrations/001_initial_schema.sql` - Set up database
4. `supabase/setup-storage.md` - Set up storage

### Phase 2: Backend Development
1. `scripts/liveatc-recorder.js` - Recording
2. `scripts/segment-audio.js` - Segmentation
3. `scripts/upload-to-supabase.js` - Upload
4. `scripts/scheduled-pipeline.js` - Orchestration

### Phase 3: Testing
1. `scripts/test-pipeline.sh` - Automated tests
2. `QUICKSTART.md` - Quick setup guide

### Phase 4: Frontend Development
1. `app/layout.js`, `app/page.js` - Base setup
2. `app/admin/liveatc/page.js` - Admin interface
3. `app/admin/liveatc/components/*.js` - Components

### Phase 5: Production
1. `README.md` - Full documentation
2. `ARCHITECTURE.md` - System design
3. `PROJECT_SUMMARY.md` - Overview

## File Dependencies

### Backend Dependencies (from package.json)
```json
{
  "@supabase/supabase-js": "^2.39.3",
  "fluent-ffmpeg": "^2.1.2",
  "node-cron": "^3.0.3",
  "dotenv": "^16.3.1"
}
```

### Frontend Dependencies (from package.json)
```json
{
  "next": "^14.1.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0"
}
```

### External Dependencies
- **ffmpeg** - Must be installed on system
- **Node.js 18+** - Runtime environment

## Key Design Decisions

### ES Modules
All JavaScript files use ES modules (`import`/`export`) rather than CommonJS for modern syntax and better tree-shaking.

### CSS Modules
Frontend uses CSS Modules for scoped styling, avoiding global CSS conflicts.

### Serverless-Ready
Frontend can deploy to Vercel, backend scripts run anywhere Node.js is available.

### Database-First
All state lives in Supabase database; no local state management complexity.

### Stateless Scripts
Each script is independent and can be run manually or automated.

## Development Workflow

1. **Install**: `npm install`
2. **Configure**: Copy `.env.example` to `.env`
3. **Database**: Run migration SQL
4. **Storage**: Create buckets
5. **Test**: `./scripts/test-pipeline.sh`
6. **Develop**: `npm run dev`
7. **Deploy**: See README.md

## Build Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start

# Run scripts
npm run record -- --feed kjfk_gnd --duration 60
npm run segment -- --input recordings/raw/file.mp3
npm run upload -- --raw-file ... --segment-dir ...
npm run pipeline -- --once
```

## Testing Commands

```bash
# Quick automated test
./scripts/test-pipeline.sh

# Manual testing
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 60
node scripts/segment-audio.js --input recordings/raw/*.mp3
node scripts/upload-to-supabase.js --raw-file ... --segment-dir ...

# Full pipeline test
node scripts/scheduled-pipeline.js --feed kjfk --once

# Scheduled mode (runs continuously)
node scripts/scheduled-pipeline.js --schedule
```

## File Size Estimates

- **Source Code**: ~100 KB
- **Dependencies**: ~150 MB (node_modules)
- **Documentation**: ~50 KB
- **Recordings (per day)**: ~450 MB (10 hours @ 128kbps)

## Maintenance

### Regular Updates
- Update dependencies: `npm update`
- Check for security issues: `npm audit`
- Review logs: `logs/pipeline_*.json`

### Cleanup
- Remove old recordings: Delete from `recordings/` folder
- Archive segments: Move to cold storage
- Clean Supabase Storage: Delete old files from buckets

### Monitoring
- Check pipeline logs daily
- Review statistics dashboard weekly
- Monitor Supabase storage usage
- Check for failed recordings

## Backup Strategy

### Critical Files to Backup
1. `.env` - Environment configuration
2. `supabase/migrations/` - Database schema
3. `logs/` - Pipeline execution logs
4. `recordings/` - Local audio files (optional)

### Automated Backup
- Supabase has automatic database backups (paid plan)
- Storage files can be synced to S3/Backblaze B2
- Local recordings are temporary (uploaded to cloud)

## Contributing

When adding new files:
1. Add to appropriate directory
2. Update this file (FILES.md)
3. Update README.md if user-facing
4. Add tests if applicable
5. Document in ARCHITECTURE.md if architectural change

---

Last updated: 2025-01-18
