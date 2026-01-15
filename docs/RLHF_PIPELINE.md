# RLHF Pipeline Guide

This guide covers the Reinforcement Learning from Human Feedback (RLHF) capabilities of the LiveATC Pipeline.

## Overview

The RLHF pipeline helps improve speech-to-text models by:

1. Generating multiple transcription variants
2. Collecting human preferences between variants
3. Training models with preference data

## Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Audio     │ -> │ Variant Generator │ -> │ Human Ranking   │
│  Segment    │    │  (Whisper/HF)    │    │   Interface     │
└─────────────┘    └──────────────────┘    └─────────────────┘
                                                   │
                                                   ▼
                           ┌─────────────────────────────────┐
                           │      Preference Pairs           │
                           │  (chosen vs rejected outputs)   │
                           └─────────────────────────────────┘
                                           │
                                           ▼
                           ┌─────────────────────────────────┐
                           │      DPO/PPO Training           │
                           │   (Preference Optimization)     │
                           └─────────────────────────────────┘
```

## Generating Transcription Variants

### Using Hugging Face (Recommended)

The pipeline integrates with Hugging Face for variant generation:

```python
# See: ATC_Transcription_Variants_RLHF.ipynb

from transformers import WhisperProcessor, WhisperForConditionalGeneration

# Load model
model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-small")
processor = WhisperProcessor.from_pretrained("openai/whisper-small")

# Generate variants with different decoding strategies
variants = [
    generate_greedy(audio),      # Greedy decoding
    generate_beam(audio, n=5),   # Beam search
    generate_sample(audio, t=0.7) # Temperature sampling
]
```

### Decoding Strategies

| Strategy | Parameters | Use Case |
|----------|------------|----------|
| **Greedy** | - | Baseline transcription |
| **Beam Search** | beam_width=5 | Higher quality alternatives |
| **Temperature** | temp=0.5-1.0 | Diverse variations |
| **Top-K** | k=50 | Controlled randomness |
| **Top-P** | p=0.95 | Nucleus sampling |

## Human Ranking Interface

Access the ranking interface at `/rank-outputs`:

### Features

- Play audio for each segment
- View multiple transcription variants
- Drag to rank from best to worst
- Add notes for training
- Skip problematic samples

### Workflow

1. Listen to the audio
2. Read all variant transcriptions
3. Rank by accuracy and naturalness
4. Submit ranking
5. Move to next sample

## Data Format

### model_outputs Table

```sql
CREATE TABLE model_outputs (
  id UUID PRIMARY KEY,
  segment_id UUID REFERENCES segments(id),
  model_name TEXT,           -- e.g., "whisper-small"
  decoding_strategy TEXT,    -- e.g., "beam_5"
  output_text TEXT,
  confidence FLOAT,
  created_at TIMESTAMP
);
```

### preference_pairs Table

```sql
CREATE TABLE preference_pairs (
  id UUID PRIMARY KEY,
  segment_id UUID,
  chosen_output_id UUID,     -- Better transcription
  rejected_output_id UUID,   -- Worse transcription
  annotator_id TEXT,
  created_at TIMESTAMP
);
```

## Training with Preference Data

### Export Format

```json
{
  "prompt": "[AUDIO: kiah_twr_segment_001.mp3]",
  "chosen": "United 425 cleared for takeoff runway 28 left",
  "rejected": "United 4 to 5 clear for take off run way 28 left"
}
```

### Using with TRL

```python
from trl import DPOTrainer

trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    train_dataset=preference_dataset,
    tokenizer=tokenizer,
)

trainer.train()
```

## Batch Processing

For large datasets, use batch processing:

```bash
# Generate variants for all unlabeled segments
node scripts/generate-variants-batch.js

# Export preference pairs
node scripts/export-preference-pairs.js
```

## Best Practices

### Data Quality

1. **Diverse Sources** - Use segments from multiple airports/facilities
2. **Clear Audio** - Focus on high-quality segments first
3. **Consistent Annotators** - Minimize annotator variance
4. **Calibration** - Periodically check annotator agreement

### Training Tips

1. **Start Small** - Begin with 100-500 preference pairs
2. **Balance** - Equal representation of airports/accents
3. **Iterate** - Train, evaluate, collect more data
4. **Validate** - Hold out test set for evaluation

## Integration with Fine-Tuning

The RLHF pipeline complements supervised fine-tuning:

```
Step 1: SFT (Supervised Fine-Tuning)
        └── Train on labeled transcriptions
        
Step 2: RLHF (Preference Learning)  
        └── Refine with human preferences
        
Step 3: Evaluation
        └── Test on held-out data
```

## Jupyter Notebook

The included notebook (`ATC_Transcription_Variants_RLHF.ipynb`) provides:

- Complete variant generation code
- Google Colab compatibility
- Example training loop
- Evaluation metrics

## Resources

- [TRL Documentation](https://huggingface.co/docs/trl)
- [DPO Paper](https://arxiv.org/abs/2305.18290)
- [Whisper Fine-Tuning Guide](https://huggingface.co/blog/fine-tune-whisper)
