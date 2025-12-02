import { DeepgramProvider } from './DeepgramProvider.js';
// Import other providers as they are implemented
// import { WhisperProvider } from './WhisperProvider.js';
// import { AssemblyAIProvider } from './AssemblyAIProvider.js';

/**
 * Speech-to-Text Provider Factory
 * Creates appropriate STT provider based on configuration
 */
export class STTFactory {
  static providers = {
    deepgram: DeepgramProvider,
    // whisper: WhisperProvider,
    // assemblyai: AssemblyAIProvider,
  };

  /**
   * Create STT provider instance
   * @param {string} providerName - Name of provider ('deepgram', 'whisper', etc.)
   * @param {Object} config - Provider configuration
   * @returns {BaseSTTProvider}
   */
  static create(providerName, config = {}) {
    const Provider = this.providers[providerName.toLowerCase()];

    if (!Provider) {
      throw new Error(
        `Unknown STT provider: ${providerName}. ` +
        `Available providers: ${Object.keys(this.providers).join(', ')}`
      );
    }

    return new Provider(config);
  }

  /**
   * Create provider from environment configuration
   * Checks for DEEPGRAM_API_KEY, OPENAI_API_KEY, etc.
   * @param {string|null} preferredProvider - Preferred provider name (optional)
   * @returns {BaseSTTProvider}
   */
  static createFromEnv(preferredProvider = null) {
    // If preferred provider is specified and available, use it
    if (preferredProvider && process.env[`${preferredProvider.toUpperCase()}_API_KEY`]) {
      return this.create(preferredProvider);
    }

    // Auto-detect available provider from environment
    if (process.env.DEEPGRAM_API_KEY) {
      return this.create('deepgram');
    }

    // Add checks for other providers as they are implemented
    // if (process.env.OPENAI_API_KEY) {
    //   return this.create('whisper');
    // }
    // if (process.env.ASSEMBLYAI_API_KEY) {
    //   return this.create('assemblyai');
    // }

    throw new Error(
      'No STT provider configured. Please set one of: DEEPGRAM_API_KEY'
    );
  }

  /**
   * Get list of available providers
   * @returns {Array<string>}
   */
  static getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Register a custom provider
   * @param {string} name - Provider name
   * @param {Class} ProviderClass - Provider class (must extend BaseSTTProvider)
   */
  static registerProvider(name, ProviderClass) {
    this.providers[name.toLowerCase()] = ProviderClass;
  }
}

/**
 * Convenience function to get configured STT provider
 * @param {string|null} provider - Provider name (optional, auto-detected if null)
 * @param {Object} config - Provider configuration
 * @returns {BaseSTTProvider}
 */
export function getSTTProvider(provider = null, config = {}) {
  if (provider) {
    return STTFactory.create(provider, config);
  }
  return STTFactory.createFromEnv();
}
