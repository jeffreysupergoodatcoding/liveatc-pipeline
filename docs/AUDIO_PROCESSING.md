# Audio Processing Guide

This document covers audio processing features in the LiveATC Pipeline.

## Overview

The pipeline includes several audio processing capabilities:

1. **Segmentation** - Split recordings into individual transmissions
2. **Trimming** - Remove unwanted sections from segments
3. **Normalization** - Standardize audio levels
4. **Airband Filter** - Simulate radio characteristics
5. **Data Augmentation** - Create training variations

## Segmentation

Audio files are automatically segmented based on silence detection.

### How It Works

1. **Silence Detection** - Uses ffmpeg `silencedetect` filter
2. **Boundary Calculation** - Identifies speech regions between silences
3. **Filtering** - Keeps segments between 2-20 seconds
4. **Quality Scoring** - Rates audio quality based on volume levels

### Configuration

```bash
# In segment-audio.js
--silence-threshold -40   # dB (lower = more sensitive)
--silence-duration 0.5    # Minimum silence length in seconds
--min-duration 2          # Minimum segment length
--max-duration 20         # Maximum segment length
```

### Usage

```bash
node scripts/segment-audio.js --input recordings/raw/example.mp3
```

## Audio Trimming

The web UI includes an audio trimmer for removing unwanted sections.

### Features

- Visual waveform display
- Click and drag to select regions
- Remove multiple regions at once
- Preview before saving
- Non-destructive (original preserved)

### API Endpoint

```
POST /api/segments/[id]/trim
{
  "removeRegions": [
    { "start": 0, "end": 1.5 },      // Remove first 1.5 seconds
    { "start": 8.2, "end": 9.0 }     // Remove static between 8.2-9s
  ],
  "previewOnly": false
}
```

## Export Processing

When exporting datasets, audio can be processed with these options:

### Audio Normalization

**EBU R128 Standard** - Professional broadcast loudness normalization

```
Target: -16 LUFS (Loudness Units Full Scale)
True Peak: -1.5 dBTP
Loudness Range: 11 LU
```

This ensures consistent volume levels across all training samples.

### Airband Radio Filter

Simulates the characteristics of aviation radio:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Highpass | 300 Hz | Remove low rumble |
| Lowpass | 3000 Hz | Limit to voice range |
| Compression | 4:1 ratio | Simulate radio limiting |

This makes training data more representative of actual radio audio.

### Data Augmentation

Create multiple variations of each sample to improve model robustness:

| Augmentation | Range | Purpose |
|--------------|-------|---------|
| **Time Stretch** | 0.85x - 1.15x | Handle different speaking rates |
| **Pitch Shift** | ±4 semitones | Handle different voices |
| **Volume** | ±6 dB | Handle different recording levels |
| **Noise** | 1-8% white noise | Handle noisy conditions |

#### Multiplier Options

| Multiplier | Augmentations per Sample | Total per Original |
|------------|-------------------------|-------------------|
| 1x | 1 (tempo only) | 2 |
| 2x | 2 (tempo, pitch) | 3 |
| 4x | 4 (tempo×2, pitch×2) | 5 |
| 8x | 8 (all types ×2) | 9 |
| 16x | 16 (all types expanded) | 17 |

## Output Format

Exported datasets include:

```
dataset.zip/
├── audio/
│   ├── seg_abc123.mp3           # Original (processed)
│   ├── seg_abc123_tempo0_90.mp3 # Time stretched
│   ├── seg_abc123_pitchp2st.mp3 # Pitch shifted +2 semitones
│   └── ...
├── metadata.jsonl               # Training metadata
└── summary.json                 # Export statistics
```

### metadata.jsonl Format

```json
{
  "audio": "audio/seg_abc123.mp3",
  "text": "United 425 cleared for takeoff runway 28 left",
  "duration": 4.5,
  "source": "original",
  "processing": {
    "normalized": true,
    "airband_filtered": true
  }
}
```

## FFmpeg Commands Reference

The pipeline uses ffmpeg for all audio processing. Here are the key commands:

### Normalization
```bash
ffmpeg -i input.mp3 -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 16000 -ac 1 output.mp3
```

### Airband Filter
```bash
ffmpeg -i input.mp3 -af "highpass=f=300,lowpass=f=3000,acompressor=threshold=-20dB:ratio=4:attack=5:release=50" output.mp3
```

### Time Stretch
```bash
ffmpeg -i input.mp3 -af "atempo=0.9" output.mp3
```

### Pitch Shift
```bash
ffmpeg -i input.mp3 -af "asetrate=17959,aresample=16000,atempo=0.8909" output.mp3
```

## Best Practices

1. **Sample Rate**: Always use 16kHz for speech models
2. **Channels**: Convert to mono for consistency
3. **Format**: MP3 128kbps is a good balance of quality and size
4. **Normalization**: Always normalize before other processing
5. **Augmentation**: Use higher multipliers for small datasets
