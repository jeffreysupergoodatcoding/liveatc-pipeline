# Edge Case Detection System

Intelligent aviation communication edge case detection for LiveATC pipeline.

## Overview

This system automatically identifies problematic aviation communications in both user-uploaded audio and auto-segmented LiveATC clips using:

- **57 built-in edge cases** based on NASA ASRS incident patterns
- **Multi-modal analysis** (audio + content + pattern matching)
- **Custom rule builder** for user-defined detection logic
- **3 detection modes**: built-in, custom, or hybrid

## Table of Contents

- [Setup](#setup)
- [Architecture](#architecture)
- [Taxonomy](#taxonomy)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Integration](#integration)
- [Custom Rules](#custom-rules)

---

## Setup

### 1. Install Dependencies

The Deepgram SDK has already been installed. Make sure all dependencies are up to date:

```bash
npm install
```

### 2. Configure Environment Variables

Add your Deepgram API key to `.env`:

```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
EDGE_CASE_DETECTION_ENABLED=true
DETECTION_MODE=hybrid
```

### 3. Apply Database Migrations

Run the edge case detection migration to update your Supabase schema:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually in Supabase SQL Editor
# Copy contents of supabase/migrations/002_edge_case_detection.sql
```

This adds:
- New columns to `segments` table (transcription, edge_case_score, detected_edge_cases, etc.)
- `custom_rules` table for user-defined rules
- `edge_case_matches` table for detailed match tracking
- Views and functions for analytics

### 4. Initialize Data

The taxonomy is already created at `backend/data/edge_case_taxonomy.json` with 57 edge cases across 7 categories.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Edge Case Detector                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Audio      │  │   Content    │  │   Pattern    │      │
│  │   Analyzer   │  │   Analyzer   │  │   Matcher    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                          │                                   │
│                  ┌───────▼────────┐                         │
│                  │   STT Provider  │                         │
│                  │   (Deepgram)    │                         │
│                  └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Detection Modes

1. **Built-in**: Uses only the 57 cases from the taxonomy
2. **Custom**: Uses only user-defined custom rules
3. **Hybrid** (recommended): Combines both built-in and custom rules

---

## Taxonomy

### Categories & Count

| Category | Count | Severity | Examples |
|----------|-------|----------|----------|
| Safety-Critical | 10 | Critical | Runway incursions, traffic conflicts, altitude deviations |
| Emergency Declarations | 9 | Critical | Mayday, Pan-Pan, fuel/engine emergencies |
| Readback Errors | 9 | High | Altitude/speed/heading mismatches, missing readbacks |
| Communication Failures | 7 | Medium | Stepped-on transmissions, garbled audio, radio failures |
| Phraseology Issues | 7 | Medium | Non-standard terminology, ambiguous instructions |
| Environmental Conditions | 6 | Medium | Low visibility ops, windshear, icing |
| Operational Issues | 6 | Low | High workload, confusion, unfamiliarity |
| STT Failure Modes | 3 | Low | Number confusion, callsign errors, jargon misrecognition |

**Total**: 57 edge cases

### Data Sources

- NASA ASRS Database - Runway Incursion Report Set
- FAA Runway Incursion Study 2016
- FAA Message Complexity Study (OAMTECHREP 200625)
- ICAO Annex 10 - Emergency Procedures
- Flight Safety Foundation Communication Studies
- NBAA Aviation Communications Survey

---

## API Reference

### Taxonomy

#### GET `/api/edge-cases/taxonomy`

Returns the complete built-in taxonomy.

**Response:**
```json
{
  "version": "1.0.0",
  "categories": {
    "safety_critical": {
      "name": "Safety-Critical Incidents",
      "cases": [...]
    }
  },
  "metadata": {
    "total_cases": 57,
    "sources": [...]
  }
}
```

### Custom Rules

#### GET `/api/edge-cases/rules`

Get all custom rules.

**Response:**
```json
{
  "rules": [...],
  "count": 4
}
```

#### POST `/api/edge-cases/rules`

Create a new custom rule.

**Request:**
```json
{
  "name": "High Workload Communication",
  "description": "Detects signs of high workload",
  "conditions": {
    "keywords": ["unable", "standby", "say again"],
    "speech_rate": ">200",
    "multiple_speakers": true
  },
  "priority": "medium"
}
```

**Response:**
```json
{
  "id": "custom-1234567890",
  "name": "High Workload Communication",
  "enabled": true,
  "created_at": "2025-01-20T12:00:00Z",
  ...
}
```

#### PUT `/api/edge-cases/rules/{id}`

Update an existing rule.

#### DELETE `/api/edge-cases/rules/{id}`

Delete a rule.

#### GET `/api/edge-cases/rules/templates`

Get pre-built rule templates for inspiration.

### Detection

#### POST `/api/segments/detect`

Analyze audio for edge cases.

**Option 1: Upload Audio File**

```bash
curl -X POST http://localhost:3001/api/segments/detect \
  -F "audio=@sample.mp3"
```

**Option 2: Analyze Existing Segment**

```bash
curl -X POST http://localhost:3001/api/segments/detect \
  -H "Content-Type: application/json" \
  -d '{"segmentId": "uuid-here"}'
```

**Response:**
```json
{
  "audioPath": "/path/to/audio.mp3",
  "transcription": {
    "text": "United 234, cross runway 22L at Alpha",
    "confidence": 0.95,
    "duration": 5.2,
    "speakerCount": 2
  },
  "detectedEdgeCases": [
    {
      "caseId": "SC-001",
      "caseName": "Runway Incursion - Unauthorized Entry",
      "category": "safety_critical",
      "severity": 1.0,
      "confidence": 0.8,
      "matchType": "keyword",
      "evidence": {
        "keywords": ["cross", "runway"]
      }
    }
  ],
  "customRuleMatches": [],
  "edgeCaseScore": 0.8,
  "flagged": true,
  "summary": "WARNING: Significant edge case detected\nTop matches:\n- Runway Incursion (80% confidence)"
}
```

#### GET `/api/segments/flagged`

Get all flagged segments with matches.

**Query Parameters:**
- `category` - Filter by edge case category
- `minScore` - Minimum edge case score (0-1)
- `reviewed` - Filter by review status (true/false)
- `limit` - Results per page (default: 100)
- `offset` - Pagination offset (default: 0)

**Example:**
```bash
curl "http://localhost:3001/api/segments/flagged?minScore=0.7&reviewed=false&limit=50"
```

#### PATCH `/api/segments/{id}/review`

Mark segment as reviewed.

**Request:**
```json
{
  "reviewed": true,
  "reviewNotes": "False positive - normal taxi clearance",
  "reviewedBy": "user-uuid"
}
```

#### GET `/api/segments/stats`

Get detection statistics.

**Response:**
```json
{
  "overall": {
    "total_segments": 1500,
    "transcribed_segments": 1200,
    "flagged_segments": 145,
    "reviewed_segments": 80,
    "avg_edge_case_score": 0.35,
    "avg_transcription_confidence": 0.88
  },
  "byCategory": [
    {
      "category": "safety_critical",
      "case_count": 8,
      "avg_severity": 0.95,
      "total_matches": 42
    }
  ],
  "severityDistribution": {
    "critical": 28,
    "high": 45,
    "medium": 52,
    "low": 20
  }
}
```

---

## Usage Examples

### Programmatic Usage

```javascript
import { EdgeCaseDetector } from './backend/services/detection';

// Initialize detector
const detector = new EdgeCaseDetector({
  mode: 'hybrid',  // or 'built-in', 'custom'
  customRules: [...]
});

await detector.initialize();

// Detect edge cases
const result = await detector.detect('path/to/audio.mp3');

console.log(`Edge Case Score: ${result.edgeCaseScore}`);
console.log(`Flagged: ${result.flagged}`);
console.log(`Detected Cases: ${result.detectedEdgeCases.length}`);

// Access individual matches
for (const match of result.detectedEdgeCases) {
  console.log(`- ${match.caseName} (${match.severity} severity)`);
}
```

### Standalone Transcription

```javascript
import { getSTTProvider } from './backend/services/transcription';

const stt = getSTTProvider('deepgram');

const result = await stt.transcribe('audio.mp3');

console.log(`Text: ${result.text}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Speakers: ${result.speakerCount}`);
console.log(`Duration: ${result.duration}s`);
```

---

## Integration

### LiveATC Pipeline Integration

Modify `scripts/upload-to-supabase.js` to include edge case detection:

```javascript
import { EdgeCaseDetector } from '../backend/services/detection/EdgeCaseDetector.js';

// After uploading segments, run detection
const detector = new EdgeCaseDetector();
await detector.initialize();

for (const segment of uploadedSegments) {
  const segmentPath = path.join(segmentDir, segment.filename);

  // Run detection
  const result = await detector.detect(segmentPath);

  // Update database with results
  await supabase.from('segments').update({
    transcription: result.transcription.text,
    transcription_confidence: result.transcription.confidence,
    edge_case_score: result.edgeCaseScore,
    speaker_count: result.transcription.speakerCount,
    flagged: result.flagged,
    detected_edge_cases: result.detectedEdgeCases
  }).eq('id', segment.id);

  // Insert detailed matches
  const matches = result.detectedEdgeCases.map(m => ({
    segment_id: segment.id,
    case_id: m.caseId,
    case_name: m.caseName,
    category: m.category,
    severity: m.severity,
    confidence: m.confidence,
    match_type: m.matchType,
    evidence: m.evidence
  }));

  if (matches.length > 0) {
    await supabase.from('edge_case_matches').insert(matches);
  }
}
```

---

## Custom Rules

### Rule Structure

```json
{
  "id": "custom-001",
  "name": "Rule Name",
  "description": "What this rule detects",
  "conditions": {
    "keywords": ["word1", "word2"],
    "speech_rate": ">200",
    "multiple_speakers": true,
    "high_volume_variance": true,
    "min_confidence": 0.7,
    "min_duration": 2,
    "max_duration": 20
  },
  "priority": "medium",
  "enabled": true
}
```

### Available Conditions

| Condition | Type | Description | Example |
|-----------|------|-------------|---------|
| `keywords` | array | Keywords to match | `["mayday", "emergency"]` |
| `speech_rate` | string | Speech rate in WPM | `">200"` or `"<100"` |
| `multiple_speakers` | boolean | Requires 2+ speakers | `true` |
| `high_volume_variance` | boolean | High volume variance detected | `true` |
| `min_confidence` | float | Minimum transcription confidence | `0.7` |
| `min_duration` | float | Minimum segment duration (seconds) | `2` |
| `max_duration` | float | Maximum segment duration (seconds) | `20` |

### Priority Levels

- `critical` - Severity score: 1.0
- `high` - Severity score: 0.8
- `medium` - Severity score: 0.6
- `low` - Severity score: 0.4

---

## Workflow Examples

### Auto-Detection on Pipeline

```
LiveATC Stream → Record → Segment → Transcribe → Detect Edge Cases → Flag → Database
```

### User Upload & Analysis

```
User Upload → Transcribe → Detect (built-in + custom) → Display Results → Save (optional)
```

### Review Mode

```
Get Flagged Segments → Listen → View Transcription → See Matches → Approve/Reject → Mark Reviewed
```

---

## Performance

- **Transcription**: ~0.5-2x realtime (Deepgram Nova-2)
- **Audio Analysis**: ~1-2 seconds per segment
- **Pattern Matching**: <0.1 seconds
- **Total**: ~2-5 seconds per 5-second segment

---

## Next Steps

1. **Add Deepgram API Key** to `.env`
2. **Run Database Migration** (`002_edge_case_detection.sql`)
3. **Test Detection** with sample audio via API
4. **Build Admin UI** (in progress)
5. **Integrate into Pipeline** (modify upload script)

---

## Resources

**Research Sources:**
- [NASA ASRS Database](https://asrs.arc.nasa.gov/)
- [ASRS Runway Incursion Report Set](https://asrs.arc.nasa.gov/docs/rpsts/rwy_incur.pdf)
- [Flight Safety Foundation - Communication Errors](https://flightsafety.org/asw-article/failure-to-communicate/)
- [FAA Message Complexity Study](https://www.faa.gov/sites/faa.gov/files/data_research/research/med_humanfacs/oamtechreports/200625.pdf)

**Documentation:**
- Deepgram API: https://developers.deepgram.com/
- Supabase: https://supabase.com/docs

---

**Generated with aviation domain expertise based on NASA ASRS incident patterns, FAA safety studies, and ICAO standards.**
