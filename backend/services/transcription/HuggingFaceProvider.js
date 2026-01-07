import { BaseSTTProvider } from './BaseSTTProvider.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * HuggingFace Speech-to-Text Provider
 * Implements STT using HuggingFace Inference API
 */
export class HuggingFaceProvider extends BaseSTTProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.HUGGINGFACE_API_KEY;
        this.endpoint = config.endpoint || process.env.HUGGINGFACE_ENDPOINT ||
            'https://f5o4r0mj9o65mg4o.us-east4.gcp.endpoints.huggingface.cloud';

        if (!this.apiKey) {
            throw new Error('HuggingFace API key is required (HUGGINGFACE_API_KEY env var or config.apiKey)');
        }
    }

    isConfigured() {
        return !!this.apiKey;
    }

    getName() {
        return 'huggingface';
    }

    /**
     * Convert audio file to base64
     * @param {string} audioPath - Path to audio file
     * @returns {Promise<string>} Base64-encoded audio
     */
    async encodeAudioToBase64(audioPath) {
        try {
            const audioBuffer = await fs.readFile(audioPath);
            return audioBuffer.toString('base64');
        } catch (error) {
            throw new Error(`Failed to read audio file: ${error.message}`);
        }
    }

    /**
     * Transcribe audio using HuggingFace API
     * @param {string|Buffer} audioInput - Path to audio file or audio buffer
     * @param {Object} options - Transcription options
     * @returns {Promise<TranscriptionResult>}
     */
    async transcribe(audioInput, options = {}) {
        try {
            let base64Audio;

            // Handle different input types
            if (typeof audioInput === 'string') {
                // It's a file path
                base64Audio = await this.encodeAudioToBase64(audioInput);
            } else if (Buffer.isBuffer(audioInput)) {
                // It's a buffer
                base64Audio = audioInput.toString('base64');
            } else {
                throw new Error('audioInput must be a file path (string) or Buffer');
            }

            // Prepare request payload
            const payload = {
                inputs: base64Audio,
                parameters: options.parameters || {}
            };

            // Make request to HuggingFace endpoint
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            console.log('HuggingFace raw response:', result);

            // Parse response and normalize to standard format
            return this.normalizeResponse(result, audioInput, options.parameters);
        } catch (error) {
            console.error('HuggingFace transcription error:', error);
            throw new Error(`HuggingFace transcription failed: ${error.message}`);
        }
    }

    /**
     * Normalize HuggingFace response to standard TranscriptionResult format
     * @param {Object} response - Raw HuggingFace API response
     * @param {string|Buffer} audioInput - Original audio input for duration calculation
     * @param {Object} parameters - Parameters used for transcription
     * @returns {TranscriptionResult}
     */
    normalizeResponse(response, audioInput, parameters = {}) {
        let text = '';
        let confidence = 1.0;
        let words = [];
        let metadata = { ...response };

        // Handle different response formats
        if (Array.isArray(response)) {
            if (response.length > 0) {
                text = response.map(r => r.text).join(' ');
                confidence = response[0].confidence || 1.0;
            }
        } else if (response.text) {
            text = response.text;
            confidence = response.confidence || 1.0;

            // Extract words if available (from timestamp mode)
            if (response.chunks) {
                words = response.chunks.map(chunk => ({
                    word: chunk.text,
                    start: chunk.timestamp?.[0] || 0,
                    end: chunk.timestamp?.[1] || 0,
                    confidence: chunk.confidence || confidence
                }));
            } else if (response.words) {
                words = response.words.map(w => ({
                    word: w.word || w.text,
                    start: w.start || w.timestamp?.[0] || 0,
                    end: w.end || w.timestamp?.[1] || 0,
                    confidence: w.confidence || confidence
                }));
            }
        } else {
            throw new Error('Unexpected HuggingFace response format');
        }

        // If no word-level data, create simple word array from text
        if (words.length === 0 && text) {
            const textWords = text.split(/\s+/);
            words = textWords.map((word, idx) => ({
                word: word,
                start: 0,
                end: 0,
                confidence: confidence
            }));
        }

        return {
            text: text.trim(),
            confidence: confidence,
            words: words,
            duration: 0,
            metadata: {
                provider: 'huggingface',
                endpoint: this.endpoint,
                parameters: parameters,
                raw: metadata
            }
        };
    }

    /**
     * Get multiple transcription alternatives (for RLHF ranking)
     * Generates 3 variants by running transcription multiple times
     * @param {string|Buffer} audioInput - Audio input
     * @param {number} count - Number of alternatives to generate (default: 3)
     * @returns {Promise<Array<TranscriptionResult>>}
     */
    async transcribeWithAlternatives(audioInput, count = 3) {
        console.log(`Generating ${count} transcription variants with HuggingFace...`);

        const results = [];

        // Run transcription multiple times to get variants
        // The model may produce slightly different outputs each time
        for (let i = 0; i < count; i++) {
            console.log(`  Variant ${i + 1}/${count}: Running transcription...`);

            try {
                const result = await this.transcribe(audioInput, {
                    parameters: {}
                });

                // Add variant metadata
                result.metadata.variant = {
                    rank_position: i + 1,
                    model: `run_${i + 1}`,
                    model_description: `Transcription run #${i + 1}`,
                    parameters: {}
                };

                results.push(result);

                // Small delay between requests
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`  Error generating variant ${i + 1}:`, error.message);
            }
        }

        // If we couldn't generate any variants, throw error
        if (results.length === 0) {
            throw new Error('Failed to generate any transcription variants');
        }

        // If we have fewer than requested, duplicate the first one
        while (results.length < count) {
            const duplicate = JSON.parse(JSON.stringify(results[0]));
            duplicate.metadata.variant = {
                rank_position: results.length + 1,
                model: 'duplicate',
                model_description: 'Duplicate of first transcription',
                parameters: {}
            };
            results.push(duplicate);
        }

        console.log(`✅ Generated ${results.length} variants`);
        return results.slice(0, count);
    }
}
