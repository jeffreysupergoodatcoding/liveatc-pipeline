# 🚀 Quick Reference: HuggingFace STT Integration

## ⚡ Quick Start (3 Steps)

### 1. Add Credentials to `.env`
```bash
HUGGINGFACE_API_KEY=hf_YOUR_TOKEN_HERE
HUGGINGFACE_ENDPOINT=https://f5o4r0mj9o65mg4o.us-east4.gcp.endpoints.huggingface.cloud
```

### 2. Test It
```bash
node scripts/test-huggingface-stt.js your-audio-file.flac
```

### 3. Compare with Deepgram
```bash
node scripts/compare-stt-providers.js your-audio-file.flac
```

---

## 📋 Common Commands

### Check Provider Status
```bash
node scripts/switch-stt-provider.js status
```

### List Available Providers
```bash
node scripts/switch-stt-provider.js list
```

### Test HuggingFace
```bash
node scripts/test-huggingface-stt.js path/to/audio.mp3
```

### Compare Both Providers
```bash
node scripts/compare-stt-providers.js path/to/audio.mp3
```

---

## 🔄 Switching Providers

### Option A: Auto-detect (Easy)
Just set the API key in `.env` and the system will auto-detect!

**Use Deepgram:**
```bash
DEEPGRAM_API_KEY=your_key
# HUGGINGFACE_API_KEY=commented_out
```

**Use HuggingFace:**
```bash
# DEEPGRAM_API_KEY=commented_out
HUGGINGFACE_API_KEY=your_key
```

### Option B: Explicit Selection
```bash
PREFERRED_STT_PROVIDER=huggingface  # or 'deepgram'
```

### Option C: In Code
```javascript
const hf = getSTTProvider('huggingface');
const dg = getSTTProvider('deepgram');
```

---

## 💻 Code Examples

### Basic Transcription
```javascript
import { getSTTProvider } from './backend/services/transcription/index.js';

// Auto-detect provider
const stt = getSTTProvider();
const result = await stt.transcribe('audio.mp3');

console.log(result.text);
console.log(result.confidence);
console.log(result.words);
```

### Explicit Provider
```javascript
// Use HuggingFace specifically
const hf = getSTTProvider('huggingface');
const result = await hf.transcribe('audio.mp3');
```

### Compare Results
```javascript
const hf = getSTTProvider('huggingface');
const dg = getSTTProvider('deepgram');

const [hfResult, dgResult] = await Promise.all([
  hf.transcribe('audio.mp3'),
  dg.transcribe('audio.mp3')
]);

console.log('HuggingFace:', hfResult.text);
console.log('Deepgram:', dgResult.text);
```

---

## 📊 Response Format (Both Providers)

```javascript
{
  text: "american 2100 and 75 turn right on to delta...",
  confidence: 0.96,
  words: [
    { word: "american", confidence: 0.98, start: 0.0, end: 0.5 },
    { word: "2100", confidence: 0.95, start: 0.5, end: 1.0 }
    // ...
  ],
  duration: 8.8,
  metadata: {
    provider: "huggingface",
    endpoint: "https://...",
    raw: { /* original response */ }
  }
}
```

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `backend/services/transcription/HuggingFaceProvider.js` | HuggingFace implementation |
| `scripts/test-huggingface-stt.js` | Test HF provider |
| `scripts/compare-stt-providers.js` | Compare providers |
| `scripts/switch-stt-provider.js` | Check provider status |
| `docs/HUGGINGFACE_SETUP.md` | Setup guide |
| `docs/STT_PROVIDERS.md` | Provider documentation |
| `docs/STT_ARCHITECTURE.md` | Architecture diagram |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "HuggingFace API key is required" | Add `HUGGINGFACE_API_KEY` to `.env` |
| "No STT provider configured" | Add at least one API key to `.env` |
| "Unexpected response format" | Check your HF model's output format |
| Provider not switching | Check `.env` is loaded, restart dev server |

---

## ✅ What's Different

- ✅ **No code changes** needed to switch providers
- ✅ **Same interface** for all providers  
- ✅ **Easy testing** with comparison tools
- ✅ **Keep Deepgram** working as before
- ✅ **Future-proof** for adding more providers

---

## 📚 Full Documentation

- 📖 [Setup Guide](docs/HUGGINGFACE_SETUP.md)
- 📖 [Provider Guide](docs/STT_PROVIDERS.md)
- 📖 [Architecture](docs/STT_ARCHITECTURE.md)
- 📖 [Integration Summary](HUGGINGFACE_INTEGRATION.md)

---

**Ready to test!** 🚀

```bash
# 1. Check current status
node scripts/switch-stt-provider.js status

# 2. Add your HF credentials to .env
# HUGGINGFACE_API_KEY=hf_YOUR_TOKEN_HERE

# 3. Test it
node scripts/test-huggingface-stt.js your-audio.flac
```
