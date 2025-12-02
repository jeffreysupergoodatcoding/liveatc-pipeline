#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cron from 'node-cron';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Scheduled Pipeline Script
 * Orchestrates the complete pipeline: record → segment → upload
 * Runs on a cron schedule or can be triggered manually
 *
 * Usage:
 *   node scheduled-pipeline.js --once              # Run once and exit
 *   node scheduled-pipeline.js --schedule          # Run on schedule (default)
 *   node scheduled-pipeline.js --feed kjfk_gnd     # Run once for specific feed
 */

const FEEDS = JSON.parse(process.env.LIVEATC_FEEDS || '[]');
const RECORDING_DURATION = parseInt(process.env.RECORDING_DURATION || '600', 10);
const SCHEDULE = process.env.RECORDING_SCHEDULE || '0 * * * *'; // Every hour

const LOG_DIR = path.join(__dirname, '..', 'logs');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    mode: 'schedule',
    feed: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--once') {
      parsed.mode = 'once';
    } else if (args[i] === '--schedule') {
      parsed.mode = 'schedule';
    } else if (args[i] === '--feed' && args[i + 1]) {
      parsed.feed = args[i + 1];
      parsed.mode = 'once';
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

function runScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function runScriptWithOutput(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

function parseMetadataFromOutput(output) {
  // Find JSON metadata in output
  const lines = output.split('\n');
  let jsonStart = -1;
  let jsonEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'Metadata:') {
      jsonStart = i + 1;
    }
    if (jsonStart !== -1 && lines[i].trim() === '}') {
      // Count braces to find matching closing brace
      const jsonSoFar = lines.slice(jsonStart, i + 1).join('\n');
      const openBraces = (jsonSoFar.match(/\{/g) || []).length;
      const closeBraces = (jsonSoFar.match(/\}/g) || []).length;

      if (openBraces === closeBraces) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  if (jsonStart !== -1 && jsonEnd !== -1) {
    const jsonStr = lines.slice(jsonStart, jsonEnd).join('\n');
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  return null;
}

async function processFeed(feed) {
  const startTime = Date.now();
  const logEntry = {
    feed,
    startTime: new Date().toISOString(),
    status: 'started',
    steps: {}
  };

  console.log('\n' + '='.repeat(60));
  console.log(`Processing feed: ${feed.airport} ${feed.facility}`);
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Record
    console.log('STEP 1: Recording...');
    logEntry.steps.record = { status: 'started', startTime: Date.now() };

    const recorderScript = path.join(__dirname, 'liveatc-recorder.js');
    const recordOutput = await runScriptWithOutput(recorderScript, [
      '--airport', feed.airport,
      '--facility', feed.facility,
      '--url', feed.url,
      '--duration', RECORDING_DURATION.toString()
    ]);

    const recordMetadata = parseMetadataFromOutput(recordOutput.stdout);
    if (!recordMetadata) {
      throw new Error('Failed to parse recording metadata');
    }

    logEntry.steps.record = {
      status: 'success',
      duration: Date.now() - logEntry.steps.record.startTime,
      outputPath: recordMetadata.outputPath
    };

    // Step 2: Segment
    console.log('\nSTEP 2: Segmenting...');
    logEntry.steps.segment = { status: 'started', startTime: Date.now() };

    const segmentScript = path.join(__dirname, 'segment-audio.js');
    const segmentOutput = await runScriptWithOutput(segmentScript, [
      '--input', recordMetadata.outputPath
    ]);

    const segmentMetadata = parseMetadataFromOutput(segmentOutput.stdout);
    if (!segmentMetadata) {
      throw new Error('Failed to parse segment metadata');
    }

    logEntry.steps.segment = {
      status: 'success',
      duration: Date.now() - logEntry.steps.segment.startTime,
      segmentCount: segmentMetadata.segmentCount,
      outputDir: segmentMetadata.outputDir
    };

    // Step 3: Upload
    console.log('\nSTEP 3: Uploading to Supabase...');
    logEntry.steps.upload = { status: 'started', startTime: Date.now() };

    const uploadScript = path.join(__dirname, 'upload-to-supabase.js');

    // Save metadata to temp files
    const tempDir = path.join(__dirname, '..', 'temp');
    await ensureDirectory(tempDir);

    const recordMetaPath = path.join(tempDir, `record_${Date.now()}.json`);
    const segmentMetaPath = path.join(tempDir, `segment_${Date.now()}.json`);

    await fs.writeFile(recordMetaPath, JSON.stringify(recordMetadata, null, 2));
    await fs.writeFile(segmentMetaPath, JSON.stringify(segmentMetadata, null, 2));

    await runScript(uploadScript, [
      '--recording-metadata', recordMetaPath,
      '--segment-metadata', segmentMetaPath
    ]);

    // Clean up temp files
    await fs.unlink(recordMetaPath);
    await fs.unlink(segmentMetaPath);

    logEntry.steps.upload = {
      status: 'success',
      duration: Date.now() - logEntry.steps.upload.startTime
    };

    // Complete
    logEntry.status = 'success';
    logEntry.totalDuration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('PIPELINE COMPLETE');
    console.log(`Total time: ${(logEntry.totalDuration / 1000).toFixed(2)}s`);
    console.log('='.repeat(60) + '\n');

    return logEntry;

  } catch (error) {
    logEntry.status = 'error';
    logEntry.error = error.message;
    logEntry.totalDuration = Date.now() - startTime;

    console.error('\n' + '='.repeat(60));
    console.error('PIPELINE FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Total time: ${(logEntry.totalDuration / 1000).toFixed(2)}s`);
    console.error('='.repeat(60) + '\n');

    return logEntry;
  }
}

async function processAllFeeds() {
  console.log(`Processing ${FEEDS.length} feeds...`);

  const results = [];

  for (const feed of FEEDS) {
    const result = await processFeed(feed);
    results.push(result);

    // Stagger feeds to avoid overload
    if (feed !== FEEDS[FEEDS.length - 1]) {
      console.log('Waiting 30 seconds before next feed...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  return results;
}

async function writeLog(results) {
  await ensureDirectory(LOG_DIR);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(LOG_DIR, `pipeline_${timestamp}.json`);

  await fs.writeFile(logPath, JSON.stringify(results, null, 2));
  console.log(`Log written to: ${logPath}`);
}

async function runOnce(feedName) {
  let feeds = FEEDS;

  if (feedName) {
    const feed = FEEDS.find(f =>
      `${f.airport.toLowerCase()}_${f.facility}` === feedName.toLowerCase()
    );

    if (!feed) {
      console.error(`Feed not found: ${feedName}`);
      console.error(`Available feeds: ${FEEDS.map(f => `${f.airport.toLowerCase()}_${f.facility}`).join(', ')}`);
      process.exit(1);
    }

    feeds = [feed];
  }

  const results = [];
  for (const feed of feeds) {
    const result = await processFeed(feed);
    results.push(result);
  }

  await writeLog(results);

  const hasErrors = results.some(r => r.status === 'error');
  process.exit(hasErrors ? 1 : 0);
}

async function runScheduled() {
  console.log('Starting scheduled pipeline...');
  console.log(`Schedule: ${SCHEDULE}`);
  console.log(`Feeds: ${FEEDS.map(f => `${f.airport} ${f.facility}`).join(', ')}`);
  console.log('Press Ctrl+C to stop\n');

  // Validate cron expression
  if (!cron.validate(SCHEDULE)) {
    console.error(`Invalid cron expression: ${SCHEDULE}`);
    process.exit(1);
  }

  // Schedule the task
  cron.schedule(SCHEDULE, async () => {
    console.log(`\n[${new Date().toISOString()}] Scheduled run triggered`);

    try {
      const results = await processAllFeeds();
      await writeLog(results);

      const successCount = results.filter(r => r.status === 'success').length;
      console.log(`\nRun complete: ${successCount}/${results.length} feeds succeeded`);
    } catch (error) {
      console.error('Scheduled run failed:', error.message);
    }
  });

  // Keep process running
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

async function main() {
  const args = parseArgs();

  if (FEEDS.length === 0) {
    console.error('No feeds configured. Set LIVEATC_FEEDS environment variable.');
    console.error('Example:');
    console.error('LIVEATC_FEEDS=\'[{"airport":"KJFK","facility":"ground","url":"http://d.liveatc.net/kjfk_gnd"}]\'');
    process.exit(1);
  }

  if (args.mode === 'once') {
    await runOnce(args.feed);
  } else {
    await runScheduled();
  }
}

main();
