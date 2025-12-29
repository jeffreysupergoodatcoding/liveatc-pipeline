import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../../../../lib/logger.js';

const execAsync = promisify(exec);

/**
 * POST /api/segments/[id]/split-unknown
 * 
 * Split audio segment by removing [UNKNOWN] regions and creating clean chunks
 * 
 * Body:
 * {
 *   unknownRegions: [{ start: 1.5, end: 2.3 }, { start: 4.0, end: 4.8 }]
 * }
 * 
 * Returns:
 * {
 *   chunks: [
 *     { chunkIndex: 0, start: 0, end: 1.5, filePath: '...', duration: 1.5 },
 *     { chunkIndex: 1, start: 2.3, end: 4.0, filePath: '...', duration: 1.7 },
 *     ...
 *   ]
 * }
 */
export async function POST(request, { params }) {
    let tempFiles = [];

    try {
        const supabase = getSupabaseServer();
        const { id } = await params;
        const { unknownRegions } = await request.json();

        if (!unknownRegions || !Array.isArray(unknownRegions)) {
            return NextResponse.json(
                { error: 'unknownRegions array is required' },
                { status: 400 }
            );
        }

        logger.info(`Splitting segment ${id} with ${unknownRegions.length} unknown regions`);

        // Fetch segment
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

        // Use trimmed version if available, otherwise original
        const sourceFilePath = segment.trimmed_file_path || segment.file_path;

        if (!sourceFilePath) {
            return NextResponse.json(
                { error: 'Segment has no audio file' },
                { status: 400 }
            );
        }

        // Download audio from Supabase Storage
        const bucket = segment.trimmed_file_path ? 'liveatc-segments' : 'liveatc-segments';
        const { data: audioData, error: downloadError } = await supabase
            .storage
            .from(bucket)
            .download(sourceFilePath);

        if (downloadError || !audioData) {
            logger.error('Error downloading audio:', downloadError);
            return NextResponse.json(
                { error: 'Failed to download audio file' },
                { status: 500 }
            );
        }

        // Save to temp file
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input_${id}_${Date.now()}.mp3`);
        const audioBuffer = Buffer.from(await audioData.arrayBuffer());
        await fs.writeFile(inputPath, audioBuffer);
        tempFiles.push(inputPath);

        // Calculate clean chunks (regions between unknowns)
        const sortedUnknowns = [...unknownRegions].sort((a, b) => a.start - b.start);
        const cleanChunks = [];

        let currentStart = 0;
        sortedUnknowns.forEach(unknown => {
            if (currentStart < unknown.start && unknown.start - currentStart >= 0.5) {
                cleanChunks.push({
                    start: currentStart,
                    end: unknown.start,
                    duration: unknown.start - currentStart
                });
            }
            currentStart = unknown.end;
        });

        // Add final chunk if there's audio after last unknown
        const segmentDuration = segment.duration_seconds || segment.duration || 0;
        if (currentStart < segmentDuration && segmentDuration - currentStart >= 0.5) {
            cleanChunks.push({
                start: currentStart,
                end: segmentDuration,
                duration: segmentDuration - currentStart
            });
        }

        logger.info(`Creating ${cleanChunks.length} clean chunks from segment`);

        if (cleanChunks.length === 0) {
            return NextResponse.json(
                { error: 'No clean chunks found (all audio marked as unknown)' },
                { status: 400 }
            );
        }

        // Extract each chunk with ffmpeg
        const chunks = [];

        for (let i = 0; i < cleanChunks.length; i++) {
            const chunk = cleanChunks[i];
            const chunkFileName = `${path.parse(sourceFilePath).name}_chunk${i}.mp3`;
            const outputPath = path.join(tempDir, `chunk_${id}_${i}_${Date.now()}.mp3`);
            tempFiles.push(outputPath);

            // Extract chunk with ffmpeg
            const duration = chunk.end - chunk.start;
            const ffmpegCmd = `ffmpeg -i "${inputPath}" -ss ${chunk.start} -t ${duration} -c copy "${outputPath}"`;

            logger.info(`Extracting chunk ${i}: ${chunk.start}s to ${chunk.end}s (${duration}s)`);

            try {
                await execAsync(ffmpegCmd);
            } catch (error) {
                logger.error(`Error extracting chunk ${i}:`, error);
                throw new Error(`Failed to extract chunk ${i}`);
            }

            // Upload chunk to Supabase Storage
            const chunkBuffer = await fs.readFile(outputPath);
            const storagePath = `chunks/${id}/${chunkFileName}`;

            const { error: uploadError } = await supabase
                .storage
                .from('liveatc-segments')
                .upload(storagePath, chunkBuffer, {
                    contentType: 'audio/mpeg',
                    upsert: true
                });

            if (uploadError) {
                logger.error(`Error uploading chunk ${i}:`, uploadError);
                throw new Error(`Failed to upload chunk ${i}`);
            }

            chunks.push({
                chunkIndex: i,
                start: chunk.start,
                end: chunk.end,
                duration: chunk.duration,
                filePath: storagePath
            });

            logger.info(`Chunk ${i} uploaded successfully: ${storagePath}`);
        }


        // Store chunk metadata in database (optional - for tracking)
        const { error: metadataError } = await supabase
            .from('segments')
            .update({
                split_into_chunks: chunks.length,
                unknown_regions: unknownRegions,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (metadataError) {
            logger.warn('Error storing chunk metadata:', metadataError);
            // Don't fail the request
        }

        // Get original label to use for chunks
        const { data: originalLabel, error: labelError } = await supabase
            .from('segment_labels')
            .select('*')
            .eq('segment_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (labelError) {
            logger.warn('Error fetching original label:', labelError);
        }

        // Create new segment and label entries for each chunk
        if (originalLabel) {
            // Split the transcription text at [UNKNOWN] boundaries
            const textChunks = originalLabel.transcription
                .split('[UNKNOWN]')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                // Create new segment entry for this chunk
                const { data: newSegment, error: segmentInsertError } = await supabase
                    .from('segments')
                    .insert({
                        file_path: chunk.filePath,
                        duration_seconds: chunk.duration,
                        recorded_at: segment.recorded_at,
                        is_chunk: true,
                        parent_segment_id: id,
                        chunk_index: i
                    })
                    .select()
                    .single();

                if (segmentInsertError) {
                    logger.warn(`Error creating segment entry for chunk ${i}:`, segmentInsertError);
                    continue;
                }

                // Create label entry for this chunk
                const { error: labelInsertError } = await supabase
                    .from('segment_labels')
                    .insert({
                        segment_id: newSegment.id,
                        transcription: textChunks[i] || '',
                        response: originalLabel.response,
                        confidence: originalLabel.confidence,
                        user_id: originalLabel.user_id,
                        created_at: new Date().toISOString()
                    });

                if (labelInsertError) {
                    logger.warn(`Error creating label for chunk ${i}:`, labelInsertError);
                }

                logger.info(`Created segment and label for chunk ${i}`);
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

        logger.info(`Successfully created ${chunks.length} chunks for segment ${id}`);

        return NextResponse.json({
            success: true,
            totalChunks: chunks.length,
            chunks,
            removedDuration: unknownRegions.reduce((sum, r) => sum + (r.end - r.start), 0),
            cleanDuration: chunks.reduce((sum, c) => sum + c.duration, 0)
        });

    } catch (error) {
        logger.error('Error splitting segment:', error);

        // Clean up temp files on error
        for (const file of tempFiles) {
            try {
                await fs.unlink(file);
            } catch (err) {
                // Ignore cleanup errors
            }
        }

        return NextResponse.json(
            { error: error.message || 'Failed to split segment' },
            { status: 500 }
        );
    }
}
