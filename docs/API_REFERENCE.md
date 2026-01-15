# API Reference

This document describes the API endpoints available in the LiveATC Pipeline.

## Base URL

```
http://localhost:3000/api
```

## Recording API

### GET /api/record

Get available feeds and active recording sessions.

**Response:**
```json
{
  "airports": [
    {
      "code": "KJFK",
      "feeds": [
        {"id": "kjfk_gnd", "facility": "ground", "url": "..."},
        {"id": "kjfk_twr", "facility": "tower", "url": "..."}
      ]
    }
  ],
  "activeRecordings": [],
  "feedCount": 24
}
```

### POST /api/record

Start a new recording session.

**Request:**
```json
{
  "feedId": "ksfo_twr",
  "duration": 300
}
```

**Response:**
```json
{
  "success": true,
  "recordingId": "ksfo_twr_1704067200000",
  "message": "Started recording from KSFO tower",
  "details": {
    "feedId": "ksfo_twr",
    "airport": "KSFO",
    "facility": "tower",
    "duration": 300,
    "startedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### DELETE /api/record?id={recordingId}

Stop an active recording.

---

## Export Dataset API

### GET /api/export-dataset

Get export preview statistics.

**Response:**
```json
{
  "totalClips": 55,
  "totalDuration": 275.5,
  "airports": ["KIAH", "KJFK", "KSFO"]
}
```

### POST /api/export-dataset

Export labeled clips as a training dataset.

**Request:**
```json
{
  "options": {
    "normalize": true,
    "airbandFilter": true,
    "augmentation": true,
    "augmentationMultiplier": 4
  }
}
```

**Response:** ZIP file download containing:
- `audio/` - Processed audio files
- `metadata.jsonl` - Training metadata
- `summary.json` - Export statistics

---

## Segments API

### GET /api/segments

List segments with optional filters.

**Query Parameters:**
- `recording_id` - Filter by recording
- `status` - Filter by status (pending, processed, labeled)
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

### GET /api/segments/[id]

Get a single segment by ID.

### POST /api/segments/[id]/trim

Trim audio from a segment.

**Request:**
```json
{
  "removeRegions": [
    {"start": 0, "end": 1.5},
    {"start": 8.2, "end": 9.0}
  ],
  "previewOnly": false
}
```

---

## Segment Labels API

### GET /api/segment-labels

Get labeled segments.

**Query Parameters:**
- `airport` - Filter by airport code
- `quality` - Filter by quality (good, bad, rejected)

### POST /api/segment-labels

Create or update a label.

**Request:**
```json
{
  "segment_id": "uuid",
  "transcription": "United 425 cleared for takeoff",
  "quality": "good"
}
```

---

## Process Audio API

### POST /api/process-audio

Process a segment with Deepgram transcription.

**Request:**
```json
{
  "segmentId": "uuid"
}
```

**Response:**
```json
{
  "status": "high_confidence",
  "confidence": 0.95,
  "transcription": "United 425 cleared for takeoff runway 28 left",
  "variations": ["...", "...", "..."],
  "next_step": "needs_ranking"
}
```

---

## Upload API

### POST /api/upload

Upload an audio file directly.

**Request:** `multipart/form-data`
- `file` - Audio file (MP3, WAV)

**Response:**
```json
{
  "success": true,
  "segmentId": "uuid",
  "filePath": "uploads/upload_1704067200000_file.mp3"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `500` - Server error

---

## Rate Limits

- Recording API: 1 active recording per feed
- Export API: 1 concurrent export
- General: No hard limits (self-hosted)

## Authentication

Currently no authentication required (intended for local development).

For production, consider adding:
- API key authentication
- Supabase Auth integration
- Rate limiting per user
