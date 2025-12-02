#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Audio Segmentation Script
 * Splits audio recordings into individual transmissions based on silence detection
 *
 * Usage:
 *   node segment-audio.js --input recordings/raw/kjfk_gnd_20250118_143000.mp3
 *   node segment-audio.js --input path/to/recording.mp3 --min-duration 2 --max-duration 20
 */

const DEFAULT_CONFIG = {
  silenceThreshold: -40,      // dB
  silenceDuration: 0.5,       // seconds
  minSegmentDuration: 2,      // seconds
  maxSegmentDuration: 20      // seconds
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    input: null,
    silenceThreshold: DEFAULT_CONFIG.silenceThreshold,
    silenceDuration: DEFAULT_CONFIG.silenceDuration,
    minDuration: DEFAULT_CONFIG.minSegmentDuration,
    maxDuration: DEFAULT_CONFIG.maxSegmentDuration
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      parsed.input = args[i + 1];
      i++;
    } else if (args[i] === '--silence-threshold' && args[i + 1]) {
      parsed.silenceThreshold = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--silence-duration' && args[i + 1]) {
      parsed.silenceDuration = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--min-duration' && args[i + 1]) {
      parsed.minDuration = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--max-duration' && args[i + 1]) {
      parsed.maxDuration = parseFloat(args[i + 1]);
      i++;
    }
  }

  return parsed;
}

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function detectSilences(inputPath, config) {
  console.log('Detecting silence periods...');

  return new Promise((resolve, reject) => {
    // Use ffmpeg silencedetect filter to find silence periods
    const args = [
      '-i', inputPath,
      '-af', `silencedetect=noise=${config.silenceThreshold}dB:d=${config.silenceDuration}`,
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
        // ffmpeg returns 1 for some non-critical issues
        reject(new Error(`ffmpeg silencedetect failed with code ${code}`));
        return;
      }

      // Parse silence periods from stderr
      const silences = [];
      const lines = stderr.split('\n');

      let currentSilence = {};

      for (const line of lines) {
        const startMatch = line.match(/silence_start: ([\d.]+)/);
        const endMatch = line.match(/silence_end: ([\d.]+)/);

        if (startMatch) {
          currentSilence.start = parseFloat(startMatch[1]);
        }
        if (endMatch && currentSilence.start !== undefined) {
          currentSilence.end = parseFloat(endMatch[1]);
          silences.push({ ...currentSilence });
          currentSilence = {};
        }
      }

      console.log(`  Found ${silences.length} silence periods`);
      resolve(silences);
    });

    ffmpeg.on('error', reject);
  });
}

function calculateSegments(silences, totalDuration, config) {
  console.log('Calculating segment boundaries...');

  const segments = [];
  let lastEnd = 0;

  for (const silence of silences) {
    const segmentStart = lastEnd;
    const segmentEnd = silence.start;
    const duration = segmentEnd - segmentStart;

    // Only include segments within duration constraints
    if (duration >= config.minDuration && duration <= config.maxDuration) {
      segments.push({
        start: segmentStart,
        end: segmentEnd,
        duration: duration
      });
    }

    lastEnd = silence.end;
  }

  // Add final segment if there's audio at the end
  const finalDuration = totalDuration - lastEnd;
  if (finalDuration >= config.minDuration && finalDuration <= config.maxDuration) {
    segments.push({
      start: lastEnd,
      end: totalDuration,
      duration: finalDuration
    });
  }

  console.log(`  Created ${segments.length} segments`);
  return segments;
}

async function getTotalDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-f', 'null',
      '-'
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', () => {
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        resolve(totalSeconds);
      } else {
        reject(new Error('Could not determine duration'));
      }
    });

    ffmpeg.on('error', reject);
  });
}

async function extractSegment(inputPath, outputPath, segment, index, total) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', segment.start.toString(),
      '-t', segment.duration.toString(),
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-ar', '22050',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });

    process.stdout.write(`\r  Extracting segment ${index + 1}/${total}...`);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg segment extraction failed with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

async function getAudioQualityScore(segmentPath) {
  return new Promise((resolve, reject) => {
    // Use ffmpeg volumedetect to get audio statistics
    const args = [
      '-i', segmentPath,
      '-af', 'volumedetect',
      '-f', 'null',
      '-'
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', () => {
      // Extract mean volume
      const meanMatch = stderr.match(/mean_volume: ([-\d.]+) dB/);

      if (meanMatch) {
        const meanVolume = parseFloat(meanMatch[1]);

        // Convert mean volume to quality score (0-1)
        // Assume -60dB is noise (score 0) and -20dB is good (score 1)
        const score = Math.max(0, Math.min(1, (meanVolume + 60) / 40));

        resolve(score);
      } else {
        resolve(0.5); // Default middle score if can't determine
      }
    });

    ffmpeg.on('error', () => resolve(0.5));
  });
}

async function segmentAudio(inputPath, config) {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.join(path.dirname(path.dirname(inputPath)), 'segments', basename);

  await ensureDirectory(outputDir);

  console.log(`Segmenting: ${inputPath}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Configuration:`, config);

  // Get total duration
  const totalDuration = await getTotalDuration(inputPath);
  console.log(`Total duration: ${totalDuration.toFixed(2)}s`);

  // Detect silences
  const silences = await detectSilences(inputPath, config);

  // Calculate segment boundaries
  const segments = calculateSegments(silences, totalDuration, config);

  if (segments.length === 0) {
    console.log('No valid segments found');
    return {
      success: true,
      inputPath,
      outputDir,
      segmentCount: 0,
      segments: []
    };
  }

  // Extract each segment
  console.log('Extracting segments...');
  const segmentMetadata = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentFilename = `seg_${String(i + 1).padStart(3, '0')}.mp3`;
    const segmentPath = path.join(outputDir, segmentFilename);

    await extractSegment(inputPath, segmentPath, segment, i, segments.length);

    // Get file size and quality score
    const stats = await fs.stat(segmentPath);
    const qualityScore = await getAudioQualityScore(segmentPath);

    segmentMetadata.push({
      index: i,
      filename: segmentFilename,
      path: segmentPath,
      startTime: segment.start,
      duration: segment.duration,
      fileSize: stats.size,
      qualityScore: qualityScore
    });
  }

  console.log(`\n\nSegmentation complete!`);
  console.log(`  Total segments: ${segmentMetadata.length}`);
  console.log(`  Total duration: ${segmentMetadata.reduce((sum, s) => sum + s.duration, 0).toFixed(2)}s`);
  console.log(`  Average quality: ${(segmentMetadata.reduce((sum, s) => sum + s.qualityScore, 0) / segmentMetadata.length).toFixed(2)}`);

  return {
    success: true,
    inputPath,
    outputDir,
    segmentCount: segmentMetadata.length,
    segments: segmentMetadata
  };
}

async function main() {
  const args = parseArgs();

  if (!args.input) {
    console.error('Usage: node segment-audio.js --input path/to/recording.mp3');
    console.error('');
    console.error('Options:');
    console.error('  --input <path>              Path to input audio file (required)');
    console.error('  --silence-threshold <dB>    Silence threshold in dB (default: -40)');
    console.error('  --silence-duration <sec>    Minimum silence duration (default: 0.5)');
    console.error('  --min-duration <sec>        Minimum segment duration (default: 2)');
    console.error('  --max-duration <sec>        Maximum segment duration (default: 20)');
    process.exit(1);
  }

  try {
    const config = {
      silenceThreshold: args.silenceThreshold,
      silenceDuration: args.silenceDuration,
      minDuration: args.minDuration,
      maxDuration: args.maxDuration
    };

    const result = await segmentAudio(args.input, config);

    // Output metadata as JSON for use in pipeline
    console.log('\nMetadata:');
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Segmentation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
