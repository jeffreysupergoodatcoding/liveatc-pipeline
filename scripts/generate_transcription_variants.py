#!/usr/bin/env python3
"""
Generate multiple transcription variations from HuggingFace ASR model for RLHF training.

This script generates genuinely different transcriptions by varying:
- Temperature
- Beam search parameters
- Top-k/top-p sampling
"""

import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
import librosa
import numpy as np
from typing import List, Dict
import warnings
warnings.filterwarnings('ignore')


class TranscriptionVariantGenerator:
    """Generate multiple transcription variants for RLHF training."""
    
    def __init__(self, model_id: str = "openai/whisper-large-v3"):
        """
        Initialize the variant generator.
        
        Args:
            model_id: HuggingFace model ID (default: Whisper Large V3)
        """
        print(f"🔧 Loading model: {model_id}")
        
        # Set device
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        print(f"   Device: {self.device}")
        
        # Load model and processor
        self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id,
            torch_dtype=torch_dtype,
            low_cpu_mem_usage=True,
            use_safetensors=True
        )
        self.model.to(self.device)
        
        self.processor = AutoProcessor.from_pretrained(model_id)
        
        print("✅ Model loaded successfully\n")
    
    def load_audio(self, audio_path: str) -> np.ndarray:
        """
        Load and preprocess audio file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Audio array at 16kHz sample rate
        """
        audio, sr = librosa.load(audio_path, sr=16000)
        return audio
    
    def generate_variants(
        self, 
        audio_path: str, 
        num_variants: int = 5,
        language: str = "en"
    ) -> List[Dict[str, any]]:
        """
        Generate multiple transcription variants with different decoding strategies.
        
        Args:
            audio_path: Path to audio file
            num_variants: Number of variants to generate (default: 5)
            language: Language code (default: "en")
            
        Returns:
            List of variant dictionaries with text and metadata
        """
        print(f"🎵 Loading audio: {audio_path}")
        audio = self.load_audio(audio_path)
        
        print(f"📝 Generating {num_variants} transcription variants...\n")
        
        # Preprocess audio
        inputs = self.processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features.to(self.device)
        
        # Define variant configurations
        configs = [
            {
                "name": "greedy",
                "description": "Greedy decoding (most confident)",
                "params": {
                    "max_new_tokens": 128,
                    "do_sample": False,
                }
            },
            {
                "name": "beam_search",
                "description": "Beam search with 5 beams",
                "params": {
                    "max_new_tokens": 128,
                    "num_beams": 5,
                    "do_sample": False,
                }
            },
            {
                "name": "low_temp_sampling",
                "description": "Low temperature sampling (T=0.3)",
                "params": {
                    "max_new_tokens": 128,
                    "do_sample": True,
                    "temperature": 0.3,
                    "top_k": 50,
                    "top_p": 0.95,
                }
            },
            {
                "name": "medium_temp_sampling",
                "description": "Medium temperature sampling (T=0.7)",
                "params": {
                    "max_new_tokens": 128,
                    "do_sample": True,
                    "temperature": 0.7,
                    "top_k": 50,
                    "top_p": 0.9,
                }
            },
            {
                "name": "high_temp_sampling",
                "description": "High temperature sampling (T=1.0)",
                "params": {
                    "max_new_tokens": 128,
                    "do_sample": True,
                    "temperature": 1.0,
                    "top_k": 40,
                    "top_p": 0.85,
                }
            },
            {
                "name": "nucleus_sampling",
                "description": "Pure nucleus sampling (top-p=0.9)",
                "params": {
                    "max_new_tokens": 128,
                    "do_sample": True,
                    "temperature": 0.8,
                    "top_p": 0.9,
                    "top_k": 0,  # Disable top-k
                }
            },
            {
                "name": "diverse_beam",
                "description": "Diverse beam search",
                "params": {
                    "max_new_tokens": 128,
                    "num_beams": 5,
                    "num_beam_groups": 5,
                    "diversity_penalty": 1.0,
                    "do_sample": False,
                }
            },
        ]
        
        variants = []
        
        # Generate variants
        for i, config in enumerate(configs[:num_variants]):
            print(f"  Variant {i+1}/{num_variants}: {config['name']} - {config['description']}")
            
            try:
                # Generate with specific parameters
                predicted_ids = self.model.generate(
                    inputs,
                    language=language,
                    **config["params"]
                )
                
                # Decode
                transcription = self.processor.batch_decode(
                    predicted_ids,
                    skip_special_tokens=True
                )[0]
                
                variant = {
                    "rank_position": i + 1,
                    "model": config["name"],
                    "model_description": config["description"],
                    "text": transcription.strip(),
                    "parameters": config["params"],
                }
                
                variants.append(variant)
                print(f"     ✓ \"{transcription.strip()[:60]}{'...' if len(transcription.strip()) > 60 else ''}\"")
                
            except Exception as e:
                print(f"     ✗ Error: {str(e)}")
                continue
        
        print(f"\n✅ Generated {len(variants)} variants successfully")
        return variants


def main():
    """Main function to demonstrate usage."""
    import sys
    
    # Check if audio file provided
    if len(sys.argv) < 2:
        print("Usage: python generate_transcription_variants.py <audio_file_path> [num_variants]")
        print("\nExample:")
        print("  python generate_transcription_variants.py sample.mp3 5")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    num_variants = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    # You can change this to your model
    # For your ATC model, replace with your model ID or path
    model_id = "openai/whisper-large-v3"  # or use your fine-tuned model
    
    print("=" * 60)
    print("🎙️  Transcription Variant Generator for RLHF")
    print("=" * 60)
    print()
    
    # Initialize generator
    generator = TranscriptionVariantGenerator(model_id)
    
    # Generate variants
    variants = generator.generate_variants(audio_path, num_variants)
    
    # Display results
    print("\n" + "=" * 60)
    print("📊 VARIANT RESULTS")
    print("=" * 60)
    
    for i, variant in enumerate(variants):
        print(f"\n📝 Variant {i+1}: {variant['model']}")
        print("-" * 60)
        print(f"Description: {variant['model_description']}")
        print(f"Text: \"{variant['text']}\"")
        print(f"Parameters: {variant['parameters']}")
    
    # Check uniqueness
    print("\n" + "=" * 60)
    print("📈 UNIQUENESS ANALYSIS")
    print("=" * 60)
    
    texts = [v['text'].lower().strip() for v in variants]
    unique_texts = set(texts)
    
    print(f"\nTotal variants: {len(variants)}")
    print(f"Unique transcriptions: {len(unique_texts)}")
    
    if len(unique_texts) == 1:
        print("⚠️  All variants produced the same text")
        print("   Try using higher temperatures or more diverse beam search")
    elif len(unique_texts) == len(variants):
        print("✅ All variants are unique!")
    else:
        print(f"✅ Generated {len(unique_texts)} different transcriptions")
    
    # Show unique texts
    if len(unique_texts) > 1:
        print("\nUnique transcriptions:")
        for i, text in enumerate(unique_texts, 1):
            print(f"  {i}. \"{text}\"")


if __name__ == "__main__":
    main()
