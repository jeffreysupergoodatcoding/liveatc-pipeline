import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseServer } from '../../../lib/supabase-server.js';
import { logger } from '../../../lib/logger.js';

/**
 * Available feed configurations (matches liveatc-recorder.js)
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

// Track active recording processes
const activeRecordings = new Map();

/**
 * GET /api/record
 * Get available feeds and any active recording sessions
 */
export async function GET() {
    try {
        // Group feeds by airport
        const airports = {};
        for (const [feedId, config] of Object.entries(FEED_CONFIGS)) {
            if (!airports[config.airport]) {
                airports[config.airport] = {
                    code: config.airport,
                    feeds: []
                };
            }
            airports[config.airport].feeds.push({
                id: feedId,
                facility: config.facility,
                url: config.url
            });
        }

        // Get active recordings
        const active = [];
        for (const [id, recording] of activeRecordings) {
            active.push({
                id,
                feed: recording.feed,
                airport: recording.airport,
                facility: recording.facility,
                duration: recording.duration,
                startedAt: recording.startedAt,
                progress: recording.progress || 0
            });
        }

        return NextResponse.json({
            airports: Object.values(airports),
            activeRecordings: active,
            feedCount: Object.keys(FEED_CONFIGS).length
        });
    } catch (error) {
        logger.error('Error getting feeds:', error);
        return NextResponse.json(
            { error: 'Failed to get feeds' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/record
 * Start a new recording session
 */
export async function POST(request) {
    try {
        const { feedId, duration } = await request.json();

        if (!feedId || !FEED_CONFIGS[feedId]) {
            return NextResponse.json(
                { error: 'Invalid feed ID' },
                { status: 400 }
            );
        }

        const durationSeconds = parseInt(duration) || 600; // Default 10 minutes
        if (durationSeconds < 30 || durationSeconds > 3600) {
            return NextResponse.json(
                { error: 'Duration must be between 30 seconds and 1 hour' },
                { status: 400 }
            );
        }

        const config = FEED_CONFIGS[feedId];
        const recordingId = `${feedId}_${Date.now()}`;

        // Check if already recording this feed
        for (const [, recording] of activeRecordings) {
            if (recording.feed === feedId) {
                return NextResponse.json(
                    { error: 'Already recording from this feed' },
                    { status: 400 }
                );
            }
        }

        logger.info(`Starting recording: ${feedId} for ${durationSeconds}s`);

        // Start the recording using the liveatc-recorder.js script
        const scriptsDir = path.join(process.cwd(), 'scripts');
        const recorderScript = path.join(scriptsDir, 'liveatc-recorder.js');

        const ffmpegProcess = spawn('node', [
            recorderScript,
            '--feed', feedId,
            '--duration', durationSeconds.toString()
        ], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Track the recording
        const recording = {
            process: ffmpegProcess,
            feed: feedId,
            airport: config.airport,
            facility: config.facility,
            duration: durationSeconds,
            startedAt: new Date().toISOString(),
            progress: 0
        };
        activeRecordings.set(recordingId, recording);

        // Monitor progress from stderr
        ffmpegProcess.stderr.on('data', (data) => {
            const output = data.toString();
            const progressMatch = output.match(/Progress: ([\d.]+)%/);
            if (progressMatch) {
                recording.progress = parseFloat(progressMatch[1]);
            }
        });

        // Track stdout for metadata
        let outputData = '';
        ffmpegProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        // Handle completion
        ffmpegProcess.on('close', async (code) => {
            activeRecordings.delete(recordingId);

            if (code === 0) {
                logger.info(`Recording completed: ${feedId}`);

                // Parse the recording metadata to get the output file path
                try {
                    const metadataMatch = outputData.match(/Metadata:\n({[\s\S]+})/);
                    if (metadataMatch) {
                        const metadata = JSON.parse(metadataMatch[1]);
                        logger.info('Recording metadata:', metadata);

                        const rawFilePath = metadata.outputPath;
                        const rawDir = path.dirname(rawFilePath);
                        const rawBasename = path.basename(rawFilePath, '.mp3');
                        const segmentDir = path.join(rawDir, '..', 'segments', rawBasename);

                        // Step 1: Segment the audio
                        logger.info('Starting audio segmentation...');
                        const segmentScript = path.join(process.cwd(), 'scripts', 'segment-audio.js');

                        const segmentProcess = spawn('node', [
                            segmentScript,
                            '--input', rawFilePath
                        ], {
                            cwd: process.cwd(),
                            stdio: ['pipe', 'pipe', 'pipe']
                        });

                        let segmentOutput = '';
                        segmentProcess.stdout.on('data', (data) => {
                            segmentOutput += data.toString();
                            logger.info('[segment]', data.toString().trim());
                        });
                        segmentProcess.stderr.on('data', (data) => {
                            logger.info('[segment stderr]', data.toString().trim());
                        });

                        segmentProcess.on('close', async (segmentCode) => {
                            if (segmentCode !== 0) {
                                logger.error(`Segmentation failed with code ${segmentCode}`);
                                return;
                            }

                            logger.info('Segmentation completed, parsing output...');

                            // Parse segment metadata to get the actual output directory
                            let actualSegmentDir = segmentDir;
                            try {
                                const segMetadataMatch = segmentOutput.match(/Metadata:\n({[\s\S]+})/);
                                if (segMetadataMatch) {
                                    const segMetadata = JSON.parse(segMetadataMatch[1]);
                                    if (segMetadata.outputDir) {
                                        actualSegmentDir = segMetadata.outputDir;
                                        logger.info(`Segment output dir: ${actualSegmentDir}, segments: ${segMetadata.segmentCount}`);
                                    }

                                    // Skip upload if no segments were created
                                    if (segMetadata.segmentCount === 0) {
                                        logger.info('No segments found in recording (no ATC activity). Skipping upload.');
                                        return;
                                    }
                                }
                            } catch (parseErr) {
                                logger.warn('Could not parse segment metadata:', parseErr.message);
                            }

                            logger.info('Starting upload to Supabase...');

                            // Step 2: Upload to Supabase
                            const uploadScript = path.join(process.cwd(), 'scripts', 'upload-to-supabase.js');

                            const uploadProcess = spawn('node', [
                                uploadScript,
                                '--raw-file', rawFilePath,
                                '--segment-dir', actualSegmentDir
                            ], {
                                cwd: process.cwd(),
                                stdio: ['pipe', 'pipe', 'pipe']
                            });

                            uploadProcess.stdout.on('data', (data) => {
                                logger.info('[upload]', data.toString().trim());
                            });
                            uploadProcess.stderr.on('data', (data) => {
                                logger.info('[upload stderr]', data.toString().trim());
                            });

                            uploadProcess.on('close', (uploadCode) => {
                                if (uploadCode === 0) {
                                    logger.info(`Pipeline completed successfully for ${feedId}`);
                                } else {
                                    logger.error(`Upload failed with code ${uploadCode}`);
                                }
                            });
                        });
                    } else {
                        logger.warn('No metadata found in recording output');
                    }
                } catch (e) {
                    logger.error('Error in post-recording pipeline:', e.message);
                }
            } else {
                logger.error(`Recording failed: ${feedId}, exit code: ${code}`);
            }
        });

        ffmpegProcess.on('error', (error) => {
            activeRecordings.delete(recordingId);
            logger.error(`Recording error: ${feedId}`, error);
        });

        return NextResponse.json({
            success: true,
            recordingId,
            message: `Started recording from ${config.airport} ${config.facility}`,
            details: {
                feedId,
                airport: config.airport,
                facility: config.facility,
                duration: durationSeconds,
                startedAt: recording.startedAt
            }
        });

    } catch (error) {
        logger.error('Error starting recording:', error);
        return NextResponse.json(
            { error: 'Failed to start recording', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/record
 * Stop an active recording session
 */
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const recordingId = searchParams.get('id');

        if (!recordingId || !activeRecordings.has(recordingId)) {
            return NextResponse.json(
                { error: 'Recording not found' },
                { status: 404 }
            );
        }

        const recording = activeRecordings.get(recordingId);

        // Kill the process
        if (recording.process) {
            recording.process.kill('SIGTERM');
        }

        activeRecordings.delete(recordingId);

        logger.info(`Recording stopped: ${recordingId}`);

        return NextResponse.json({
            success: true,
            message: 'Recording stopped'
        });

    } catch (error) {
        logger.error('Error stopping recording:', error);
        return NextResponse.json(
            { error: 'Failed to stop recording' },
            { status: 500 }
        );
    }
}
