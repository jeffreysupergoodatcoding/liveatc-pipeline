import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../../../../lib/logger.js';

// Helper function to get duration using ffprobe
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
 * POST /api/segments/[id]/trim
 * Trim audio segment by removing specified regions and concatenating the rest
 * 
 * Request body:
 * {
 *   "removeRegions": [
 *     { "start": 1.2, "end": 2.5 },  // Remove 1.2s-2.5s
 *     { "start": 4.0, "end": 5.0 }   // Remove 4.0s-5.0s
 *   ]
 * }
 */
export async function POST(request, { params }) {
    const tempFiles = [];

    try {
        const supabase = getSupabaseServer();
        const { id } = await params;
        const { removeRegions = [], previewOnly = false } = await request.json();

        // Fetch segment from database
        const { data: segment, error: segmentError } = await supabase
            .from('segments')
            .select('*')
            .eq('id', id)
            .single();

        if (segmentError || !segment) {
            return NextResponse.json(
                { error: 'Segment not found' },
                { status: 404 }
            );
        }

        if (!segment.file_path) {
            return NextResponse.json(
                { error: 'Segment has no audio file' },
                { status: 400 }
            );
        }

        logger.info(`Trimming segment ${id} - removing ${removeRegions.length} regions`);

        // Download original audio file from Supabase Storage
        const { data: audioData, error: downloadError } = await supabase
            .storage
            .from('liveatc-segments')
            .download(segment.file_path);

        if (downloadError || !audioData) {
            logger.error('Error downloading audio:', downloadError);
            return NextResponse.json(
                { error: 'Failed to download audio file' },
                { status: 500 }
            );
        }

        // Convert blob to buffer and save to temp file
        const audioBuffer = Buffer.from(await audioData.arrayBuffer());
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input_${id}_${Date.now()}.mp3`);
        tempFiles.push(inputPath);

        await fs.writeFile(inputPath, audioBuffer);

        // Get actual duration from file to ensures accuracy
        let duration = segment.duration_seconds || 0;
        try {
            const fileDuration = await getDuration(inputPath);
            logger.info(`Duration check - DB: ${duration}, File: ${fileDuration}`);
            if (fileDuration > 0) {
                duration = fileDuration;
            }
        } catch (err) {
            logger.warn('Failed to get file duration, falling back to DB duration:', err);
        }

        let outputPath;

        if (removeRegions.length === 0) {
            // No regions to remove, just return original
            outputPath = inputPath;
        } else {
            // Calculate the kept segments (parts NOT being removed)
            const sortedRemove = [...removeRegions].sort((a, b) => a.start - b.start);
            const keptSegments = [];

            let currentStart = 0;
            sortedRemove.forEach(region => {
                // Ensure we don't go past actual duration
                if (region.start < duration) {
                    if (currentStart < region.start) {
                        keptSegments.push({
                            start: currentStart,
                            end: region.start
                        });
                    }
                    currentStart = Math.min(region.end, duration);
                }
            });

            // Add final segment after last removed region
            if (currentStart < duration) {
                keptSegments.push({
                    start: currentStart,
                    end: duration
                });
            }

            if (keptSegments.length === 0) {
                return NextResponse.json(
                    { error: 'All audio would be removed', details: { duration, removeRegions } },
                    { status: 400 }
                );
            }

            if (keptSegments.length === 1) {
                // Only one segment left, just extract it
                const seg = keptSegments[0];
                outputPath = path.join(tempDir, `trimmed_${id}_${Date.now()}.mp3`);
                tempFiles.push(outputPath);

                const ffmpegArgs = [
                    '-i', inputPath,
                    '-ss', seg.start.toString(),
                    '-t', (seg.end - seg.start).toString(),
                    '-acodec', 'copy',
                    '-y',
                    outputPath
                ];

                await runFFmpeg(ffmpegArgs);
            } else {
                // Multiple segments - need to concatenate
                // Step 1: Extract each kept segment as a separate file
                const segmentFiles = [];
                for (let i = 0; i < keptSegments.length; i++) {
                    const seg = keptSegments[i];
                    const segPath = path.join(tempDir, `seg_${id}_${i}_${Date.now()}.mp3`);
                    tempFiles.push(segPath);

                    const ffmpegArgs = [
                        '-i', inputPath,
                        '-ss', seg.start.toString(),
                        '-t', (seg.end - seg.start).toString(),
                        '-acodec', 'copy',
                        '-y',
                        segPath
                    ];

                    await runFFmpeg(ffmpegArgs);
                    segmentFiles.push(segPath);
                }

                // Step 2: Create concat file list for ffmpeg
                const concatListPath = path.join(tempDir, `concat_${id}_${Date.now()}.txt`);
                tempFiles.push(concatListPath);

                const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n');
                await fs.writeFile(concatListPath, concatContent);

                // Step 3: Concatenate all segments
                outputPath = path.join(tempDir, `trimmed_${id}_${Date.now()}.mp3`);
                tempFiles.push(outputPath);

                const concatArgs = [
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', concatListPath,
                    '-c', 'copy',
                    '-y',
                    outputPath
                ];

                await runFFmpeg(concatArgs);
            }
        }

        // Read the trimmed file
        const trimmedBuffer = await fs.readFile(outputPath);

        // Upload trimmed file to Supabase Storage
        const originalPath = segment.file_path;
        const timestamp = Date.now();
        const trimmedPath = originalPath.replace(/(\.[^.]+)$/, `_trimmed_${timestamp}$1`);

        const { error: uploadError } = await supabase
            .storage
            .from('liveatc-segments')
            .upload(trimmedPath, trimmedBuffer, {
                contentType: 'audio/mpeg',
                upsert: true
            });

        if (uploadError) {
            logger.error('Error uploading trimmed audio:', uploadError);
            throw uploadError;
        }

        // Calculate final duration
        const removedDuration = removeRegions.reduce((sum, r) => sum + (r.end - r.start), 0);
        const finalDuration = duration - removedDuration;

        // Only update database if not preview-only
        if (!previewOnly) {
            // First update critical fields (trimmed_file_path, duration)
            logger.info(`📝 Updating segment ${id} with:`);
            logger.info(`   trimmed_file_path: ${trimmedPath}`);
            logger.info(`   duration_seconds: ${finalDuration}`);

            const { error: updateError } = await supabase
                .from('segments')
                .update({
                    trimmed_file_path: trimmedPath,
                    duration_seconds: finalDuration
                })
                .eq('id', id);

            if (updateError) {
                logger.error('Error updating segment trimmed_file_path:', updateError);
                throw updateError; // This is critical, should fail the request
            }

            // VERIFICATION: Read back what we just wrote
            const { data: verifySegment, error: verifyError } = await supabase
                .from('segments')
                .select('trimmed_file_path, duration_seconds')
                .eq('id', id)
                .maybeSingle();

            if (verifyError) {
                logger.error('❌ Verification read failed:', verifyError);
            } else {
                logger.info(`✅ Verification - DB now has:`);
                logger.info(`   trimmed_file_path: ${verifySegment.trimmed_file_path}`);
                logger.info(`   duration_seconds: ${verifySegment.duration_seconds}`);

                // Also write to a debug file
                const debugLog = `${new Date().toISOString()} - Segment ${id}\n` +
                    `  WROTE: ${trimmedPath}\n` +
                    `  READ:  ${verifySegment.trimmed_file_path}\n` +
                    `  MATCH: ${verifySegment.trimmed_file_path === trimmedPath ? 'YES' : 'NO'}\n\n`;
                await fs.appendFile('/tmp/trim-debug.log', debugLog).catch(() => { });

                if (verifySegment.trimmed_file_path !== trimmedPath) {
                    logger.error(`⚠️ MISMATCH! Expected ${trimmedPath} but DB has ${verifySegment.trimmed_file_path}`);
                }
            }

            // Try to update remove_regions (optional - column may not exist)
            try {
                const { error: regionsError } = await supabase
                    .from('segments')
                    .update({ remove_regions: removeRegions })
                    .eq('id', id);

                if (regionsError) {
                    logger.warn('Could not save remove_regions (column may not exist):', regionsError.message);
                }
            } catch (e) {
                logger.warn('remove_regions update failed:', e.message);
            }
        }

        // Clean up temp files
        for (const file of tempFiles) {
            try {
                await fs.unlink(file);
            } catch (err) {
                logger.warn(`Failed to delete temp file ${file}:`, err);
            }
        }

        // Get signed URL for the trimmed audio
        const { data: urlData } = await supabase
            .storage
            .from('liveatc-segments')
            .createSignedUrl(trimmedPath, 3600);

        logger.info(`Successfully trimmed segment ${id}`);

        return NextResponse.json({
            success: true,
            removeRegions,
            removedDuration,
            finalDuration,
            trimmedAudioUrl: urlData?.signedUrl,
            trimmedFilePath: trimmedPath
        });

    } catch (error) {
        // Clean up temp files on error
        for (const file of tempFiles) {
            try {
                await fs.unlink(file);
            } catch { }
        }

        logger.error('Error trimming audio:', error);
        return NextResponse.json(
            {
                error: 'Failed to trim audio',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}

// Helper function to run ffmpeg
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
