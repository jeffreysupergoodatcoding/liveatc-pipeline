#!/usr/bin/env node

/**
 * Re-transcribe a specific segment with the current STT provider
 * Usage: node scripts/retranscribe-segment.js <segment-id>
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSTTProvider } from '../backend/services/transcription/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function retranscribeSegment(segmentId) {
    console.log(`🔄 Re-transcribing segment: ${segmentId}\n`);

    try {
        // 1. Get segment from database
        console.log('📋 Fetching segment from database...');
        const { data: segment, error: segmentError } = await supabase
            .from('segments')
            .select('*')
            .eq('id', segmentId)
            .single();

        if (segmentError || !segment) {
            throw new Error(`Segment not found: ${segmentError?.message || 'No data'}`);
        }

        console.log(`✅ Found segment: ${segment.file_path}`);
        console.log(`   Duration: ${segment.duration_seconds}s`);
        console.log(`   Old transcription: "${segment.transcription_text}"`);
        console.log(`   Old confidence: ${(segment.transcription_confidence * 100).toFixed(1)}%\n`);

        // 2. Download audio file from Supabase Storage
        console.log('⬇️  Downloading audio file...');
        const { data: audioData, error: downloadError } = await supabase
            .storage
            .from('liveatc-segments')
            .download(segment.file_path);

        if (downloadError || !audioData) {
            throw new Error(`Failed to download audio: ${downloadError?.message || 'No data'}`);
        }

        // 3. Save to temporary file
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `segment-${segmentId}.mp3`);
        const buffer = Buffer.from(await audioData.arrayBuffer());
        await fs.writeFile(tempFile, buffer);
        console.log(`✅ Audio saved to: ${tempFile}\n`);

        // 4. Get STT provider and transcribe
        console.log('🎙️  Transcribing with current provider...');
        const stt = getSTTProvider();
        console.log(`   Using provider: ${stt.getName()}`);

        const startTime = Date.now();
        const result = await stt.transcribe(tempFile);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`✅ Transcription complete! (${duration}s)\n`);
        console.log('━'.repeat(60));
        console.log('📝 NEW TRANSCRIPTION RESULT');
        console.log('━'.repeat(60));
        console.log(`Provider: ${result.metadata.provider}`);
        console.log(`Text: ${result.text}`);
        console.log(`Confidence: ${(result.confidence * 100).toFixed(2)}%`);
        console.log(`Words: ${result.words.length}`);
        console.log('━'.repeat(60));

        // 5. Update segment in database
        console.log('\n💾 Updating segment in database...');
        const { error: updateError } = await supabase
            .from('segments')
            .update({
                transcription_text: result.text,
                transcription_confidence: result.confidence
            })
            .eq('id', segmentId);

        if (updateError) {
            throw new Error(`Failed to update segment: ${updateError.message}`);
        }

        console.log('✅ Segment updated successfully!\n');

        // 6. Clean up temp file
        await fs.unlink(tempFile);

        // 7. Show comparison
        console.log('📊 COMPARISON:');
        console.log('━'.repeat(60));
        console.log(`OLD (Deepgram?):`);
        console.log(`  "${segment.transcription_text}"`);
        console.log(`  Confidence: ${(segment.transcription_confidence * 100).toFixed(1)}%\n`);
        console.log(`NEW (${result.metadata.provider}):`);
        console.log(`  "${result.text}"`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log('━'.repeat(60));

        console.log('\n✨ Re-transcription complete!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Get segment ID from command line
const segmentId = process.argv[2];

if (!segmentId) {
    console.log('Usage: node scripts/retranscribe-segment.js <segment-id>');
    console.log('\nExample:');
    console.log('  node scripts/retranscribe-segment.js 0ce080e7-e081-4190-bfdd-0cb76af79bc1');
    process.exit(1);
}

retranscribeSegment(segmentId).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
