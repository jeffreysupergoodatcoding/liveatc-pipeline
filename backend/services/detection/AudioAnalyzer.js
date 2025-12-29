import { spawn } from 'child_process';

/**
 * Audio Analysis Service
 * Analyzes audio characteristics for edge case detection
 */
export class AudioAnalyzer {
  /**
   * Analyze audio file for quality and anomaly indicators
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<AudioAnalysisResult>}
   */
  async analyze(audioPath) {
    const [volumeStats, silenceDetection, audioInfo] = await Promise.all([
      this.analyzeVolume(audioPath),
      this.detectSilences(audioPath),
      this.getAudioInfo(audioPath)
    ]);

    // Calculate derived metrics
    const speechDensity = this._calculateSpeechDensity(silenceDetection, audioInfo.duration);
    const volumeVariance = this._calculateVolumeVariance(volumeStats);
    const overlappingTransmissions = this._detectOverlappingTransmissions(volumeStats, audioInfo);

    return {
      duration: audioInfo.duration,
      volume: volumeStats,
      silence: silenceDetection,
      speechDensity,
      volumeVariance,
      overlappingTransmissions,
      metadata: audioInfo
    };
  }

  /**
   * Analyze volume characteristics
   */
  async analyzeVolume(audioPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', audioPath,
        '-af', 'volumedetect,astats',
        '-f', 'null',
        '-'
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          return reject(new Error(`Volume analysis failed with code ${code}`));
        }

        // Parse volume statistics
        const meanMatch = stderr.match(/mean_volume: ([-\d.]+) dB/);
        const maxMatch = stderr.match(/max_volume: ([-\d.]+) dB/);
        const rmsMatch = stderr.match(/RMS level dB: ([-\d.]+)/);
        const peakMatch = stderr.match(/Peak level dB: ([-\d.]+)/);

        resolve({
          mean: meanMatch ? parseFloat(meanMatch[1]) : null,
          max: maxMatch ? parseFloat(maxMatch[1]) : null,
          rms: rmsMatch ? parseFloat(rmsMatch[1]) : null,
          peak: peakMatch ? parseFloat(peakMatch[1]) : null,
          raw: stderr
        });
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Detect silence periods (indicates pauses between transmissions)
   */
  async detectSilences(audioPath, threshold = -40, duration = 0.3) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', audioPath,
        '-af', `silencedetect=noise=${threshold}dB:d=${duration}`,
        '-f', 'null',
        '-'
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          return reject(new Error(`Silence detection failed with code ${code}`));
        }

        const silences = [];
        const lines = stderr.split('\n');
        let currentSilence = {};

        for (const line of lines) {
          const startMatch = line.match(/silence_start: ([\d.]+)/);
          const endMatch = line.match(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/);

          if (startMatch) {
            currentSilence.start = parseFloat(startMatch[1]);
          }
          if (endMatch && currentSilence.start !== undefined) {
            currentSilence.end = parseFloat(endMatch[1]);
            currentSilence.duration = parseFloat(endMatch[2]);
            silences.push({ ...currentSilence });
            currentSilence = {};
          }
        }

        resolve({
          count: silences.length,
          silences,
          totalSilenceDuration: silences.reduce((sum, s) => sum + s.duration, 0)
        });
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Get basic audio information
   */
  async getAudioInfo(audioPath) {
    return new Promise((resolve, reject) => {
      const args = ['-i', audioPath, '-f', 'null', '-'];
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', () => {
        // Parse duration
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        let duration = 0;
        if (durationMatch) {
          const hours = parseInt(durationMatch[1], 10);
          const minutes = parseInt(durationMatch[2], 10);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        // Parse bitrate
        const bitrateMatch = stderr.match(/bitrate: (\d+) kb\/s/);
        const bitrate = bitrateMatch ? parseInt(bitrateMatch[1], 10) : null;

        // Parse sample rate
        const sampleRateMatch = stderr.match(/(\d+) Hz/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : null;

        resolve({
          duration,
          bitrate,
          sampleRate
        });
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Calculate speech density (ratio of speech to total duration)
   */
  _calculateSpeechDensity(silenceDetection, totalDuration) {
    if (totalDuration === 0) return 0;
    const silenceDuration = silenceDetection.totalSilenceDuration;
    const speechDuration = totalDuration - silenceDuration;
    return speechDuration / totalDuration;
  }

  /**
   * Calculate volume variance (indicates stressed/urgent speech)
   */
  _calculateVolumeVariance(volumeStats) {
    if (!volumeStats.mean || !volumeStats.max) return 0;
    return Math.abs(volumeStats.max - volumeStats.mean);
  }

  /**
   * Detect overlapping transmissions (multiple speakers talking simultaneously)
   * Indicated by high volume variance and low speech clarity
   */
  _detectOverlappingTransmissions(volumeStats, audioInfo) {
    // High variance and high peak levels suggest overlapping speech
    const variance = this._calculateVolumeVariance(volumeStats);
    const isHighVariance = variance > 10; // dB
    const isHighPeak = volumeStats.peak && volumeStats.peak > -3;

    return {
      detected: isHighVariance && isHighPeak,
      confidence: isHighVariance && isHighPeak ? 0.7 : 0.3,
      indicators: {
        highVariance: isHighVariance,
        highPeak: isHighPeak
      }
    };
  }
}

/**
 * @typedef {Object} AudioAnalysisResult
 * @property {number} duration - Audio duration in seconds
 * @property {Object} volume - Volume statistics
 * @property {Object} silence - Silence detection results
 * @property {number} speechDensity - Ratio of speech to total duration (0-1)
 * @property {number} volumeVariance - Volume variance in dB
 * @property {Object} overlappingTransmissions - Overlapping transmission detection
 * @property {Object} metadata - Audio file metadata
 */
