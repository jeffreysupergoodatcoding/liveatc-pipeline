import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabase-server.js';
import { spawn } from 'child_process';
import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../../lib/logger.js';
import archiver from 'archiver';

/**
 * Audio processing utilities for dataset export
 */

// Run ffmpeg command with given arguments
function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args);
        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                logger.error('ffmpeg stderr:', stderr);
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', reject);
    });
}

// Get audio duration using ffprobe
function getDuration(filePath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath
        ]);

        let output = '';
        ffprobe.stdout.on('data', data => output += data.toString());

        ffprobe.on('close', code => {
            if (code === 0) {
                const duration = parseFloat(output.trim());
                if (isNaN(duration)) reject(new Error('Invalid duration output'));
                else resolve(duration);
            } else {
                reject(new Error(`ffprobe exited with code ${code}`));
            }
        });

        ffprobe.on('error', reject);
    });
}

/**
 * Audio Normalization - Normalize audio levels to a consistent loudness
 * Uses loudnorm filter for EBU R128 standard loudness normalization
 */
async function normalizeAudio(inputPath, outputPath) {
    const args = [
        '-i', inputPath,
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-ar', '16000',  // 16kHz sample rate for speech models
        '-ac', '1',      // Mono
        '-y',
        outputPath
    ];

    await runFFmpeg(args);
    return outputPath;
}

/**
 * Airband Radio Bandpass Filter
 * Simulates the audio characteristics of airband radio:
 * - Bandpass filter (300Hz - 3000Hz typical for aviation radio)
 * - Slight compression
 * - Optional noise simulation
 */
async function applyAirbandFilter(inputPath, outputPath, options = {}) {
    const {
        lowFreq = 300,      // Low frequency cutoff
        highFreq = 3000,    // High frequency cutoff
        compression = true,  // Apply compression
        noiseLevel = 0      // 0 = no noise, 0.1 = subtle, 0.2 = moderate
    } = options;

    // Build the filter chain
    let filters = [];

    // Bandpass filter for airband characteristics
    filters.push(`highpass=f=${lowFreq}`);
    filters.push(`lowpass=f=${highFreq}`);

    // Optional compression to simulate radio limiting
    if (compression) {
        filters.push('acompressor=threshold=-20dB:ratio=4:attack=5:release=50');
    }

    // Optional background noise (simulates radio static)
    if (noiseLevel > 0) {
        // We'll add noise using a different approach with amix
        const noiseArgs = [
            '-i', inputPath,
            '-f', 'lavfi', '-i', `anoisesrc=d=300:c=pink:a=${noiseLevel}`,
            '-filter_complex', `[0:a]${filters.join(',')}[main];[1:a]volume=${noiseLevel}[noise];[main][noise]amix=inputs=2:duration=first`,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            outputPath
        ];
        await runFFmpeg(noiseArgs);
        return outputPath;
    }

    const args = [
        '-i', inputPath,
        '-af', filters.join(','),
        '-ar', '16000',
        '-ac', '1',
        '-y',
        outputPath
    ];

    await runFFmpeg(args);
    return outputPath;
}

/**
 * Data Augmentation - Create variations of the audio based on multiplier
 * The multiplier determines how many augmented copies to create per original
 * 
 * Multiplier mapping:
 * 1x  = 1 augmentation (tempo only)
 * 2x  = 2 augmentations (tempo, pitch)
 * 4x  = 4 augmentations (tempo x2, pitch x2)
 * 8x  = 8 augmentations (tempo x2, pitch x2, volume x2, noise x2)
 * 16x = 16 augmentations (tempo x3, pitch x4, volume x4, noise x5)
 */
async function createAugmentations(inputPath, outputDir, baseFilename, multiplier = 4) {
    const augmentedFiles = [];
    const duration = await getDuration(inputPath);

    // Define augmentation pools
    const tempoOptions = [0.85, 0.9, 0.95, 1.05, 1.1, 1.15];
    const pitchOptions = [-4, -2, -1, 1, 2, 4];
    const volumeOptions = [-6, -3, -1, 1, 3, 6];
    const noiseOptions = [0.01, 0.02, 0.03, 0.05, 0.08];

    // Select augmentations based on multiplier
    let selectedTempo = [];
    let selectedPitch = [];
    let selectedVolume = [];
    let selectedNoise = [];

    if (multiplier >= 1) {
        selectedTempo = [0.9];  // 1 tempo
    }
    if (multiplier >= 2) {
        selectedPitch = [-2];  // add 1 pitch
    }
    if (multiplier >= 4) {
        selectedTempo = [0.9, 1.1];  // 2 tempo
        selectedPitch = [-2, 2];     // 2 pitch
    }
    if (multiplier >= 8) {
        selectedVolume = [-3, 3];    // add 2 volume
        selectedNoise = [0.02, 0.05]; // add 2 noise
    }
    if (multiplier >= 16) {
        selectedTempo = [0.85, 0.9, 1.1];  // 3 tempo
        selectedPitch = [-4, -2, 2, 4];     // 4 pitch
        selectedVolume = [-6, -3, 3, 6];    // 4 volume
        selectedNoise = [0.01, 0.02, 0.03, 0.05, 0.08]; // 5 noise
    }

    // Time stretch variations (atempo filter)
    for (const factor of selectedTempo) {
        const filename = `${baseFilename}_tempo${factor.toFixed(2).replace('.', '_')}.mp3`;
        const outputPath = path.join(outputDir, filename);

        await runFFmpeg([
            '-i', inputPath,
            '-af', `atempo=${factor}`,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            outputPath
        ]);

        augmentedFiles.push({
            path: outputPath,
            filename,
            augmentation: 'time_stretch',
            factor,
            newDuration: duration / factor
        });
    }

    // Pitch shift variations (asetrate + atempo to maintain duration)
    for (const semitones of selectedPitch) {
        const filename = `${baseFilename}_pitch${semitones > 0 ? 'p' : 'm'}${Math.abs(semitones)}st.mp3`;
        const outputPath = path.join(outputDir, filename);

        // Calculate rate change for pitch shift
        const pitchFactor = Math.pow(2, semitones / 12);
        const targetRate = Math.round(16000 * pitchFactor);

        await runFFmpeg([
            '-i', inputPath,
            '-af', `asetrate=${targetRate},aresample=16000,atempo=${1 / pitchFactor}`,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            outputPath
        ]);

        augmentedFiles.push({
            path: outputPath,
            filename,
            augmentation: 'pitch_shift',
            semitones,
            newDuration: duration
        });
    }

    // Volume variations
    for (const dbChange of selectedVolume) {
        const filename = `${baseFilename}_vol${dbChange > 0 ? 'p' : 'm'}${Math.abs(dbChange)}dB.mp3`;
        const outputPath = path.join(outputDir, filename);

        await runFFmpeg([
            '-i', inputPath,
            '-af', `volume=${dbChange}dB`,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            outputPath
        ]);

        augmentedFiles.push({
            path: outputPath,
            filename,
            augmentation: 'volume',
            dbChange,
            newDuration: duration
        });
    }

    // Add noise variations
    for (const noiseLevel of selectedNoise) {
        const filename = `${baseFilename}_noise${(noiseLevel * 100).toFixed(0)}pct.mp3`;
        const outputPath = path.join(outputDir, filename);

        await runFFmpeg([
            '-i', inputPath,
            '-f', 'lavfi', '-i', `anoisesrc=d=${duration + 1}:c=white:a=${noiseLevel}`,
            '-filter_complex', `[0:a][1:a]amix=inputs=2:duration=first:weights=1 ${noiseLevel}`,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            outputPath
        ]);

        augmentedFiles.push({
            path: outputPath,
            filename,
            augmentation: 'noise',
            noiseLevel,
            newDuration: duration
        });
    }

    return augmentedFiles;
}

/**
 * POST /api/export-dataset
 * Export labeled clips as a training dataset with augmentation and processing
 * 
 * Request body:
 * {
 *   "options": {
 *     "normalize": true,              // Apply audio normalization
 *     "airbandFilter": true,          // Apply airband radio simulation filter
 *     "augmentation": true,           // Create augmented copies
 *     "augmentationMultiplier": 4,    // 1, 2, 4, 8, or 16 - how many augmented copies per original
 *     "airbandOptions": {
 *       "lowFreq": 300,
 *       "highFreq": 3000,
 *       "compression": true,
 *       "noiseLevel": 0
 *     }
 *   }
 * }
 */
export async function POST(request) {
    const tempDir = path.join(os.tmpdir(), `dataset_export_${Date.now()}`);
    const audioDir = path.join(tempDir, 'audio');

    try {
        const supabase = getSupabaseServer();
        const { options = {} } = await request.json();

        const {
            normalize = true,
            airbandFilter = true,
            augmentation = true,
            augmentationMultiplier = 4,
            airbandOptions = {}
        } = options;

        logger.info('Starting dataset export with options:', { normalize, airbandFilter, augmentation });

        // Create output directories
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(audioDir, { recursive: true });

        // Fetch all labeled segments
        const { data: labels, error: labelsError } = await supabase
            .from('segment_labels')
            .select(`
                id,
                segment_id,
                transcription,
                response,
                segments (
                    id,
                    file_path,
                    trimmed_file_path,
                    duration_seconds
                )
            `)
            .not('transcription', 'like', '%[UNKNOWN]%')
            .order('created_at', { ascending: true });

        if (labelsError) {
            logger.error('Error fetching labels:', labelsError);
            throw labelsError;
        }

        logger.info(`Found ${labels.length} labeled segments to export`);

        const trainingData = [];
        let processedCount = 0;
        let augmentedCount = 0;

        for (const label of labels) {
            const segment = label.segments;
            if (!segment) continue;

            const audioPath = segment.trimmed_file_path || segment.file_path;

            try {
                // Download audio from Supabase Storage
                const { data: audioData, error: downloadError } = await supabase
                    .storage
                    .from('liveatc-segments')
                    .download(audioPath);

                if (downloadError) {
                    logger.warn(`Failed to download ${audioPath}:`, downloadError.message);
                    continue;
                }

                // Save to temp file
                const originalFilename = `original_${segment.id}.mp3`;
                const originalPath = path.join(tempDir, originalFilename);
                const buffer = Buffer.from(await audioData.arrayBuffer());
                await fs.writeFile(originalPath, buffer);

                // Process the audio
                let processedPath = originalPath;
                let processedFilename = `seg_${segment.id}.mp3`;

                // Step 1: Apply airband filter if enabled
                if (airbandFilter) {
                    const airbandPath = path.join(tempDir, `airband_${segment.id}.mp3`);
                    await applyAirbandFilter(processedPath, airbandPath, airbandOptions);
                    processedPath = airbandPath;
                }

                // Step 2: Apply normalization if enabled
                if (normalize) {
                    const normalizedPath = path.join(audioDir, processedFilename);
                    await normalizeAudio(processedPath, normalizedPath);
                    processedPath = normalizedPath;
                } else {
                    // Just copy to audio dir
                    const finalPath = path.join(audioDir, processedFilename);
                    await fs.copyFile(processedPath, finalPath);
                    processedPath = finalPath;
                }

                // Get final duration
                let finalDuration = segment.duration_seconds;
                try {
                    finalDuration = await getDuration(processedPath);
                } catch (e) {
                    logger.warn('Failed to get duration:', e.message);
                }

                // Add main sample to training data
                trainingData.push({
                    audio: `audio/${processedFilename}`,
                    text: label.transcription,
                    duration: finalDuration,
                    source: 'original',
                    processing: {
                        normalized: normalize,
                        airband_filtered: airbandFilter
                    },
                    metadata: {
                        segment_id: segment.id,
                        label_id: label.id,
                        context: label.response || null
                    }
                });

                processedCount++;

                // Step 3: Create augmentations if enabled
                if (augmentation) {
                    const baseFilename = `seg_${segment.id}`;
                    const augmentedFiles = await createAugmentations(
                        processedPath,
                        audioDir,
                        baseFilename,
                        augmentationMultiplier
                    );

                    for (const augFile of augmentedFiles) {
                        trainingData.push({
                            audio: `audio/${augFile.filename}`,
                            text: label.transcription,
                            duration: augFile.newDuration,
                            source: 'augmented',
                            augmentation: {
                                type: augFile.augmentation,
                                params: {
                                    factor: augFile.factor,
                                    semitones: augFile.semitones,
                                    dbChange: augFile.dbChange,
                                    noiseLevel: augFile.noiseLevel
                                }
                            },
                            processing: {
                                normalized: normalize,
                                airband_filtered: airbandFilter
                            },
                            metadata: {
                                segment_id: segment.id,
                                label_id: label.id,
                                original_audio: `audio/${processedFilename}`,
                                context: label.response || null
                            }
                        });
                        augmentedCount++;
                    }
                }

                // Clean up intermediate files
                if (airbandFilter) {
                    try { await fs.unlink(path.join(tempDir, `airband_${segment.id}.mp3`)); } catch { }
                }
                try { await fs.unlink(originalPath); } catch { }

                if (processedCount % 10 === 0) {
                    logger.info(`Processed ${processedCount}/${labels.length} segments...`);
                }

            } catch (error) {
                logger.warn(`Error processing segment ${segment.id}:`, error.message);
            }
        }

        // Write metadata file
        const metadataPath = path.join(tempDir, 'metadata.jsonl');
        const jsonlData = trainingData.map(item => JSON.stringify(item)).join('\n');
        await fs.writeFile(metadataPath, jsonlData);

        // Write summary file
        const summary = {
            export_date: new Date().toISOString(),
            total_samples: trainingData.length,
            original_samples: processedCount,
            augmented_samples: augmentedCount,
            options: {
                normalize,
                airbandFilter,
                augmentation,
                augmentationMultiplier,
                airbandOptions
            },
            statistics: {
                total_duration_seconds: trainingData.reduce((sum, item) => sum + (item.duration || 0), 0),
                average_duration_seconds: trainingData.length > 0
                    ? trainingData.reduce((sum, item) => sum + (item.duration || 0), 0) / trainingData.length
                    : 0
            }
        };

        const summaryPath = path.join(tempDir, 'summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

        // Create ZIP file using archiver (cross-platform, no external dependencies)
        const zipPath = path.join(os.tmpdir(), `atc_training_dataset_${Date.now()}.zip`);

        await new Promise((resolve, reject) => {
            const output = createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 6 } });

            output.on('close', () => {
                logger.info(`ZIP archive created: ${archive.pointer()} bytes`);
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);
            archive.directory(tempDir, false);
            archive.finalize();
        });

        // Read zip file
        const zipBuffer = await fs.readFile(zipPath);

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.unlink(zipPath).catch(() => { });

        logger.info(`Dataset export complete: ${processedCount} original + ${augmentedCount} augmented = ${trainingData.length} total samples`);

        // Return the ZIP file
        return new NextResponse(zipBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="atc_training_dataset_${new Date().toISOString().split('T')[0]}.zip"`,
                'X-Total-Samples': trainingData.length.toString(),
                'X-Original-Samples': processedCount.toString(),
                'X-Augmented-Samples': augmentedCount.toString()
            }
        });

    } catch (error) {
        // Clean up on error
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { }

        logger.error('Error exporting dataset:', error);
        return NextResponse.json(
            {
                error: 'Failed to export dataset',
                details: error.message
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/export-dataset
 * Get export preview (count of segments, estimated size, etc.)
 */
export async function GET() {
    try {
        const supabase = getSupabaseServer();

        // Count labeled segments
        const { data: labels, error } = await supabase
            .from('segment_labels')
            .select(`
                id,
                segments (
                    id,
                    duration_seconds,
                    file_path
                )
            `)
            .not('transcription', 'like', '%[UNKNOWN]%');

        if (error) throw error;

        const validLabels = labels.filter(l => l.segments);
        const totalDuration = validLabels.reduce((sum, l) => sum + (l.segments?.duration_seconds || 0), 0);

        // Estimate augmentation multiplier (default options create ~8 augmented copies per original)
        const augmentationMultiplier = 8;

        return NextResponse.json({
            labeledSegments: validLabels.length,
            totalDurationSeconds: totalDuration,
            totalDurationMinutes: (totalDuration / 60).toFixed(1),
            estimatedWithAugmentation: validLabels.length * (1 + augmentationMultiplier),
            estimatedDurationWithAugmentation: totalDuration * (1 + augmentationMultiplier),
            augmentationMultiplier
        });

    } catch (error) {
        logger.error('Error getting export preview:', error);
        return NextResponse.json(
            { error: 'Failed to get export preview' },
            { status: 500 }
        );
    }
}
