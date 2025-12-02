/**
 * Base Speech-to-Text Provider Interface
 * Abstract class defining the interface for STT providers
 */

export class BaseSTTProvider {
  constructor(config = {}) {
    if (this.constructor === BaseSTTProvider) {
      throw new Error('BaseSTTProvider is abstract and cannot be instantiated directly');
    }
    this.config = config;
  }

  /**
   * Transcribe audio file
   * @param {string|Buffer} audioInput - Path to audio file or audio buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioInput, options = {}) {
    throw new Error('transcribe() must be implemented by provider');
  }

  /**
   * Check if provider is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by provider');
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by provider');
  }
}

/**
 * Standard transcription result format
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Full transcription text
 * @property {number} confidence - Overall confidence score (0-1)
 * @property {Array<WordTimestamp>} words - Individual words with timestamps
 * @property {number} duration - Audio duration in seconds
 * @property {Object} metadata - Provider-specific metadata
 * @property {number} speakerCount - Number of detected speakers (if available)
 * @property {Array<Segment>} segments - Speaker-segmented transcription (if available)
 */

/**
 * Word with timestamp information
 * @typedef {Object} WordTimestamp
 * @property {string} word - The word
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {number} confidence - Word confidence (0-1)
 */

/**
 * Speaker segment
 * @typedef {Object} Segment
 * @property {number} speaker - Speaker ID
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Segment text
 * @property {number} confidence - Segment confidence (0-1)
 */
