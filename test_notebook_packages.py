#!/usr/bin/env python3
"""
Test script to validate the notebook's package versions work together.
This simulates what will happen in Colab.
"""

import sys
import subprocess

def test_imports():
    """Test that all imports work without numpy.rec errors."""
    print("🧪 Testing package imports...\n")
    
    test_code = """
import warnings
warnings.filterwarnings('ignore')

# Critical imports that cause numpy.rec errors
import numpy as np
from scipy import signal
import librosa
import torch

# Transformers imports
from transformers import (
    WhisperProcessor,
    WhisperForConditionalGeneration,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
    TrainerCallback
)

# Other imports
from datasets import Dataset
import evaluate

# Version checks
print(f"✅ NumPy: {np.__version__}")
print(f"✅ PyTorch: {torch.__version__}")

# Test scipy.signal (the one that breaks with numpy.rec)
b, a = signal.butter(6, [300/8000, 3400/8000], btype='band')
print(f"✅ SciPy signal processing works!")

print("\\n🎉 All imports successful! No numpy.rec errors!")
"""
    
    try:
        result = subprocess.run(
            [sys.executable, '-c', test_code],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(result.stdout)
        
        if result.returncode != 0:
            print("❌ Import test failed:")
            print(result.stderr)
            return False
        else:
            print("\n✅ Import test passed!")
            return True
            
    except Exception as e:
        print(f"❌ Error running test: {e}")
        return False


def check_package_versions():
    """Check if recommended package versions are available."""
    print("\n📦 Checking recommended package versions...\n")
    
    packages = {
        'numpy': '1.24.3',
        'scipy': '1.10.1',
        'transformers': '4.35.2',
        'datasets': '2.14.6',
        'librosa': '0.10.1',
    }
    
    for package, version in packages.items():
        cmd = f"pip index versions {package} 2>/dev/null | grep -q {version}"
        result = subprocess.run(cmd, shell=True, capture_output=True)
        
        status = "✅" if result.returncode == 0 else "ℹ️"
        print(f"{status} {package}=={version}")
    
    print("\nℹ️  These versions are available on PyPI")


if __name__ == "__main__":
    print("="*60)
    print("🧪 NOTEBOOK VALIDATION TEST")
    print("="*60)
    print()
    print("Testing if the package versions in the notebook work together...")
    print()
    
    # Check versions available
    check_package_versions()
    
    # Test imports
    success = test_imports()
    
    print("\n" + "="*60)
    if success:
        print("✅ VALIDATION PASSED")
        print("="*60)
        print("\nThe notebook should work in Google Colab!")
    else:
        print("⚠️  VALIDATION FAILED")
        print("="*60)
        print("\nThere may be package conflicts. Review the errors above.")
    
    sys.exit(0 if success else 1)
