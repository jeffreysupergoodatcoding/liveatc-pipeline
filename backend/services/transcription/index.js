/**
 * Speech-to-Text Transcription Service
 * Provider-agnostic STT interface
 */

export { BaseSTTProvider } from './BaseSTTProvider.js';
export { DeepgramProvider } from './DeepgramProvider.js';
export { HuggingFaceProvider } from './HuggingFaceProvider.js';
export { STTFactory, getSTTProvider } from './STTFactory.js';

// Example usage:
// import { getSTTProvider } from './services/transcription';
//
// const stt = getSTTProvider('deepgram');
// const result = await stt.transcribe('path/to/audio.mp3');
// console.log(result.text, result.confidence, result.words);
