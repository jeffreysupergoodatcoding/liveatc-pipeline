#!/usr/bin/env node

/**
 * Script to reprocess ALL model_outputs to add word-level confidence
 */

import { createClient } from '@supabase/supabase-js';
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !deepgramApiKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const deepgram = createDeepgramClient(deepgramApiKey);

async function reprocessModelOutput(modelOutput) {
    const modelOutputId = modelOutput.id;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${modelOutputId.substring(0, 8)}...`);
    console.log(`${'='.repeat(60)}`);

    const segment = modelOutput.segments;
    const filePath = segment.file_path;

    // Download audio from Supabase storage
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const { data: audioData, error: downloadError } = await supabase.storage
        .from('liveatc-segments')
        .download(cleanPath);

    if (downloadError || !audioData) {
        console.error('❌ Error downloading audio:', downloadError);
        return false;
    }

    // Save to temp file
    const tempPath = `/tmp/${path.basename(filePath)}`;
    const buffer = Buffer.from(await audioData.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    // Get current variations
    const variations = modelOutput.variations || [];
    const updatedVariations = [];

    for (const variation of variations) {
        console.log(`\n  Processing ${variation.model}...`);

        try {
            const audioBuffer = fs.readFileSync(tempPath);

            const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: variation.model,
                    smart_format: true,
                    punctuate: true,
                    words: true, // Enable word-level confidence
                    utterances: false,
                    diarize: false
                }
            );

            if (error) {
                console.error(`  ❌ Error transcribing:`, error);
                updatedVariations.push(variation);
                continue;
            }

            const deepgramResults = result.results || result;
            const channel = deepgramResults.channels?.[0];
            const alternative = channel?.alternatives?.[0];

            if (!alternative) {
                console.error(`  ❌ No alternative found`);
                updatedVariations.push(variation);
                continue;
            }

            // Extract word-level confidence
            const words = alternative.words || [];
            const wordConfidences = words.map(word => ({
                word: word.word,
                confidence: word.confidence,
                start: word.start,
                end: word.end
            }));

            console.log(`  ✓ ${wordConfidences.length} words | Overall: ${(alternative.confidence * 100).toFixed(1)}%`);

            updatedVariations.push({
                ...variation,
                text: alternative.transcript,
                confidence: alternative.confidence,
                words: wordConfidences
            });

        } catch (err) {
            console.error(`  ❌ Error:`, err.message);
            updatedVariations.push(variation);
        }
    }

    // Update model_output
    const { error: updateError } = await supabase
        .from('model_outputs')
        .update({ variations: updatedVariations })
        .eq('id', modelOutputId);

    if (updateError) {
        console.error('❌ Error updating:', updateError);
        fs.unlinkSync(tempPath);
        return false;
    }

    console.log(`\n✅ Updated successfully!`);

    // Cleanup
    fs.unlinkSync(tempPath);
    return true;
}

async function reprocessAll() {
    console.log('\n🚀 Reprocessing all model_outputs for word-level confidence\n');

    // Fetch all model_outputs that need ranking
    const { data: modelOutputs, error } = await supabase
        .from('model_outputs')
        .select('*, segments(file_path)')
        .eq('needs_ranking', true)
        .is('ranked_at', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching model_outputs:', error);
        process.exit(1);
    }

    console.log(`Found ${modelOutputs.length} model_outputs to process\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < modelOutputs.length; i++) {
        console.log(`\n[${i + 1}/${modelOutputs.length}]`);
        const success = await reprocessModelOutput(modelOutputs[i]);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Small delay to avoid rate limiting
        if (i < modelOutputs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total: ${modelOutputs.length}`);
    console.log(`\n${'='.repeat(60)}\n`);
}

reprocessAll();
