#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Detect where actual speech starts in an audio file
 * Returns the timestamp where speech begins
 */
async function detectSpeechStart(filePath) {
    return new Promise((resolve, reject) => {
        // Use silencedetect to find where silence ends (speech begins)
        const args = [
            '-i', filePath,
            '-af', 'silencedetect=noise=-35dB:d=0.5',
            '-f', 'null',
            '-'
        ];

        const ffmpeg = spawn('ffmpeg', args);
        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', () => {
            // Look for silence_end which indicates where speech starts
            const silenceEndMatch = stderr.match(/silence_end: ([\d.]+)/);
            if (silenceEndMatch) {
                const speechStart = parseFloat(silenceEndMatch[1]);
                resolve(speechStart);
            } else {
                // No silence detected, start from beginning
                resolve(0);
            }
        });

        ffmpeg.on('error', (error) => reject(error));
    });
}

/**
 * Trim audio file from a specific start time
 */
async function trimAudio(inputPath, outputPath, startTime) {
    return new Promise((resolve, reject) => {
        const args = [
            '-i', inputPath,
            '-ss', startTime.toString(),
            '-acodec', 'copy',
            '-y',
            outputPath
        ];

        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (error) => reject(error));
    });
}

/**
 * Get audio duration
 */
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

async function main() {
    console.log('=== Trimming Static from KIAH Approach Segments ===\n');

    try {
        // Get all segments from the KIAH approach recording
        const { data: segments, error: fetchError } = await supabase
            .from('segments')
            .select('*')
            .eq('recording_id', 'ace46c3b-b379-4c27-a6e3-1d775f3a271c')
            .order('segment_index');

        if (fetchError) {
            console.error('Error fetching segments:', fetchError);
            return;
        }

        console.log(`Found ${segments.length} approach segments to process\n`);

        for (const segment of segments) {
            console.log(`Processing segment ${segment.segment_index + 1}/${segments.length}...`);

            // Download the segment from Supabase storage
            const { data: audioData, error: downloadError } = await supabase.storage
                .from('liveatc-segments')
                .download(segment.file_path);

            if (downloadError) {
                console.error(`  Error downloading segment: ${downloadError.message}`);
                continue;
            }

            // Save to temp file
            const tempInput = `/tmp/segment_${segment.id}_input.mp3`;
            const tempOutput = `/tmp/segment_${segment.id}_output.mp3`;

            await fs.writeFile(tempInput, Buffer.from(await audioData.arrayBuffer()));

            // Detect where speech starts
            const speechStart = await detectSpeechStart(tempInput);
            console.log(`  Speech starts at: ${speechStart.toFixed(2)}s`);

            if (speechStart > 0.5) {
                // Trim the static
                await trimAudio(tempInput, tempOutput, speechStart);

                // Get new duration
                const newDuration = await getAudioDuration(tempOutput);
                const stats = await fs.stat(tempOutput);

                console.log(`  Trimmed ${speechStart.toFixed(2)}s of static`);
                console.log(`  New duration: ${newDuration.toFixed(2)}s`);

                // Upload trimmed version back to storage
                const trimmedAudio = await fs.readFile(tempOutput);
                const { error: uploadError } = await supabase.storage
                    .from('liveatc-segments')
                    .update(segment.file_path, trimmedAudio, {
                        contentType: 'audio/mpeg',
                        upsert: true
                    });

                if (uploadError) {
                    console.error(`  Error uploading trimmed segment: ${uploadError.message}`);
                } else {
                    // Update segment metadata
                    await supabase
                        .from('segments')
                        .update({
                            duration_seconds: newDuration,
                            file_size_bytes: stats.size,
                            start_time_in_recording: segment.start_time_in_recording + speechStart
                        })
                        .eq('id', segment.id);

                    console.log(`  ✓ Updated segment in database`);
                }

                // Clean up temp files
                await fs.unlink(tempOutput).catch(() => { });
            } else {
                console.log(`  No significant static detected, skipping`);
            }

            await fs.unlink(tempInput).catch(() => { });
        }

        console.log('\n=== Complete ===');
        console.log('All approach segments have been processed');

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
