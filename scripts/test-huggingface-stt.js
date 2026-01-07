#!/usr/bin/env node

/**
 * Test script for HuggingFace STT provider
 * Usage: node scripts/test-huggingface-stt.js [audio-file-path]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSTTProvider } from '../backend/services/transcription/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function testHuggingFace() {
    console.log('🧪 Testing HuggingFace STT Provider\n');

    // Check if API key is set
    if (!process.env.HUGGINGFACE_API_KEY) {
        console.error('❌ Error: HUGGINGFACE_API_KEY not set in .env');
        console.log('\nPlease add your HuggingFace API key to .env:');
        console.log('HUGGINGFACE_API_KEY=your_key_here');
        console.log('HUGGINGFACE_ENDPOINT=your_endpoint_here');
        process.exit(1);
    }

    console.log('✅ HuggingFace API key found');
    console.log(`📍 Endpoint: ${process.env.HUGGINGFACE_ENDPOINT || 'default'}\n`);

    try {
        // Create HuggingFace provider
        const stt = getSTTProvider('huggingface');
        console.log(`✅ Provider created: ${stt.getName()}`);
        console.log(`✅ Provider configured: ${stt.isConfigured()}\n`);

        // Get audio file path from command line or use default
        const audioFile = process.argv[2];

        if (!audioFile) {
            console.log('⚠️  No audio file specified');
            console.log('Usage: node scripts/test-huggingface-stt.js [path-to-audio-file]');
            console.log('\nExample:');
            console.log('  node scripts/test-huggingface-stt.js sample1.flac');
            console.log('  node scripts/test-huggingface-stt.js data/liveatc/segments/some_segment.mp3');
            process.exit(0);
        }

        console.log(`🎵 Transcribing: ${audioFile}\n`);

        const startTime = Date.now();
        const result = await stt.transcribe(audioFile);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('✅ Transcription Complete!\n');
        console.log('━'.repeat(60));
        console.log('📝 TRANSCRIPTION RESULT');
        console.log('━'.repeat(60));
        console.log(`Text: ${result.text}`);
        console.log(`Confidence: ${(result.confidence * 100).toFixed(2)}%`);
        console.log(`Words: ${result.words.length}`);
        console.log(`Duration: ${result.duration}s`);
        console.log(`Processing Time: ${duration}s`);
        console.log('━'.repeat(60));

        if (result.words && result.words.length > 0) {
            console.log('\n📊 Word-Level Data (first 10 words):');
            console.log('━'.repeat(60));
            result.words.slice(0, 10).forEach((word, idx) => {
                console.log(`${idx + 1}. "${word.word}" - confidence: ${(word.confidence * 100).toFixed(1)}%`);
            });
            if (result.words.length > 10) {
                console.log(`... and ${result.words.length - 10} more words`);
            }
            console.log('━'.repeat(60));
        }

        console.log('\n🔍 Raw Metadata:');
        console.log(JSON.stringify(result.metadata, null, 2));

        console.log('\n✨ Test completed successfully!');

    } catch (error) {
        console.error('\n❌ Error during transcription:');
        console.error(error.message);
        console.error('\nFull error:');
        console.error(error);
        process.exit(1);
    }
}

// Run the test
testHuggingFace().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
