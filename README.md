# LiveATC Training Pipeline

> A complete system for collecting, processing, and preparing ATC (Air Traffic Control) audio for machine learning model training.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

This pipeline enables you to:

- **Record** live ATC audio streams from 7 major airports (24+ feeds)
- **Segment** recordings into individual transmissions automatically
- **Transcribe** segments using Deepgram with confidence scoring
- **Label** data with a human-in-the-loop review interface  
- **Export** training datasets with audio augmentation for ML models
- **Fine-tune** speech-to-text models (Whisper) with the collected data

### Key Features

| Feature | Description |
|---------|-------------|
| **Live Recording** | Record from any available LiveATC feed via web UI |
| **Auto Segmentation** | Silence-based detection splits audio into transmissions |
| **Audio Processing** | Normalization, airband filter, data augmentation |
| **Labeling Interface** | Review, edit, and approve transcriptions |
| **Dataset Export** | Export with 1x-16x augmentation for ML training |
| **RLHF Support** | Generate transcription variants for preference learning |

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **ffmpeg** installed (`brew install ffmpeg` on macOS)
- **Supabase** account (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/liveatc-pipeline.git
cd liveatc-pipeline

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your Supabase credentials

# Run database migrations (see docs/DATABASE_SETUP.md)

# Start the development server
npm run dev
```

Open [http://localhost:3000/admin/liveatc](http://localhost:3000/admin/liveatc) to access the admin interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Admin Interface                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ Record   │ │ Segment  │ │ Labeled  │ │ Export Dataset       │ │
│  │ Audio    │ │ Analysis │ │ Clips    │ │ (Augmentation)       │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┬───────────┘ │
└───────┼────────────┼────────────┼───────────────────┼────────────┘
        │            │            │                   │
        ▼            ▼            ▼                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                        API Routes (/api)                          │
│  /record  │  /segments  │  /segment-labels  │  /export-dataset   │
└───────────────────────────────────────────────────────────────────┘
        │            │            │                   │
        ▼            ▼            ▼                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Supabase (PostgreSQL + Storage)               │
│   recordings │ segments │ segment_labels │ liveatc-segments       │
└───────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
liveatc-pipeline/
├── app/                      # Next.js application
│   ├── admin/liveatc/       # Admin interface components
│   │   └── components/      # React components
│   └── api/                 # API routes
│       ├── record/          # Recording API
│       ├── export-dataset/  # Export with augmentation
│       └── segments/        # Segment management
├── scripts/                  # CLI tools and automation
│   ├── liveatc-recorder.js  # Record from LiveATC streams
│   ├── segment-audio.js     # Split audio by silence
│   ├── upload-to-supabase.js# Upload to database
│   └── scheduled-pipeline.js# Automated processing
├── lib/                      # Shared utilities
├── docs/                     # Documentation
├── supabase/                 # Database migrations
└── training_data/           # Exported training data
```

## Available Airports & Feeds

| Airport | Code | Feeds |
|---------|------|-------|
| New York JFK | KJFK | Tower, Ground, Tower2 |
| San Francisco | KSFO | Tower, Ground, Combined, Departure |
| Houston Bush | KIAH | Tower, Approach, Ground N/S/W |
| Houston Hobby | KHOU | Combined |
| Austin | KAUS | Tower, Ground, Approach/Departure |
| Newark | KEWR | Tower, Ground, Approach, Departure |
| LaGuardia | KLGA | Tower, Ground, Approach, Departure |

## Core Workflows

### 1. Recording Audio

**Via Web UI:**
1. Go to Recordings tab
2. Select an airport feed
3. Choose duration (1 min - 1 hour)
4. Click "Start Recording"

**Via CLI:**
```bash
node scripts/liveatc-recorder.js --feed ksfo_twr --duration 300
```

### 2. Reviewing Segments

1. Go to "Segment Analysis" tab
2. Play audio segments
3. Review AI transcription
4. Edit and approve as needed

### 3. Exporting Training Data

1. Go to "Labeled Clips" tab
2. Click "Export Dataset"
3. Configure options:
   -  Audio Normalization (EBU R128)
   -  Airband Radio Filter (300-3000Hz)
   -  Dataset Multiplier (1x-16x augmentation)
4. Download ZIP file with audio + metadata.jsonl

## Dataset Export Features

| Option | Description |
|--------|-------------|
| **Normalization** | EBU R128 loudness normalization (-16 LUFS) |
| **Airband Filter** | Bandpass 300-3000Hz + compression |
| **Time Stretch** | Speed variations (0.85x - 1.15x) |
| **Pitch Shift** | ±4 semitones variations |
| **Volume** | ±6dB variations |
| **Noise Injection** | 1-8% white noise overlay |

## Development

```bash
# Start development server
npm run dev

# Run specific script
node scripts/segment-audio.js --input recordings/raw/example.mp3

# Check pipeline status
node scripts/check-pipeline-status.js
```

## Documentation

| Document | Description |
|----------|-------------|
| [Database Setup](docs/DATABASE_SETUP.md) | Supabase configuration |
| [Audio Processing](docs/AUDIO_PROCESSING.md) | Trimming, normalization |
| [RLHF Pipeline](docs/RLHF_PIPELINE.md) | Preference learning setup |
| [API Reference](docs/API_REFERENCE.md) | Endpoint documentation |

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a PR.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built for ATC speech-to-text model training** 🎧✈️
