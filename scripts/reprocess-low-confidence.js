#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { EdgeCaseDetector } from '../backend/services/detection/EdgeCaseDetector.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Reprocess Low Confidence Segments
 * Runs transcription analysis on all segments that need human review
 * to populate their transcription field
 */

async function getLowConfidenceSegments() {
    console.log('Fetching low confidence segments without transcriptions...');

    const { data, error } = await supabase
        .from('segments')
        .select('id, file_path, transcription_text')
        .eq('needs_human_review', true)
        .is('transcription_text', null)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch segments: ${error.message}`);
    }

    return data || [];
}

async function processSegment(segment) {
    console.log(`\nProcessing segment: ${segment.id}`);

    try {
        // Download segment from storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('liveatc-segments')
            .download(segment.file_path);

        if (downloadError || !fileData) {
            console.error(`  ❌ Failed to download: ${downloadError?.message || 'No data'}`);
            return { success: false, error: 'Download failed' };
        }

        // Save to temp file
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const tempFile = path.join(os.tmpdir(), `segment-${segment.id}.mp3`);
        await fs.writeFile(tempFile, buffer);

        // Initialize detector and run analysis
        const detector = new EdgeCaseDetector();
        await detector.initialize();

        console.log('  🔍 Running transcription analysis...');
        const result = await detector.detect(tempFile);

        // Update segment with transcription
        const { error: updateError } = await supabase
            .from('segments')
            .update({
                transcription_text: result.transcription.text,
                transcription_confidence: result.transcription.confidence,
                speaker_count: result.transcription.speakerCount,
                audio_analysis_score: result.audioAnalysisScore,
                detected_patterns: result.detectedPatterns,
                audio_features: result.audioFeatures
            })
            .eq('id', segment.id);

        // Clean up temp file
        await fs.unlink(tempFile).catch(() => { });

        if (updateError) {
            console.error(`  ❌ Failed to update: ${updateError.message}`);
            return { success: false, error: updateError.message };
        }

        console.log(`  ✅ Success! Confidence: ${(result.transcription.confidence * 100).toFixed(1)}%`);
        console.log(`  📝 Transcription: ${result.transcription.text.substring(0, 100)}...`);

        return {
            success: true,
            confidence: result.transcription.confidence,
            transcription: result.transcription.text
        };

    } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Reprocess Low Confidence Segments');
    console.log('='.repeat(60));
    console.log('');

    try {
        // Get segments to process
        const segments = await getLowConfidenceSegments();

        if (segments.length === 0) {
            console.log('✓ No segments need processing - all have transcriptions!');
            process.exit(0);
        }

        console.log(`Found ${segments.length} segments to process`);
        console.log('');

        // Process each segment
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            console.log(`[${i + 1}/${segments.length}]`);

            const result = await processSegment(segment);

            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }

            // Small delay to avoid overwhelming the API
            if (i < segments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('Processing Complete');
        console.log('='.repeat(60));
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log(`📊 Total: ${segments.length}`);

        process.exit(errorCount > 0 ? 1 : 0);

    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();
