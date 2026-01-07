#!/usr/bin/env node

/**
 * Test variant generation for HuggingFace provider
 * Usage: node scripts/test-huggingface-variants.js [audio-file-path]
 */

import dotenv from 'dotenv';
import { getSTTProvider } from '../backend/services/transcription/index.js';

dotenv.config();

async function testVariants() {
    console.log('🧪 Testing HuggingFace Variant Generation\n');

    const audioFile = process.argv[2];

    if (!audioFile) {
        console.log('Usage: node scripts/test-huggingface-variants.js [path-to-audio-file]');
        console.log('\nExample:');
        console.log('  node scripts/test-huggingface-variants.js ./training_data/audio/clean_8ec8ed01-a063-4174-912d-5f1fe10c95b0.mp3');
        process.exit(0);
    }

    console.log(`🎵 Audio File: ${audioFile}\n`);

    try {
        const stt = getSTTProvider('huggingface');
        console.log(`✅ Using provider: ${stt.getName()}\n`);

        console.log('━'.repeat(60));
        console.log('🔄 Generating 3 variants...');
        console.log('━'.repeat(60));
        console.log();

        const startTime = Date.now();
        const variants = await stt.transcribeWithAlternatives(audioFile, 3);
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log();
        console.log('━'.repeat(60));
        console.log('📊 VARIANT RESULTS');
        console.log('━'.repeat(60));
        console.log(`Total time: ${totalDuration}s\n`);

        variants.forEach((variant, idx) => {
            const meta = variant.metadata.variant || {};
            console.log(`\n📝 Variant ${idx + 1}: ${meta.model || 'unknown'}`);
            console.log('─'.repeat(60));
            console.log(`Description: ${meta.model_description || 'N/A'}`);
            console.log(`Text: "${variant.text}"`);
            console.log(`Confidence: ${(variant.confidence * 100).toFixed(2)}%`);
            console.log(`Words: ${variant.words.length}`);

            if (meta.parameters) {
                console.log(`Parameters:`);
                Object.entries(meta.parameters).forEach(([key, value]) => {
                    console.log(`  - ${key}: ${JSON.stringify(value)}`);
                });
            }
        });

        console.log('\n' + '━'.repeat(60));
        console.log('📈 COMPARISON');
        console.log('━'.repeat(60));

        // Check if variants are different
        const texts = variants.map(v => v.text.toLowerCase().trim());
        const uniqueTexts = new Set(texts);

        console.log(`\nUnique transcriptions: ${uniqueTexts.size} out of ${variants.length}`);

        if (uniqueTexts.size === 1) {
            console.log('⚠️  All variants produced the same transcription');
            console.log('   (This may be normal for very clear audio or if temperature=0 for all)');
        } else if (uniqueTexts.size === variants.length) {
            console.log('✅ All variants are unique!');
        } else {
            console.log(`✅ Got ${uniqueTexts.size} different transcriptions`);
        }

        // Show unique transcriptions
        if (uniqueTexts.size > 1) {
            console.log('\nUnique texts:');
            Array.from(uniqueTexts).forEach((text, idx) => {
                console.log(`  ${idx + 1}. "${text}"`);
            });
        }

        console.log('\n✨ Test complete!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testVariants().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
