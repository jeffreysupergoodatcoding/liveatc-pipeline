"""
Whisper ATC Fine-tuning Script for Google Colab Pro
====================================================
Purpose: Fine-tune jacktol's ATC Whisper model on your American ATC dataset
Author: Jeffrey
Date: January 2025

Base Model: jacktol/whisper-large-v3-finetuned-for-ATC (WER: 6.5%)
Target: Further improve accuracy on American ATC communications

INSTRUCTIONS FOR COLAB:
1. Upload this script to Colab or copy cells into a notebook
2. Upload your dataset folder (atc_training_dataset_2026-01-15) to Colab
3. Make sure to select GPU runtime: Runtime > Change runtime type > A100
4. Run all cells in order

Dataset format expected:
- metadata.jsonl with {"audio": "audio/xxx.mp3", "text": "...", ...}
- audio/ folder with MP3 files
"""

# ============================================================================
# CELL 1: Install Dependencies
# ============================================================================
# Run this cell first to install required packages

"""
!pip install -q transformers datasets evaluate librosa soundfile accelerate
!pip install -q tensorboard jiwer
"""

# ============================================================================
# CELL 2: Imports and Setup
# ============================================================================

import os
import json
import torch
import numpy as np
import librosa
from pathlib import Path
from datasets import Dataset, Audio
from transformers import (
    WhisperProcessor,
    WhisperForConditionalGeneration,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer
)
from dataclasses import dataclass
from typing import Any, Dict, List, Union
import evaluate
from transformers import pipeline
import warnings

warnings.filterwarnings('ignore')

print("\n" + "="*80)
print(" 🎧 WHISPER ATC FINE-TUNING PIPELINE")
print(" Fine-tuning for American ATC Communications")
print("="*80 + "\n")

# ============================================================================
# CELL 3: Configuration
# ============================================================================

# === PATHS - UPDATE THESE FOR YOUR SETUP ===
DATASET_DIR = "./atc_training_dataset_2026-01-15"  # Your uploaded dataset folder
METADATA_FILE = os.path.join(DATASET_DIR, "metadata.jsonl")
OUTPUT_DIR = "./whisper-american-atc-finetuned"

# === MODEL ===
# Using jacktol's model - already fine-tuned on ATC with 6.5% WER
MODEL_NAME = "jacktol/whisper-large-v3-finetuned-for-ATC"

# === TRAINING HYPERPARAMETERS (Optimized for Colab Pro A100) ===
LEARNING_RATE = 1e-5      # Slightly higher than before since we have more data
BATCH_SIZE = 8            # A100 can handle larger batches
GRADIENT_ACCUMULATION = 2 # Effective batch size = 16
NUM_EPOCHS = 3            # 3 epochs is usually enough for fine-tuning
WARMUP_RATIO = 0.1        # 10% of training for warmup
WEIGHT_DECAY = 0.01       # L2 regularization

# === AUDIO ===
SAMPLE_RATE = 16000

# === DATASET SPLIT ===
VAL_SPLIT = 0.15  # 15% for validation
RANDOM_SEED = 42

# === HARDWARE DETECTION ===
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🖥️  Device: {device}")
if device == "cuda":
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"   GPU: {gpu_name}")
    print(f"   VRAM: {gpu_memory:.1f} GB")
    
    # Auto-adjust batch size based on GPU
    if "A100" in gpu_name:
        print("   ✅ A100 detected - using optimal settings")
        BATCH_SIZE = 8
    elif "V100" in gpu_name:
        print("   📊 V100 detected - reducing batch size")
        BATCH_SIZE = 4
    elif "T4" in gpu_name:
        print("   ⚠️  T4 detected - using conservative settings")
        BATCH_SIZE = 2
        GRADIENT_ACCUMULATION = 8
else:
    print("   ❌ No GPU detected! Training will be very slow.")
    print("   Go to Runtime > Change runtime type > GPU")
print()

# ============================================================================
# CELL 4: Dataset Loading
# ============================================================================

def load_jsonl_dataset(dataset_dir: str, metadata_file: str) -> Dataset:
    """
    Load ATC dataset from JSONL metadata format.
    
    Expected format in metadata.jsonl (one JSON object per line):
    {"audio": "audio/seg_xxx.mp3", "text": "transcription...", "duration": 4.5, "source": "original"}
    
    Returns:
        HuggingFace Dataset with audio arrays and transcriptions
    """
    print("📂 Loading dataset...")
    print(f"   Directory: {dataset_dir}")
    print(f"   Metadata: {metadata_file}")
    
    if not os.path.exists(metadata_file):
        raise FileNotFoundError(f"❌ Metadata file not found: {metadata_file}")
    
    # Read all samples from JSONL
    samples = []
    with open(metadata_file, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            if line.strip():
                try:
                    samples.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"   ⚠️ Skipping invalid JSON on line {line_num}: {e}")
    
    print(f"   Found {len(samples)} samples in metadata")
    
    # Process samples
    data = {
        "audio": [],
        "text": [],
        "duration": [],
        "source": [],
        "audio_path": []
    }
    
    processed = 0
    skipped = 0
    total_duration = 0
    
    for i, sample in enumerate(samples):
        audio_path = os.path.join(dataset_dir, sample["audio"])
        
        # Validate audio file exists
        if not os.path.exists(audio_path):
            skipped += 1
            continue
        
        # Validate transcript
        transcript = sample.get("text", "").strip()
        if not transcript:
            skipped += 1
            continue
        
        try:
            # Load audio with librosa (handles MP3, WAV, etc.)
            audio_array, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
            
            data["audio"].append({
                "array": audio_array,
                "sampling_rate": SAMPLE_RATE
            })
            data["text"].append(transcript)
            data["duration"].append(sample.get("duration", len(audio_array) / SAMPLE_RATE))
            data["source"].append(sample.get("source", "unknown"))
            data["audio_path"].append(audio_path)
            
            total_duration += data["duration"][-1]
            processed += 1
            
            # Progress indicator
            if processed % 50 == 0:
                print(f"   Loaded {processed} files...")
                
        except Exception as e:
            print(f"   ⚠️ Error loading {audio_path}: {e}")
            skipped += 1
    
    # Create HuggingFace Dataset
    dataset = Dataset.from_dict(data)
    
    # Statistics
    num_original = sum(1 for s in data["source"] if s == "original")
    num_augmented = sum(1 for s in data["source"] if s == "augmented")
    
    print(f"\n✅ Dataset loaded successfully!")
    print(f"   Total samples: {len(dataset)}")
    print(f"   Original: {num_original}")
    print(f"   Augmented: {num_augmented}")
    print(f"   Total duration: {total_duration / 60:.1f} minutes")
    if skipped > 0:
        print(f"   ⚠️ Skipped: {skipped} files")
    print()
    
    return dataset

# ============================================================================
# CELL 5: Data Preprocessing
# ============================================================================

def prepare_dataset(batch: Dict, processor: WhisperProcessor) -> Dict:
    """
    Convert raw audio and text to Whisper model input format.
    
    Whisper expects:
    - input_features: 80-channel log-mel spectrogram
    - labels: Tokenized transcript IDs
    """
    audio = batch["audio"]
    
    # Convert audio to log-mel spectrogram features
    batch["input_features"] = processor.feature_extractor(
        audio["array"],
        sampling_rate=audio["sampling_rate"]
    ).input_features[0]
    
    # Tokenize the transcript
    batch["labels"] = processor.tokenizer(batch["text"]).input_ids
    
    return batch


@dataclass
class WhisperDataCollator:
    """
    Data collator for Whisper training.
    Handles variable-length padding for both audio features and text labels.
    """
    processor: Any

    def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
        # Separate and pad input features
        input_features = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")

        # Separate and pad labels
        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")

        # Replace padding tokens with -100 (ignored by loss function)
        labels = labels_batch["input_ids"].masked_fill(
            labels_batch.attention_mask.ne(1), -100
        )

        # Remove BOS token if present at start
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]

        batch["labels"] = labels
        return batch

# ============================================================================
# CELL 6: Metrics
# ============================================================================

# WER metric loaded lazily to avoid import-time errors
_wer_metric = None

def get_wer_metric():
    """Lazy load WER metric to avoid issues before dependencies are installed."""
    global _wer_metric
    if _wer_metric is None:
        _wer_metric = evaluate.load("wer")
    return _wer_metric

def compute_metrics(pred, processor: WhisperProcessor) -> Dict[str, float]:
    """
    Compute Word Error Rate (WER) during evaluation.
    """
    pred_ids = pred.predictions
    label_ids = pred.label_ids

    # Replace -100 with pad token for decoding
    label_ids[label_ids == -100] = processor.tokenizer.pad_token_id

    # Decode to text
    pred_str = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
    label_str = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)

    # Compute WER (as percentage)
    wer = 100 * get_wer_metric().compute(predictions=pred_str, references=label_str)

    return {"wer": wer}

# ============================================================================
# CELL 7: Training Pipeline
# ============================================================================

def train():
    """
    Complete training pipeline:
    1. Load dataset
    2. Load model & processor
    3. Preprocess data
    4. Configure training
    5. Train
    6. Save & evaluate
    """
    
    # ========== STEP 1: Load Dataset ==========
    print("="*80)
    print(" STEP 1: LOADING DATASET")
    print("="*80 + "\n")
    
    dataset = load_jsonl_dataset(DATASET_DIR, METADATA_FILE)
    
    # ========== STEP 2: Split Dataset ==========
    print("="*80)
    print(" STEP 2: SPLITTING DATASET")
    print("="*80 + "\n")
    
    splits = dataset.train_test_split(
        test_size=VAL_SPLIT,
        seed=RANDOM_SEED,
        shuffle=True
    )
    train_dataset = splits["train"]
    eval_dataset = splits["test"]
    
    # Keep text for later evaluation
    eval_texts = eval_dataset["text"]
    eval_audio_paths = eval_dataset["audio_path"]
    
    print(f"✅ Train set: {len(train_dataset)} samples")
    print(f"✅ Validation set: {len(eval_dataset)} samples")
    print()
    
    # ========== STEP 3: Load Model ==========
    print("="*80)
    print(" STEP 3: LOADING MODEL")
    print("="*80 + "\n")
    
    print(f"📥 Loading: {MODEL_NAME}")
    print("   This may take a few minutes for the first download...")
    
    processor = WhisperProcessor.from_pretrained(MODEL_NAME)
    model = WhisperForConditionalGeneration.from_pretrained(MODEL_NAME)
    
    # Configure for training
    model.config.use_cache = False  # Required for gradient checkpointing
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []
    
    # Enable memory optimization
    model.gradient_checkpointing_enable()
    
    print(f"\n✅ Model loaded!")
    print(f"   Parameters: {model.num_parameters() / 1e9:.2f}B")
    print(f"   Base WER: 6.5% (on jacktol's ATC test set)")
    print()
    
    # ========== STEP 4: Preprocess Data ==========
    print("="*80)
    print(" STEP 4: PREPROCESSING DATA")
    print("="*80 + "\n")
    
    print("🔄 Converting audio to Whisper input format...")
    
    # Remove columns we don't need for training
    columns_to_remove = ["audio", "text", "duration", "source", "audio_path"]
    
    train_dataset_processed = train_dataset.map(
        lambda x: prepare_dataset(x, processor),
        remove_columns=columns_to_remove,
        desc="Processing train data"
    )
    
    eval_dataset_processed = eval_dataset.map(
        lambda x: prepare_dataset(x, processor),
        remove_columns=columns_to_remove,
        desc="Processing eval data"
    )
    
    print(f"\n✅ Preprocessing complete!")
    print(f"   Feature shape: {train_dataset_processed[0]['input_features'].shape}")
    print()
    
    # ========== STEP 5: Configure Training ==========
    print("="*80)
    print(" STEP 5: CONFIGURING TRAINING")
    print("="*80 + "\n")
    
    data_collator = WhisperDataCollator(processor=processor)
    
    # Calculate training steps
    effective_batch = BATCH_SIZE * GRADIENT_ACCUMULATION
    steps_per_epoch = max(1, len(train_dataset) // effective_batch)
    total_steps = steps_per_epoch * NUM_EPOCHS
    warmup_steps = int(total_steps * WARMUP_RATIO)
    
    training_args = Seq2SeqTrainingArguments(
        output_dir=OUTPUT_DIR,
        
        # Batch settings
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        
        # Learning schedule
        learning_rate=LEARNING_RATE,
        warmup_steps=warmup_steps,
        num_train_epochs=NUM_EPOCHS,
        weight_decay=WEIGHT_DECAY,
        
        # Evaluation & saving
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        
        # Logging
        logging_steps=10,
        logging_dir=f"{OUTPUT_DIR}/logs",
        report_to=["tensorboard"],
        
        # Performance optimization
        fp16=True,  # Mixed precision for faster training
        gradient_checkpointing=True,
        
        # Misc
        remove_unused_columns=False,
        dataloader_num_workers=2,
        push_to_hub=False,
        seed=RANDOM_SEED,
    )
    
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset_processed,
        eval_dataset=eval_dataset_processed,
        data_collator=data_collator,
        tokenizer=processor.feature_extractor,
    )
    
    print("✅ Training configured!")
    print(f"   Batch size: {BATCH_SIZE}")
    print(f"   Gradient accumulation: {GRADIENT_ACCUMULATION}")
    print(f"   Effective batch size: {effective_batch}")
    print(f"   Learning rate: {LEARNING_RATE}")
    print(f"   Epochs: {NUM_EPOCHS}")
    print(f"   Steps per epoch: ~{steps_per_epoch}")
    print(f"   Total steps: ~{total_steps}")
    print(f"   Warmup steps: {warmup_steps}")
    print()
    
    # ========== STEP 6: Train ==========
    print("="*80)
    print(" STEP 6: TRAINING")
    print("="*80 + "\n")
    
    print("🚀 Starting training...")
    print("   Watch for decreasing loss values!")
    print("   TensorBoard logs saved to:", f"{OUTPUT_DIR}/logs")
    print()
    
    try:
        train_result = trainer.train()
        print("\n✅ Training completed successfully!")
        print(f"   Final loss: {train_result.training_loss:.4f}")
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        raise
    
    # ========== STEP 7: Save Model ==========
    print("\n" + "="*80)
    print(" STEP 7: SAVING MODEL")
    print("="*80 + "\n")
    
    trainer.save_model(OUTPUT_DIR)
    processor.save_pretrained(OUTPUT_DIR)
    
    print(f"✅ Model saved to: {OUTPUT_DIR}")
    print("   Files saved:")
    for f in os.listdir(OUTPUT_DIR):
        if not f.startswith('.') and not f == 'logs':
            size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
            if size > 1e9:
                print(f"   - {f} ({size/1e9:.2f} GB)")
            elif size > 1e6:
                print(f"   - {f} ({size/1e6:.2f} MB)")
            else:
                print(f"   - {f} ({size/1e3:.1f} KB)")
    print()
    
    # ========== STEP 8: Quick Evaluation ==========
    print("="*80)
    print(" STEP 8: EVALUATION")
    print("="*80 + "\n")
    
    print("🔍 Running quick evaluation on validation set...")
    
    # Create pipeline for inference
    finetuned_pipe = pipeline(
        "automatic-speech-recognition",
        model=OUTPUT_DIR,
        device=0 if device == "cuda" else -1,
        chunk_length_s=30
    )
    
    # Test on a few samples
    num_test = min(10, len(eval_texts))
    predictions = []
    references = []
    
    print(f"\n📝 Sample Predictions (first {num_test}):\n")
    
    for i in range(num_test):
        # Load audio for prediction
        audio, sr = librosa.load(eval_audio_paths[i], sr=SAMPLE_RATE)
        result = finetuned_pipe({"array": audio, "sampling_rate": sr})
        
        pred = result["text"]
        ref = eval_texts[i]
        
        predictions.append(pred)
        references.append(ref)
        
        print(f"--- Sample {i+1} ---")
        print(f"Ground Truth: {ref}")
        print(f"Prediction:   {pred}")
        print()
    
    # Compute WER on test samples
    test_wer = 100 * get_wer_metric().compute(predictions=predictions, references=references)
    
    print("="*80)
    print(" 📊 RESULTS")
    print("="*80)
    print(f"\n   Base Model WER: 6.5% (jacktol's benchmark)")
    print(f"   Your Fine-tuned WER: {test_wer:.2f}% (on {num_test} validation samples)")
    
    if test_wer < 6.5:
        print(f"\n   🎉 IMPROVEMENT: Your model is {6.5 - test_wer:.2f}% better!")
    elif test_wer < 10:
        print(f"\n   ✅ Good performance - comparable to base model")
    else:
        print(f"\n   ⚠️ WER higher than expected - consider:")
        print("      - More training data")
        print("      - Lower learning rate")
        print("      - Check data quality")
    
    print("\n" + "="*80)
    print(" 🎯 TRAINING COMPLETE!")
    print("="*80)
    print(f"\n   📁 Model saved to: {OUTPUT_DIR}")
    print(f"\n   💡 Next steps:")
    print(f"      - Download model from Colab files")
    print(f"      - Test on new American ATC audio")
    print(f"      - Consider uploading to HuggingFace Hub")
    print("\n" + "="*80 + "\n")
    
    return trainer, processor

# ============================================================================
# CELL 8: Run Training
# ============================================================================

if __name__ == "__main__":
    # Check dataset exists
    if not os.path.exists(DATASET_DIR):
        print("❌ ERROR: Dataset folder not found!")
        print(f"   Expected: {DATASET_DIR}")
        print("\n   Please upload your dataset folder to Colab:")
        print("   1. Click the folder icon on the left sidebar")
        print("   2. Upload 'atc_training_dataset_2026-01-15' folder")
        print("   3. Or use: from google.colab import files; files.upload()")
    else:
        trainer, processor = train()
