#!/usr/bin/env node

/**
 * Export Training Data
 * 
 * Exports all labeled segments AND audio chunks (from split unknowns) to training data format
 * 
 * Output:
 * - training_data/audio/       - All audio files (.mp3)
 * - training_data/metadata.jsonl - Training data in JSONL format
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const OUTPUT_DIR = path.join(__dirname, '../training_data');
const AUDIO_DIR = path.join(OUTPUT_DIR, 'audio');

async function exportTrainingData() {
    console.log('🚀 Exporting training data...\n');

    // Create output directories
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(AUDIO_DIR, { recursive: true });

    const trainingData = [];

    // ========================================
    // PART 1: Export clean labeled segments (no [UNKNOWN])
    // ========================================
    console.log('📦 Fetching clean labeled segments...');

    const { data: cleanLabels, error: cleanError } = await supabase
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

    if (cleanError) {
        console.error('❌ Error fetching clean labels:', cleanError);
        throw cleanError;
    }

    console.log(`✅ Found ${cleanLabels.length} clean labeled segments`);

    // Export each clean segment
    for (let i = 0; i < cleanLabels.length; i++) {
        const label = cleanLabels[i];
        const segment = label.segments;

        if (!segment) continue;

        // Use trimmed version if available, otherwise original
        const audioPath = segment.trimmed_file_path || segment.file_path;

        try {
            // Download audio from Supabase Storage
            const { data: audioData, error: downloadError } = await supabase
                .storage
                .from('liveatc-segments')
                .download(audioPath);

            if (downloadError) {
                console.warn(`⚠️  Failed to download ${audioPath}:`, downloadError.message);
                continue;
            }

            // Save audio locally
            const filename = `clean_${segment.id}.mp3`;
            const localPath = path.join(AUDIO_DIR, filename);
            const buffer = Buffer.from(await audioData.arrayBuffer());
            await fs.writeFile(localPath, buffer);

            // Add to training data
            trainingData.push({
                audio: `audio/${filename}`,
                text: label.transcription,
                duration: segment.duration_seconds,
                source: 'clean_segment',
                metadata: {
                    segment_id: segment.id,
                    context: label.response || null
                }
            });

            if ((i + 1) % 10 === 0) {
                console.log(`  Exported ${i + 1}/${cleanLabels.length} clean segments...`);
            }
        } catch (error) {
            console.warn(`⚠️  Error processing segment ${segment.id}:`, error.message);
        }
    }

    console.log(`✅ Exported ${trainingData.length} clean segments\n`);

    // ========================================
    // PART 2: Export chunks from split segments
    // ========================================
    console.log('🔪 Fetching split segments with chunks...');

    const { data: splitSegments, error: splitError } = await supabase
        .from('segments')
        .select(`
      id,
      split_into_chunks,
      unknown_regions,
      duration_seconds,
      segment_labels (
        transcription,
        response
      )
    `)
        .gt('split_into_chunks', 0)
        .order('created_at', { ascending: true });

    if (splitError) {
        console.error('❌ Error fetching split segments:', splitError);
        throw splitError;
    }

    console.log(`✅ Found ${splitSegments.length} segments with chunks`);

    let totalChunksExported = 0;

    // Export each chunk
    for (const segment of splitSegments) {
        const label = segment.segment_labels?.[0];

        if (!label || !label.transcription) {
            console.warn(`⚠️  Segment ${segment.id} has no label, skipping chunks`);
            continue;
        }

        // Split the transcription text at [UNKNOWN] boundaries
        const textChunks = splitTranscriptionAtUnknowns(
            label.transcription,
            segment.unknown_regions
        );

        // Export each chunk
        for (let i = 0; i < segment.split_into_chunks; i++) {
            try {
                const chunkPath = `chunks/${segment.id}/segment_chunk${i}.mp3`;

                // Download chunk from Supabase Storage
                const { data: chunkData, error: chunkError } = await supabase
                    .storage
                    .from('liveatc-segments')
                    .download(chunkPath);

                if (chunkError) {
                    console.warn(`⚠️  Failed to download chunk ${chunkPath}:`, chunkError.message);
                    continue;
                }

                // Save chunk locally
                const filename = `chunk_${segment.id}_${i}.mp3`;
                const localPath = path.join(AUDIO_DIR, filename);
                const buffer = Buffer.from(await chunkData.arrayBuffer());
                await fs.writeFile(localPath, buffer);

                // Add to training data
                trainingData.push({
                    audio: `audio/${filename}`,
                    text: textChunks[i] || '',
                    duration: calculateChunkDuration(segment.unknown_regions, i, segment.duration_seconds),
                    source: 'split_chunk',
                    metadata: {
                        segment_id: segment.id,
                        chunk_index: i,
                        context: label.response || null
                    }
                });

                totalChunksExported++;
            } catch (error) {
                console.warn(`⚠️  Error processing chunk ${i} of segment ${segment.id}:`, error.message);
            }
        }
    }

    console.log(`✅ Exported ${totalChunksExported} chunks from ${splitSegments.length} split segments\n`);

    // ========================================
    // PART 3: Write metadata file
    // ========================================
    console.log('💾 Writing metadata file...');

    const metadataPath = path.join(OUTPUT_DIR, 'metadata.jsonl');
    const jsonlData = trainingData.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile(metadataPath, jsonlData);

    console.log(`✅ Wrote ${trainingData.length} training samples to ${metadataPath}\n`);

    // ========================================
    // PART 4: Print summary
    // ========================================
    console.log('═══════════════════════════════════════════════');
    console.log('📊 EXPORT SUMMARY');
    console.log('═══════════════════════════════════════════════');
    console.log(`Total training samples:  ${trainingData.length}`);
    console.log(`  - Clean segments:      ${cleanLabels.length}`);
    console.log(`  - Split chunks:        ${totalChunksExported}`);
    console.log('');
    console.log(`Output directory:        ${OUTPUT_DIR}`);
    console.log(`Audio files:             ${AUDIO_DIR}`);
    console.log(`Metadata:                ${metadataPath}`);
    console.log('═══════════════════════════════════════════════');

    // Statistics
    const totalDuration = trainingData.reduce((sum, item) => sum + (item.duration || 0), 0);
    const avgDuration = totalDuration / trainingData.length;

    console.log('');
    console.log('📈 STATISTICS');
    console.log('═══════════════════════════════════════════════');
    console.log(`Total audio duration:    ${totalDuration.toFixed(1)}s (${(totalDuration / 60).toFixed(1)} minutes)`);
    console.log(`Average duration:        ${avgDuration.toFixed(1)}s`);
    console.log('═══════════════════════════════════════════════');
}

/**
 * Split transcription text at [UNKNOWN] boundaries
 * Returns array of clean text chunks
 */
function splitTranscriptionAtUnknowns(transcription, unknownRegions) {
    if (!unknownRegions || unknownRegions.length === 0) {
        return [transcription];
    }

    // Split by [UNKNOWN] markers
    const parts = transcription.split('[UNKNOWN]').map(p => p.trim()).filter(p => p.length > 0);

    return parts;
}

/**
 * Calculate duration of a specific chunk
 */
function calculateChunkDuration(unknownRegions, chunkIndex, totalDuration) {
    if (!unknownRegions || unknownRegions.length === 0) {
        return totalDuration;
    }

    const sorted = [...unknownRegions].sort((a, b) => a.start - b.start);

    let currentStart = 0;
    let currentChunkIndex = 0;

    for (const region of sorted) {
        if (currentChunkIndex === chunkIndex) {
            return region.start - currentStart;
        }
        currentStart = region.end;
        currentChunkIndex++;
    }

    // Last chunk
    if (currentChunkIndex === chunkIndex) {
        return totalDuration - currentStart;
    }

    return 0;
}

// Run the export
exportTrainingData()
    .then(() => {
        console.log('\n✅ Export complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Export failed:', error);
        process.exit(1);
    });
