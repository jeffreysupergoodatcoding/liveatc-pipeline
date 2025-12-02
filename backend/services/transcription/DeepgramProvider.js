import { BaseSTTProvider } from './BaseSTTProvider.js';
import { createClient } from '@deepgram/sdk';
import { promises as fs } from 'fs';

/**
 * Deepgram Speech-to-Text Provider
 * Implements STT using Deepgram API
 */
export class DeepgramProvider extends BaseSTTProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.DEEPGRAM_API_KEY;

    if (!this.apiKey) {
      throw new Error('Deepgram API key is required (DEEPGRAM_API_KEY env var or config.apiKey)');
    }

    this.client = createClient(this.apiKey);

    // Default options optimized for aviation communications
    this.defaultOptions = {
      model: 'nova-2',  // Latest and most accurate model
      language: 'en',
      smart_format: true,  // Automatically format output
      punctuate: true,
      diarize: true,  // Speaker diarization
      utterances: true,  // Get utterance-level timestamps
      keywords: this._getAviationKeywords(),  // Boost aviation terms
      ...config.defaultOptions
    };
  }

  /**
   * Aviation-specific keywords to boost recognition accuracy
   */
  _getAviationKeywords() {
    return [
      'mayday:5',
      'pan-pan:5',
      'runway:3',
      'taxiway:3',
      'clearance:3',
      'altitude:3',
      'heading:3',
      'squawk:3',
      'TCAS:4',
      'traffic:3',
      'hold short:4',
      'line up and wait:4',
      'cleared to land:4',
      'cleared for takeoff:4',
      'go around:4',
      'unable:3',
      'wilco:3',
      'roger:2',
      'affirm:3',
      'negative:3'
    ];
  }

  getName() {
    return 'deepgram';
  }

  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Transcribe audio using Deepgram
   * @param {string|Buffer} audioInput - File path or Buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioInput, options = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      let response;

      if (Buffer.isBuffer(audioInput)) {
        // Transcribe from buffer
        response = await this.client.listen.prerecorded.transcribeFile(
          audioInput,
          mergedOptions
        );
      } else if (typeof audioInput === 'string') {
        // Check if it's a URL or file path
        if (audioInput.startsWith('http://') || audioInput.startsWith('https://')) {
          // Transcribe from URL
          response = await this.client.listen.prerecorded.transcribeUrl(
            { url: audioInput },
            mergedOptions
          );
        } else {
          // Transcribe from file path
          const audioBuffer = await fs.readFile(audioInput);
          response = await this.client.listen.prerecorded.transcribeFile(
            audioBuffer,
            mergedOptions
          );
        }
      } else {
        throw new Error('audioInput must be a file path, URL, or Buffer');
      }

      // Debug: log response structure
      console.log('Deepgram response keys:', Object.keys(response));
      if (response.result) {
        console.log('response.result keys:', Object.keys(response.result));
      }
      if (response.results) {
        console.log('response.results keys:', Object.keys(response.results));
      }

      return this._formatResponse(response);
    } catch (error) {
      console.error('Deepgram error:', error);
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }
  }

  /**
   * Format Deepgram response to standard TranscriptionResult format
   */
  _formatResponse(response) {
    // Deepgram SDK v4+ returns response.result.results
    const result = response.result || response.results || response;
    const deepgramResults = result.results || result;

    if (!deepgramResults || !deepgramResults.channels || !deepgramResults.channels[0]) {
      console.error('Invalid response structure:', JSON.stringify(result, null, 2));
      throw new Error('Invalid Deepgram response structure');
    }

    const channel = deepgramResults.channels[0];

    if (!channel.alternatives || !channel.alternatives[0]) {
      throw new Error('No transcription alternatives in Deepgram response');
    }

    const alternative = channel.alternatives[0];

    // Extract word-level timestamps
    const words = alternative.words?.map(w => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
      speaker: w.speaker ?? null
    })) || [];

    // Extract speaker segments if diarization is enabled
    const segments = [];
    if (channel.alternatives[0].paragraphs?.paragraphs) {
      for (const paragraph of channel.alternatives[0].paragraphs.paragraphs) {
        for (const sentence of paragraph.sentences) {
          // Group consecutive words by speaker
          let currentSpeaker = null;
          let currentSegment = null;

          for (const word of sentence.words || []) {
            if (word.speaker !== currentSpeaker) {
              // New speaker, save previous segment
              if (currentSegment) {
                segments.push(currentSegment);
              }

              // Start new segment
              currentSpeaker = word.speaker;
              currentSegment = {
                speaker: word.speaker,
                start: word.start,
                end: word.end,
                text: word.word,
                confidence: word.confidence,
                words: [word.word]
              };
            } else {
              // Same speaker, extend segment
              currentSegment.end = word.end;
              currentSegment.text += ' ' + word.word;
              currentSegment.words.push(word.word);
              currentSegment.confidence = (currentSegment.confidence + word.confidence) / 2;
            }
          }

          // Save last segment
          if (currentSegment) {
            segments.push(currentSegment);
          }
        }
      }
    }

    // Detect unique speaker count
    const speakers = new Set(words.filter(w => w.speaker !== null).map(w => w.speaker));
    const speakerCount = speakers.size;

    // Get duration from metadata
    const duration = deepgramResults.metadata?.duration || 0;

    return {
      text: alternative.transcript,
      confidence: alternative.confidence,
      words: words,
      duration: duration,
      speakerCount: speakerCount,
      segments: segments,
      metadata: {
        provider: 'deepgram',
        model: deepgramResults.metadata?.model_info?.name || 'unknown',
        modelVersion: deepgramResults.metadata?.model_info?.version || 'unknown',
        channels: deepgramResults.metadata?.channels || 1,
        language: alternative.detected_language || 'en',
        raw: deepgramResults.metadata
      }
    };
  }

  /**
   * Real-time transcription (for future use)
   * @param {ReadableStream} audioStream - Audio stream
   * @param {Function} callback - Callback for interim results
   * @param {Object} options - Transcription options
   */
  async transcribeStream(audioStream, callback, options = {}) {
    // TODO: Implement streaming transcription for real-time use cases
    throw new Error('Streaming transcription not yet implemented');
  }
}
