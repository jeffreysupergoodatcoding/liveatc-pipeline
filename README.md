# Fine-Tuning Whisper for American ATC Speech Recognition

> **54.8% relative WER reduction** on American Air Traffic Control audio — from 30.3% to 13.7% — using 55 clips and full Whisper Large v3 fine-tuning.

[![Model](https://img.shields.io/badge/HuggingFace-whisper--atc--finetuned-yellow)](https://huggingface.co/jeffreysuu/whisper-atc-finetuned)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9+-blue)](https://python.org)
[![Colab](https://colab.research.google.com/assets/colab-badge.svg)](notebooks/Whisper_ATC_FineTuning.ipynb)

---

## Results

| Model | WER | Relative Improvement |
|-------|-----|---------------------|
| Baseline (European-trained ATC model) | 30.3% | — |
| **Ours (Whisper Large v3, fine-tuned)** | **13.7%** | **54.8%** |

Trained on only **55 American ATC clips** from IAH, JFK, and SFO on a single T4 GPU in ~25 minutes.

### Qualitative Example

| | Transcription |
|--|---------------|
| **Reference** | `United 425 cleared for takeoff runway 28 left, wind 240 at 12` |
| **Baseline** | `United four two five clear for take off runway twenty-eight left wind two forty at twelve` |
| **Ours** | `United 425 cleared for takeoff runway 28 left wind 240 at 12` |

The fine-tuned model correctly uses numeric formatting (ATC standard) and tighter American phraseology.

---

## What This Repo Contains

```
liveatc-pipeline/
├── notebooks/
│   ├── Whisper_ATC_FineTuning.ipynb        # Full fine-tuning pipeline (Colab-ready)
│   ├── ATC_Transcription_Variants_RLHF.ipynb # RLHF variant generation
│   └── whisper_atc_finetune_colab.py       # Script version of fine-tuning
├── paper/
│   ├── main.tex                             # arXiv paper (LaTeX source)
│   └── references.bib                       # Bibliography
├── app/                                     # Next.js labeling interface
├── scripts/                                 # Data collection & processing pipeline
├── docs/                                    # Pipeline documentation
└── supabase/                                # Database schema & migrations
```

---

## Motivation

Existing open-source ATC speech recognition models are primarily trained on European data (ATCO2, Singapore's controllers). They fail on American ATC due to:

- **Accent differences**: American regional accents vs. European/Singaporean controllers
- **Phraseology gaps**: US uses numeric callsigns ("1503") vs. spelled-out ("Fifteen Zero Three")
- **Frequency characteristics**: Airband radio (300–3400 Hz bandpass) introduces noise patterns specific to American radio hardware

This project builds a complete pipeline from **raw LiveATC stream → labeled dataset → fine-tuned model**.

---

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         DATA COLLECTION                                   │
│   LiveATC.net ──▶ Record (7 airports) ──▶ Silence Segmentation           │
│                         ──▶ Upload to Supabase                            │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                         LABELING INTERFACE                                │
│   Web UI: Play audio ──▶ Review/Edit Deepgram transcript ──▶ Approve     │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                         PREPROCESSING & AUGMENTATION                      │
│   Bandpass filter (300–3400 Hz) ──▶ EBU R128 normalization               │
│   5× augmentation: time stretch, pitch shift, noise, gain variation       │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                         FINE-TUNING                                       │
│   Whisper Large v3 ──▶ Full fine-tuning (no LoRA)                        │
│   LR: 5e-6 · 5 epochs · Weight decay: 0.01 · T4 GPU · ~25 min           │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  jeffreysuu/whisper-atc-   │
                    │     finetuned (13.7% WER)  │
                    └───────────────────────────┘
```

---

## Dataset

| Property | Value |
|----------|-------|
| Source | LiveATC.net |
| Airports | IAH (Houston), JFK (New York), SFO (San Francisco) |
| Clips | 55 American ATC transmissions |
| Duration | ~5 minutes raw, ~25 minutes after 5× augmentation |
| Transcription | Manual annotation |
| Format | MP3 segments + JSONL metadata |

**Data augmentation applied (5×):**
- Time stretching (0.85×–1.15×)
- Pitch shifting (±4 semitones)
- White noise injection (1–8%)
- Gain variation (±6 dB)
- Bandpass filtering (300–3400 Hz, airband radio simulation)

---

## Why LoRA Didn't Work

LoRA (Low-Rank Adaptation) via the PEFT library is incompatible with Whisper's encoder-decoder architecture. PEFT expects `input_ids` as the primary input, but Whisper's encoder takes `input_features` (mel spectrogram). This causes a shape mismatch that is non-trivial to patch.

**Resolution:** Full fine-tuning with conservative hyperparameters (low LR, weight decay, limited epochs, heavy augmentation) to mitigate overfitting on the small dataset.

---

## Training Setup

```
Hardware:  Google Colab, Tesla T4 GPU (15 GB VRAM)
Time:      ~25 minutes
Precision: FP16

Hyperparameters:
  Base model:          openai/whisper-large-v3
  Learning rate:       5e-6
  Epochs:              5
  Batch size:          4 (gradient accumulation 4 → effective 16)
  Warmup steps:        50
  Weight decay:        0.01
  Eval strategy:       per epoch
```

---

## Using the Fine-Tuned Model

```python
from transformers import pipeline

pipe = pipeline(
    "automatic-speech-recognition",
    model="jeffreysuu/whisper-atc-finetuned",
    device=0  # GPU; use -1 for CPU
)

result = pipe("your_atc_audio.mp3")
print(result["text"])
# e.g. "Delta 832 descend and maintain flight level 240 speed 280 knots"
```

---

## Run the Full Pipeline

### Prerequisites

- Node.js 18+, ffmpeg, Supabase account

### Setup

```bash
git clone https://github.com/jeffreysupergoodatcoding/liveatc-pipeline.git
cd liveatc-pipeline

npm install
cp .env.example .env
# Add your Supabase credentials to .env

npm run dev
# Open http://localhost:3000/admin/liveatc
```

### Record & Label Data

1. Go to Recordings tab → select airport feed → start recording
2. Segment Analysis tab → review transcriptions → approve
3. Labeled Clips tab → Export Dataset (configure augmentation)

### Fine-Tune

Open `notebooks/Whisper_ATC_FineTuning.ipynb` in Google Colab (T4 GPU recommended), upload your exported dataset ZIP, and run all cells.

---

## Supported Airports

| Airport | Code | Feeds |
|---------|------|-------|
| New York JFK | KJFK | Tower, Ground, Tower2 |
| San Francisco | KSFO | Tower, Ground, Combined, Departure |
| Houston Bush | KIAH | Tower, Approach, Ground N/S/W |
| Houston Hobby | KHOU | Combined |
| Austin | KAUS | Tower, Ground, Approach/Departure |
| Newark | KEWR | Tower, Ground, Approach, Departure |
| LaGuardia | KLGA | Tower, Ground, Approach, Departure |

---

## Comparison with Related Work

| System | Training Data | WER |
|--------|--------------|-----|
| Wee et al. 2023 (Singapore) | ~20,000 clips | ~8% |
| Whisper-ATC (European) | ~2.9M utterances | ~6.5% |
| **Ours** | **55 clips** | **13.7%** |

We use **370× less data** than the Singapore paper and **52,850× less** than Whisper-ATC, yet achieve competitive accuracy on American ATC — a domain neither system was trained on.

---

## Research Paper

A full research paper describing this work is available in [`paper/main.tex`](paper/main.tex).

**Topics covered:**
- Related work on ATC ASR and accent adaptation
- Dataset creation and preprocessing methodology
- Training and augmentation strategy
- Quantitative and qualitative evaluation
- Forward-looking roadmap: RLHF and RLVR for ATC reasoning systems
- 6-layer system architecture toward an AI ATC co-pilot

---

## Forward-Looking: RLHF & RLVR Roadmap

This work focuses on speech recognition (Layer 1). The longer-term vision is a full ATC reasoning system:

```
Layer 1: Speech Recognition     ← this work (13.7% WER)
Layer 2: Natural Language Understanding (ATC command parsing)
Layer 3: World Model            (4D airspace state tracking)
Layer 4: RL Agent               (RLHF → RLVR with FAA safety constraints)
Layer 5: Natural Language Generation (phraseology-compliant responses)
Layer 6: Speech Synthesis       (radio-quality TTS)
```

**RLVR reward signals planned:**
- Separation standards (FAA 7110.65 compliance)
- Collision probability metrics
- Communication efficiency
- Phraseology correctness

---

## Citation

If you use this work, please cite:

```bibtex
@misc{suu2025atcwhisper,
  title  = {Fine-Tuning Whisper for American Air Traffic Control Speech Recognition},
  author = {Suu, Jeffrey},
  year   = {2025},
  note   = {Available at: https://github.com/jeffreysupergoodatcoding/liveatc-pipeline},
  url    = {https://huggingface.co/jeffreysuu/whisper-atc-finetuned}
}
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
