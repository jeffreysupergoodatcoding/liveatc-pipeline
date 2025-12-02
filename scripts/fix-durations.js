#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY
);

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

async function fixDurations() {
  console.log('Fetching recordings with duration 0...\n');

  const { data: recordings, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('duration_seconds', 0);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`Found ${recordings.length} recording(s) to fix\n`);

  for (const rec of recordings) {
    console.log(`Processing: ${rec.raw_file_path}`);

    // Try to find the local file
    const localPath = path.join(__dirname, '..', 'recordings', 'raw', path.basename(rec.raw_file_path));

    try {
      await fs.access(localPath);
      const duration = await getAudioDuration(localPath);

      console.log(`  Duration: ${duration.toFixed(2)}s`);

      // Update in database
      const { error: updateError } = await supabase
        .from('recordings')
        .update({ duration_seconds: duration })
        .eq('id', rec.id);

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`);
      } else {
        console.log(`  ✓ Updated in database`);
      }
    } catch (err) {
      console.log(`  ✗ File not found locally: ${localPath}`);
    }

    console.log('');
  }

  console.log('Done!');
}

fixDurations();
