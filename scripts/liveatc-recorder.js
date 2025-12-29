#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * LiveATC Audio Recorder
 * Records audio streams from LiveATC feeds using ffmpeg
 *
 * Usage:
 *   node liveatc-recorder.js --feed kjfk_gnd --duration 600
 *   node liveatc-recorder.js --airport KJFK --facility ground --url http://d.liveatc.net/kjfk_gnd --duration 60
 */

const FEED_CONFIGS = {
  // JFK - New York
  kjfk_twr2: {
    airport: 'KJFK',
    facility: 'tower2',
    url: 'http://d.liveatc.net/kjfk_twr3'
  },
  kjfk_twr: {
    airport: 'KJFK',
    facility: 'tower',
    url: 'http://d.liveatc.net/kjfk_twr'
  },
  kjfk_gnd: {
    airport: 'KJFK',
    facility: 'ground',
    url: 'http://d.liveatc.net/kjfk_gnd'
  },

  // Houston Hobby (KHOU)
  khou_gnd_twr_app: {
    airport: 'KHOU',
    facility: 'gnd_twr_app',
    url: 'http://d.liveatc.net/khou'
  },

  // Houston George Bush Intercontinental (KIAH)
  kiah_twr: {
    airport: 'KIAH',
    facility: 'tower',
    url: 'http://d.liveatc.net/kiah1_1'
  },
  kiah_gnd_n: {
    airport: 'KIAH',
    facility: 'gnd_north',
    url: 'http://d.liveatc.net/kiah2_gnd_n'
  },
  kiah_gnd_s: {
    airport: 'KIAH',
    facility: 'gnd_south',
    url: 'http://d.liveatc.net/kiah2_gnd_s'
  },
  kiah_gnd_w: {
    airport: 'KIAH',
    facility: 'gnd_west',
    url: 'http://d.liveatc.net/kiah2_gnd_w'
  },
  kiah_app: {
    airport: 'KIAH',
    facility: 'approach',
    url: 'http://d.liveatc.net/kiah1_2'
  },

  // San Francisco (KSFO)
  ksfo_gnd: {
    airport: 'KSFO',
    facility: 'ground',
    url: 'http://d.liveatc.net/ksfo_gnd'
  },
  ksfo_twr: {
    airport: 'KSFO',
    facility: 'tower',
    url: 'http://d.liveatc.net/ksfo_twr'
  },
  ksfo_gnd_twr: {
    airport: 'KSFO',
    facility: 'gnd_twr',
    url: 'http://d.liveatc.net/ksfo_gnd_twr'
  },
  ksfo_dep1: {
    airport: 'KSFO',
    facility: 'departure',
    url: 'http://d.liveatc.net/ksfo_dep1'
  },

  // Austin (KAUS)
  kaus_gnd: {
    airport: 'KAUS',
    facility: 'ground',
    url: 'http://d.liveatc.net/kaus3_gnd'
  },
  kaus_twr: {
    airport: 'KAUS',
    facility: 'tower',
    url: 'http://d.liveatc.net/kaus3_twr'
  },
  kaus_app_dep: {
    airport: 'KAUS',
    facility: 'app_dep',
    url: 'http://d.liveatc.net/kaus3_app_dep'
  },

  // Newark (KEWR)
  kewr_gnd: {
    airport: 'KEWR',
    facility: 'ground',
    url: 'http://d.liveatc.net/kewr_gnd_pri'
  },
  kewr_twr: {
    airport: 'KEWR',
    facility: 'tower',
    url: 'http://d.liveatc.net/kewr_twr'
  },
  kewr_app_final: {
    airport: 'KEWR',
    facility: 'app_final',
    url: 'http://d.liveatc.net/kewr_app_final'
  },
  kewr_dep: {
    airport: 'KEWR',
    facility: 'departure',
    url: 'http://d.liveatc.net/kewr_dep'
  },

  // LaGuardia (KLGA)
  klga_gnd: {
    airport: 'KLGA',
    facility: 'ground',
    url: 'http://d.liveatc.net/klga_gnd'
  },
  klga_twr: {
    airport: 'KLGA',
    facility: 'tower',
    url: 'http://d.liveatc.net/klga_twr'
  },
  klga_ny_app: {
    airport: 'KLGA',
    facility: 'approach',
    url: 'http://d.liveatc.net/klga_ny_app'
  },
  klga_ny_dep: {
    airport: 'KLGA',
    facility: 'departure',
    url: 'http://d.liveatc.net/klga_ny_dep'
  }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    duration: 600, // default 10 minutes
    feed: null,
    airport: null,
    facility: null,
    url: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feed' && args[i + 1]) {
      parsed.feed = args[i + 1];
      i++;
    } else if (args[i] === '--duration' && args[i + 1]) {
      parsed.duration = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--airport' && args[i + 1]) {
      parsed.airport = args[i + 1];
      i++;
    } else if (args[i] === '--facility' && args[i + 1]) {
      parsed.facility = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      parsed.url = args[i + 1];
      i++;
    }
  }

  return parsed;
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hour}${minute}${second}`;
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

async function recordStream(config, duration) {
  const { airport, facility, url } = config;
  const timestamp = getTimestamp();

  // Use abbreviated facility name (ground -> gnd, tower -> twr, etc.)
  const facilityAbbrev = facility === 'ground' ? 'gnd' :
    facility === 'tower' ? 'twr' :
      facility === 'tower2' ? 'twr2' :
        facility === 'approach' ? 'app' :
          facility === 'departure' ? 'dep' :
            facility === 'gnd_twr' ? 'gnd_twr' :
              facility === 'gnd_twr_app' ? 'gnd_twr_app' :
                facility === 'app_dep' ? 'app_dep' :
                  facility === 'app_final' ? 'app_final' :
                    facility === 'gnd_north' ? 'gnd_n' :
                      facility === 'gnd_south' ? 'gnd_s' :
                        facility === 'gnd_west' ? 'gnd_w' :
                          facility.substring(0, 3);

  const filename = `${airport.toLowerCase()}_${facilityAbbrev}_${timestamp}.mp3`;

  const outputDir = path.join(__dirname, '..', 'recordings', 'raw');
  await ensureDirectory(outputDir);

  const outputPath = path.join(outputDir, filename);

  console.log(`Starting recording...`);
  console.log(`  Airport: ${airport}`);
  console.log(`  Facility: ${facility}`);
  console.log(`  URL: ${url}`);
  console.log(`  Duration: ${duration}s`);
  console.log(`  Output: ${outputPath}`);

  return new Promise((resolve, reject) => {
    // ffmpeg command to record stream
    // -t: duration in seconds
    // -i: input URL
    // -acodec: audio codec (libmp3lame for MP3)
    // -ab: audio bitrate
    // -ar: audio sample rate
    const args = [
      '-t', duration.toString(),
      '-i', url,
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-ar', '22050',
      '-y', // overwrite output file if exists
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg outputs progress to stderr
      const output = data.toString();
      errorOutput += output;

      // Show progress
      if (output.includes('time=')) {
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          const progress = ((totalSeconds / duration) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${progress}% (${totalSeconds}/${duration}s)`);
        }
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(''); // New line after progress

      if (code === 0) {
        console.log(`Recording completed successfully!`);
        resolve({
          success: true,
          outputPath,
          filename,
          airport,
          facility,
          url,
          duration,
          recordedAt: new Date()
        });
      } else {
        console.error(`Recording failed with code ${code}`);
        console.error('Error output:', errorOutput.slice(-500)); // Last 500 chars
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error(`Failed to start ffmpeg:`, error.message);
      reject(error);
    });
  });
}

async function main() {
  const args = parseArgs();

  let config;

  if (args.feed) {
    config = FEED_CONFIGS[args.feed];
    if (!config) {
      console.error(`Unknown feed: ${args.feed}`);
      console.error(`Available feeds: ${Object.keys(FEED_CONFIGS).join(', ')}`);
      process.exit(1);
    }
  } else if (args.airport && args.facility && args.url) {
    config = {
      airport: args.airport,
      facility: args.facility,
      url: args.url
    };
  } else {
    console.error('Usage:');
    console.error('  node liveatc-recorder.js --feed kjfk_gnd --duration 600');
    console.error('  node liveatc-recorder.js --airport KJFK --facility ground --url http://d.liveatc.net/kjfk_gnd --duration 60');
    console.error('');
    console.error('Available feeds:', Object.keys(FEED_CONFIGS).join(', '));
    process.exit(1);
  }

  try {
    const result = await recordStream(config, args.duration);

    // Output metadata as JSON for use in pipeline
    console.log('\nMetadata:');
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Recording failed:', error.message);
    process.exit(1);
  }
}

main();
