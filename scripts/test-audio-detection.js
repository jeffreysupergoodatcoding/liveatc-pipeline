#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testSegment(segmentId) {
  console.log('Fetching segment from database...');

  const { data: segment, error } = await supabase
    .from('segments')
    .select('*')
    .eq('id', segmentId)
    .single();

  if (error) {
    console.error('Error fetching segment:', error);
    return;
  }

  console.log(`\nSegment: ${segment.id}`);
  console.log(`Duration: ${segment.duration_seconds}s`);
  console.log(`File: ${segment.file_path}`);

  // Download segment
  console.log('\nDownloading segment...');
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('liveatc-segments')
    .download(segment.file_path);

  if (downloadError) {
    console.error('Download error:', downloadError);
    return;
  }

  // Save to temp file
  const tempPath = path.join(os.tmpdir(), `test_segment_${segment.id}.mp3`);
  const buffer = Buffer.from(await fileData.arrayBuffer());
  await fs.writeFile(tempPath, buffer);

  // Run audio analyzer with detailed output
  console.log('\n' + '='.repeat(80));
  console.log('RUNNING AUDIO ANALYSIS');
  console.log('='.repeat(80));

  const analyzerPath = path.join(__dirname, '..', 'backend', 'services', 'python', 'audio_analyzer.py');

  try {
    const { stdout } = await execPromise(`python3 "${analyzerPath}" "${tempPath}" 0.65`);
    const result = JSON.parse(stdout);

    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('='.repeat(80));
    console.log(`  Final Score: ${result.score} ${result.score >= 0.65 ? '✅ FLAGGED' : '❌ NOT FLAGGED'}`);
    console.log(`  Threshold: ${result.threshold}`);
    console.log(`  Should Transcribe: ${result.should_transcribe}`);
    console.log('\n  Detected Patterns:');
    if (result.patterns && result.patterns.length > 0) {
      result.patterns.forEach(p => console.log(`    - ${p}`));
    } else {
      console.log('    (none)');
    }

    console.log('\n  🔍 Feature Breakdown:');
    console.log('  ' + '-'.repeat(78));
    if (result.features) {
      console.log(`    Duration:           ${result.features.duration?.toFixed(2)}s`);
      console.log(`    Max Amplitude:      ${result.features.max_amplitude?.toFixed(4)}`);
      console.log(`    Volume Variance:    ${result.features.volume_variance?.toFixed(4)}`);
      console.log(`    Tempo:              ${result.features.tempo?.toFixed(1)} BPM`);
      console.log(`    Silence Ratio:      ${result.features.silence_ratio?.toFixed(4)}`);
      console.log(`    SNR:                ${result.features.snr?.toFixed(4)}`);
      console.log(`    Energy Variance:    ${result.features.energy_variance?.toFixed(4)}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('DETAILED SCORE BREAKDOWN:');
    console.log('='.repeat(80));
    console.log('Each detection component contributes to the final score:');
    console.log('  - Duration check: 0.3-0.4 if anomalous');
    console.log('  - Volume spikes:  0.35-0.4 if detected');
    console.log('  - Speech rate:    0.15-0.25 if abnormal');
    console.log('  - Silence:        0.2-0.25 if unusual');
    console.log('  - SNR:            0.35-0.55 if poor');
    console.log('  - Energy variance: 0.3-0.45 if chaotic');
    console.log('\nScores are ADDITIVE - multiple patterns increase total score');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Analysis error:', error.message);
    console.error('stderr:', error.stderr);
  }

  // Clean up
  await fs.unlink(tempPath).catch(() => {});
}

// Get segment ID from command line
const segmentId = process.argv[2];

if (!segmentId) {
  console.log('Usage: node test-audio-detection.js <segment-id>');
  console.log('\nTo find segment IDs, check your database or use:');
  console.log('  SELECT id, duration_seconds FROM segments ORDER BY created_at DESC LIMIT 5;');
  process.exit(1);
}

testSegment(segmentId);
