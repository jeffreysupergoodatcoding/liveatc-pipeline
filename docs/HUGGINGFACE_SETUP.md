# Quick Setup Guide: HuggingFace STT Integration

## ✅ What's Been Added

I've successfully integrated HuggingFace as an alternative STT provider alongside Deepgram. You can now easily switch between them for testing!

## 📁 Files Created/Modified

### New Files:
- `backend/services/transcription/HuggingFaceProvider.js` - HuggingFace STT implementation
- `scripts/test-huggingface-stt.js` - Test script for HuggingFace alone
- `scripts/compare-stt-providers.js` - Compare Deepgram vs HuggingFace side-by-side
- `docs/STT_PROVIDERS.md` - Comprehensive provider documentation

### Modified Files:
- `backend/services/transcription/STTFactory.js` - Added HuggingFace to factory
- `backend/services/transcription/index.js` - Export HuggingFace provider
- `.env.example` - Added HuggingFace configuration

## 🚀 Quick Start

### 1. Add Your HuggingFace Credentials

Add these to your `.env` file:

```bash
# HuggingFace STT Provider
HUGGINGFACE_API_KEY=hf_YOUR_TOKEN_HERE
HUGGINGFACE_ENDPOINT=https://f5o4r0mj9o65mg4o.us-east4.gcp.endpoints.huggingface.cloud
```

### 2. Test HuggingFace Provider

```bash
# Test with a specific audio file
node scripts/test-huggingface-stt.js path/to/audio.flac

# Example with LiveATC segment
node scripts/test-huggingface-stt.js data/liveatc/segments/some_segment.mp3
```

### 3. Compare Both Providers

```bash
node scripts/compare-stt-providers.js path/to/audio.flac
```

This will run both Deepgram and HuggingFace on the same file and show you a side-by-side comparison!

## 🔄 Switching Between Providers

### Method 1: Environment Variables (Automatic)

The system auto-detects which provider to use:

```bash
# Use Deepgram (if DEEPGRAM_API_KEY is set)
# Leave HuggingFace commented out in .env

# Use HuggingFace (if DEEPGRAM_API_KEY is NOT set)
# Uncomment HUGGINGFACE_API_KEY in .env
```

### Method 2: Preferred Provider

Add to `.env`:

```bash
PREFERRED_STT_PROVIDER=huggingface  # or 'deepgram'
```

Then in your code:

```javascript
import { getSTTProvider } from './backend/services/transcription/index.js';

const preferredProvider = process.env.PREFERRED_STT_PROVIDER;
const stt = getSTTProvider(preferredProvider);
```

### Method 3: Explicit in Code

```javascript
import { getSTTProvider } from './backend/services/transcription/index.js';

// Use HuggingFace
const hf = getSTTProvider('huggingface');
const result = await hf.transcribe('audio.mp3');

// Use Deepgram
const dg = getSTTProvider('deepgram');
const result2 = await dg.transcribe('audio.mp3');
```

## 📝 Using in Your Scripts

Any script that uses transcription can now use either provider:

```javascript
import { getSTTProvider } from '../backend/services/transcription/index.js';

// This will use whichever provider is configured
const stt = getSTTProvider();

// Or explicitly choose
const hf = getSTTProvider('huggingface');
const dg = getSTTProvider('deepgram');

// Both have the same interface!
const result = await stt.transcribe('path/to/audio.mp3');
console.log(result.text);
console.log(result.confidence);
console.log(result.words);
```

## 🎯 Where to Use It

The HuggingFace provider can be used anywhere you're currently using Deepgram:

- **Segment transcription** (`scripts/segment-audio.js`)
- **RLHF variant generation** (`scripts/process-high-confidence.js`)
- **Edge case detection** (`scripts/detect-edge-cases.js`)
- **Manual testing** (new test scripts)

## 🔍 Testing Your Integration

1. **Test HuggingFace alone:**
   ```bash
   node scripts/test-huggingface-stt.js sample1.flac
   ```

2. **Compare side-by-side:**
   ```bash
   node scripts/compare-stt-providers.js sample1.flac
   ```

3. **Verify API response:**
   - Check console output for the transcription result
   - Verify word-level confidence data if your HF model provides it
   - Compare accuracy with Deepgram

## 💡 Tips

- **Keep both API keys** in `.env` so you can quickly switch for testing
- **Use the comparison script** to see which model performs better on your audio
- **Check the raw response** in the metadata field to understand your HF model's output format
- **Deepgram is still the default** - HuggingFace is only used if you explicitly request it or if Deepgram isn't available

## 🐛 Troubleshooting

**Error: "HuggingFace API key is required"**
- Add `HUGGINGFACE_API_KEY` to your `.env` file

**Error: "Unexpected HuggingFace response format"**
- Your HF model may return a different format
- Check the raw response in the error logs
- Modify `normalizeResponse()` in `HuggingFaceProvider.js` if needed

**No word-level confidence data**
- Some HF models don't provide word-level timestamps
- The provider will create basic word entries from the text
- Consider using a model that provides detailed output

## 📚 More Information

See `docs/STT_PROVIDERS.md` for complete documentation on:
- All available providers
- Configuration options
- API response formats
- Advanced usage patterns
