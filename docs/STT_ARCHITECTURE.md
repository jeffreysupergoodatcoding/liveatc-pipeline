# STT Provider Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│  (Scripts, API routes, transcription functions)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ getSTTProvider('huggingface')
                        │ getSTTProvider('deepgram')
                        │ getSTTProvider() // auto-detect
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     STTFactory 🏭                            │
│  • Auto-detection from environment                           │
│  • Provider registry                                         │
│  • Explicit provider selection                               │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
    ┌─────────┴─────────┐         ┌──────────┴──────────┐
    │                   │         │                     │
    ▼                   ▼         ▼                     ▼
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Deepgram      │  │  HuggingFace     │  │  Future          │
│  Provider 📡   │  │  Provider 🤗     │  │  Providers...    │
├────────────────┤  ├──────────────────┤  └──────────────────┘
│ ✅ Production  │  │ ✅ Custom Models │
│ ✅ Word-level  │  │ ✅ Flexible      │
│ ✅ Diarization │  │ ✅ Cost-effective│
│ ✅ Alternatives│  │ ✅ Base64 ready  │
└────────────────┘  └──────────────────┘
         │                   │
         └─────────┬─────────┘
                   │
                   │ implements
                   ▼
         ┌──────────────────┐
         │ BaseSTTProvider  │
         │   (Interface)    │
         └──────────────────┘
                   │
                   │ returns
                   ▼
         ┌──────────────────┐
         │ TranscriptionResult
         ├──────────────────┤
         │ • text           │
         │ • confidence     │
         │ • words[]        │
         │ • duration       │
         │ • metadata       │
         └──────────────────┘
```

## Configuration Flow

```
.env file
├── DEEPGRAM_API_KEY → DeepgramProvider
├── HUGGINGFACE_API_KEY → HuggingFaceProvider
└── PREFERRED_STT_PROVIDER → Explicit selection
    
Auto-detection priority:
1. PREFERRED_STT_PROVIDER (if set)
2. DEEPGRAM_API_KEY (first priority)
3. HUGGINGFACE_API_KEY (second priority)
4. Error if none configured
```

## Usage Patterns

### Pattern 1: Auto-detect (Recommended)
```javascript
const stt = getSTTProvider();
const result = await stt.transcribe('audio.mp3');
```

### Pattern 2: Explicit Selection
```javascript
const hf = getSTTProvider('huggingface');
const result = await hf.transcribe('audio.mp3');
```

### Pattern 3: Environment-based
```javascript
const provider = process.env.PREFERRED_STT_PROVIDER || 'deepgram';
const stt = getSTTProvider(provider);
```

## Key Benefits

✅ **Seamless switching** - Change providers without code changes
✅ **Consistent interface** - All providers return same format
✅ **Easy testing** - Compare providers side-by-side
✅ **Future-proof** - Easy to add new providers
✅ **Backward compatible** - Existing code works unchanged
