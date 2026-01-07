#!/usr/bin/env node

/**
 * Compare Deepgram vs HuggingFace transcription
 * Usage: node scripts/compare-stt-providers.js [audio-file-path]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSTTProvider } from '../backend/services/transcription/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function compareProviders() {
    console.log('🔬 STT Provider Comparison Tool\n');

    const audioFile = process.argv[2];

    if (!audioFile) {
        console.log('Usage: node scripts/compare-stt-providers.js [path-to-audio-file]');
        console.log('\nExample:');
        console.log('  node scripts/compare-stt-providers.js sample1.flac');
        process.exit(0);
    }

    console.log(`🎵 Audio File: ${audioFile}\n`);

    const results = {};

    // Test Deepgram
    if (process.env.DEEPGRAM_API_KEY) {
        console.log('━'.repeat(60));
        console.log('📡 Testing Deepgram');
        console.log('━'.repeat(60));
        try {
            const deepgram = getSTTProvider('deepgram');
            const start = Date.now();
            const result = await deepgram.transcribe(audioFile);
            const duration = ((Date.now() - start) / 1000).toFixed(2);

            results.deepgram = {
                success: true,
                text: result.text,
                confidence: result.confidence,
                wordCount: result.words.length,
                duration: duration,
                result: result
            };

            console.log(`✅ Success!`);
            console.log(`📝 Text: ${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}`);
            console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(2)}%`);
            console.log(`🔢 Words: ${result.words.length}`);
            console.log(`⏱️  Processing Time: ${duration}s`);
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            results.deepgram = { success: false, error: error.message };
        }
    } else {
        console.log('⚠️  Deepgram API key not set - skipping');
        results.deepgram = { success: false, error: 'API key not set' };
    }

    console.log();

    // Test HuggingFace
    if (process.env.HUGGINGFACE_API_KEY) {
        console.log('━'.repeat(60));
        console.log('🤗 Testing HuggingFace');
        console.log('━'.repeat(60));
        try {
            const huggingface = getSTTProvider('huggingface');
            const start = Date.now();
            const result = await huggingface.transcribe(audioFile);
            const duration = ((Date.now() - start) / 1000).toFixed(2);

            results.huggingface = {
                success: true,
                text: result.text,
                confidence: result.confidence,
                wordCount: result.words.length,
                duration: duration,
                result: result
            };

            console.log(`✅ Success!`);
            console.log(`📝 Text: ${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}`);
            console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(2)}%`);
            console.log(`🔢 Words: ${result.words.length}`);
            console.log(`⏱️  Processing Time: ${duration}s`);
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            results.huggingface = { success: false, error: error.message };
        }
    } else {
        console.log('⚠️  HuggingFace API key not set - skipping');
        results.huggingface = { success: false, error: 'API key not set' };
    }

    // Print comparison
    console.log('\n');
    console.log('━'.repeat(60));
    console.log('📊 COMPARISON SUMMARY');
    console.log('━'.repeat(60));

    const providers = ['deepgram', 'huggingface'];
    const successfulProviders = providers.filter(p => results[p]?.success);

    if (successfulProviders.length === 0) {
        console.log('❌ No providers were successful');
        return;
    }

    if (successfulProviders.length === 1) {
        console.log(`✅ Only ${successfulProviders[0]} completed successfully`);
        return;
    }

    // Both succeeded - compare results
    console.log('\n📝 Transcription Text:');
    providers.forEach(provider => {
        if (results[provider]?.success) {
            const name = provider.charAt(0).toUpperCase() + provider.slice(1);
            console.log(`\n${name}:`);
            console.log(`"${results[provider].text}"`);
        }
    });

    console.log('\n📊 Metrics:');
    console.log('┌─────────────┬──────────────┬───────────────┐');
    console.log('│ Provider    │ Confidence   │ Process Time  │');
    console.log('├─────────────┼──────────────┼───────────────┤');
    providers.forEach(provider => {
        if (results[provider]?.success) {
            const name = provider.charAt(0).toUpperCase() + provider.slice(1);
            const conf = `${(results[provider].confidence * 100).toFixed(2)}%`;
            const time = `${results[provider].duration}s`;
            console.log(`│ ${name.padEnd(11)} │ ${conf.padEnd(12)} │ ${time.padEnd(13)} │`);
        }
    });
    console.log('└─────────────┴──────────────┴───────────────┘');

    // Text similarity check
    if (successfulProviders.length === 2) {
        const text1 = results[successfulProviders[0]].text.toLowerCase();
        const text2 = results[successfulProviders[1]].text.toLowerCase();

        if (text1 === text2) {
            console.log('\n✅ Transcriptions are IDENTICAL');
        } else {
            const similarity = calculateSimilarity(text1, text2);
            console.log(`\n📏 Text Similarity: ~${similarity.toFixed(1)}%`);

            if (similarity > 90) {
                console.log('✅ Very similar transcriptions');
            } else if (similarity > 70) {
                console.log('⚠️  Moderately similar transcriptions');
            } else {
                console.log('❌ Significantly different transcriptions');
            }
        }
    }

    console.log('\n✨ Comparison complete!');
}

// Simple similarity calculation (Jaccard similarity of word sets)
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return (intersection.size / union.size) * 100;
}

// Run the comparison
compareProviders().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
