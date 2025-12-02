#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Supabase Upload Script
 * Uploads recordings and segments to Supabase Storage and saves metadata to database
 *
 * Usage:
 *   node upload-to-supabase.js --recording-metadata recording-metadata.json --segment-metadata segment-metadata.json
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    recordingMetadata: null,
    segmentMetadata: null,
    rawFile: null,
    segmentDir: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--recording-metadata' && args[i + 1]) {
      parsed.recordingMetadata = args[i + 1];
      i++;
    } else if (args[i] === '--segment-metadata' && args[i + 1]) {
      parsed.segmentMetadata = args[i + 1];
      i++;
    } else if (args[i] === '--raw-file' && args[i + 1]) {
      parsed.rawFile = args[i + 1];
      i++;
    } else if (args[i] === '--segment-dir' && args[i + 1]) {
      parsed.segmentDir = args[i + 1];
      i++;
    }
  }

  return parsed;
}

function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', filePath,
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
        resolve(0);
      }
    });

    ffmpeg.on('error', () => resolve(0));
  });
}

async function uploadToStorage(supabase, bucket, filePath, storagePath) {
  const fileBuffer = await fs.readFile(filePath);
  const stats = await fs.stat(filePath);

  console.log(`  Uploading ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: 'audio/mpeg',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
}

async function insertRecording(supabase, metadata) {
  console.log('Inserting recording metadata...');

  const { data, error } = await supabase
    .from('recordings')
    .insert({
      airport: metadata.airport,
      facility: metadata.facility,
      recorded_at: metadata.recordedAt,
      duration_seconds: metadata.duration,
      source_url: metadata.url,
      raw_file_path: metadata.rawFilePath,
      status: 'processing'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert recording: ${error.message}`);
  }

  console.log(`  Recording ID: ${data.id}`);
  return data;
}

async function insertSegment(supabase, recordingId, segmentData) {
  const { data, error } = await supabase
    .from('segments')
    .insert({
      recording_id: recordingId,
      segment_index: segmentData.index,
      file_path: segmentData.storagePath,
      duration_seconds: segmentData.duration,
      start_time_in_recording: segmentData.startTime,
      file_size_bytes: segmentData.fileSize,
      audio_quality_score: segmentData.qualityScore,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert segment: ${error.message}`);
  }

  return data;
}

async function updateRecordingStatus(supabase, recordingId, status) {
  const { error } = await supabase
    .from('recordings')
    .update({ status })
    .eq('id', recordingId);

  if (error) {
    throw new Error(`Failed to update recording status: ${error.message}`);
  }
}

async function uploadRecording(supabase, recordingMeta, rawFile) {
  console.log('\n=== Uploading Recording ===');

  // Generate storage path
  const date = new Date(recordingMeta.recordedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const filename = path.basename(rawFile);

  const storagePath = `${recordingMeta.airport.toLowerCase()}_${recordingMeta.facility}/${year}/${month}/${day}/${filename}`;

  // Upload raw file to storage
  await uploadToStorage(supabase, 'liveatc-raw', rawFile, storagePath);

  // Insert recording metadata
  const recording = await insertRecording(supabase, {
    ...recordingMeta,
    rawFilePath: storagePath
  });

  return recording;
}

async function uploadSegments(supabase, recordingId, segmentMeta, segmentDir) {
  console.log('\n=== Uploading Segments ===');

  const segments = segmentMeta.segments;
  const uploadedSegments = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentPath = path.join(segmentDir, segment.filename);

    // Generate storage path based on recording location
    const recordingDirName = path.basename(segmentDir);
    const storagePath = `${recordingDirName}/${segment.filename}`;

    // Upload segment file
    process.stdout.write(`\r  Uploading segment ${i + 1}/${segments.length}...`);

    try {
      await uploadToStorage(supabase, 'liveatc-segments', segmentPath, storagePath);

      // Insert segment metadata
      const insertedSegment = await insertSegment(supabase, recordingId, {
        ...segment,
        storagePath
      });

      uploadedSegments.push(insertedSegment);
    } catch (error) {
      console.error(`\nFailed to upload segment ${i + 1}: ${error.message}`);
      // Continue with other segments
    }
  }

  console.log(`\n  Uploaded ${uploadedSegments.length}/${segments.length} segments`);
  return uploadedSegments;
}

async function main() {
  const args = parseArgs();

  if ((!args.recordingMetadata || !args.segmentMetadata) && (!args.rawFile || !args.segmentDir)) {
    console.error('Usage:');
    console.error('  node upload-to-supabase.js --recording-metadata recording.json --segment-metadata segments.json');
    console.error('  node upload-to-supabase.js --raw-file path/to/raw.mp3 --segment-dir path/to/segments/');
    process.exit(1);
  }

  try {
    const supabase = initSupabase();
    console.log('Connected to Supabase');

    let recordingMeta, segmentMeta, rawFile, segmentDir;

    if (args.recordingMetadata && args.segmentMetadata) {
      // Load from JSON files
      recordingMeta = JSON.parse(await fs.readFile(args.recordingMetadata, 'utf8'));
      segmentMeta = JSON.parse(await fs.readFile(args.segmentMetadata, 'utf8'));
      rawFile = recordingMeta.outputPath;
      segmentDir = segmentMeta.outputDir;
    } else {
      // Infer from file paths
      rawFile = args.rawFile;
      segmentDir = args.segmentDir;

      // Parse metadata from filenames
      const basename = path.basename(rawFile, path.extname(rawFile));
      const parts = basename.split('_');

      if (parts.length < 4) {
        throw new Error('Invalid filename format. Expected: airport_facility_timestamp.mp3');
      }

      // Get actual audio duration
      const audioDuration = await getAudioDuration(rawFile);

      recordingMeta = {
        airport: parts[0].toUpperCase(),
        facility: parts[1],
        recordedAt: new Date().toISOString(),
        duration: audioDuration,
        url: 'unknown'
      };

      // Load segment metadata if available
      const segmentMetaPath = path.join(segmentDir, 'metadata.json');
      try {
        segmentMeta = JSON.parse(await fs.readFile(segmentMetaPath, 'utf8'));
      } catch {
        // List segment files manually
        const files = await fs.readdir(segmentDir);
        const segmentFiles = files.filter(f => f.endsWith('.mp3')).sort();

        segmentMeta = {
          outputDir: segmentDir,
          segmentCount: segmentFiles.length,
          segments: segmentFiles.map((f, i) => ({
            index: i,
            filename: f,
            path: path.join(segmentDir, f),
            startTime: 0,
            duration: 0,
            fileSize: 0,
            qualityScore: 0.5
          }))
        };
      }
    }

    // Upload recording
    const recording = await uploadRecording(supabase, recordingMeta, rawFile);

    // Upload segments
    const segments = await uploadSegments(supabase, recording.id, segmentMeta, segmentDir);

    // Update recording status to 'segmented'
    await updateRecordingStatus(supabase, recording.id, 'segmented');

    console.log('\n=== Upload Complete ===');
    console.log(`Recording ID: ${recording.id}`);
    console.log(`Segments uploaded: ${segments.length}`);
    console.log(`Status: segmented`);

    process.exit(0);
  } catch (error) {
    console.error('\nUpload failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
