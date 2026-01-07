# Speech-to-Text Provider Configuration

The LiveATC Pipeline supports multiple speech-to-text (STT) providers. You can easily switch between them using environment variables.

## Available Providers

### 1. Deepgram (Default)
```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

### 2. HuggingFace
```bash
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HUGGINGFACE_ENDPOINT=https://f5o4r0mj9o65mg4o.us-east4.gcp.endpoints.huggingface.cloud
```

## Switching Between Providers

### Method 1: Environment Variable (Automatic)
The system will automatically detect which provider to use based on available API keys:
- If `DEEPGRAM_API_KEY` is set, Deepgram will be used
- If `HUGGINGFACE_API_KEY` is set (and Deepgram is not), HuggingFace will be used

### Method 2: Explicit Provider Selection
You can explicitly specify which provider to use in your code:

```javascript
import { getSTTProvider } from './backend/services/transcription/index.js';

// Use Deepgram
const deepgram = getSTTProvider('deepgram');

// Use HuggingFace
const huggingface = getSTTProvider('huggingface');

// Auto-detect (uses first available)
const stt = getSTTProvider();
```

### Method 3: Configuration Variable
Add this to your `.env` file to set a preferred provider:

```bash
# Options: 'deepgram' or 'huggingface'
PREFERRED_STT_PROVIDER=huggingface
```

Then use it in your code:
```javascript
const preferredProvider = process.env.PREFERRED_STT_PROVIDER;
const stt = getSTTProvider(preferredProvider);
```

## Testing the HuggingFace Provider

To test the HuggingFace provider, add your API key to `.env`:

```bash
HUGGINGFACE_API_KEY=hf_YOUR_TOKEN_HERE
HUGGINGFACE_ENDPOINT=https://f5o4r0mj9o65mg4o.us-east4.gcp.endpoints.huggingface.cloud
```

Then run transcription as normal. The system will use HuggingFace if Deepgram is not available.

## API Response Formats

### Deepgram
- Full word-level timestamps
- Multiple transcription alternatives
- Speaker diarization support

### HuggingFace
- Depends on the model deployed at the endpoint
- Basic text transcription
- May include word-level data depending on model capabilities

## Notes

- Both providers implement the same `BaseSTTProvider` interface
- Response formats are normalized to a standard `TranscriptionResult` object
- You can switch providers without changing your application code
- Keep both API keys in `.env` to easily switch for testing
