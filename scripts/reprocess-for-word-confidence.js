#!/usr/bin/env node

/**
 * Script to reprocess a model_output to add word-level confidence
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

async function reprocessModelOutput(modelOutputId) {
    console.log(`\nReprocessing model_output: ${modelOutputId}\n`);

    // 1. Fetch the model_output
    const { data: modelOutput, error: fetchError } = await supabase
        .from('model_outputs')
        .select('*, segments(file_path)')
        .eq('id', modelOutputId)
        .single();

    if (fetchError || !modelOutput) {
        console.error('Error fetching model_output:', fetchError);
        process.exit(1);
    }

    const segment = modelOutput.segments;
    const filePath = segment.file_path;
    console.log(`Segment file: ${filePath}`);

    // 2. Download audio from Supabase storage
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const { data: audioData, error: downloadError } = await supabase.storage
        .from('liveatc-segments')
        .download(cleanPath);

    if (downloadError || !audioData) {
        console.error('Error downloading audio:', downloadError);
        process.exit(1);
    }

    // Save to temp file
    const tempPath = `/tmp/${path.basename(filePath)}`;
    const buffer = Buffer.from(await audioData.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);
    console.log(`Downloaded audio to: ${tempPath}`);

    // 3. Get current variations
    const variations = modelOutput.variations || [];
    console.log(`\nCurrent variations: ${variations.length}`);

    // 4. Reprocess each variation with its model
    const updatedVariations = [];

    for (const variation of variations) {
        console.log(`\nProcessing ${variation.model}...`);

        try {
            const audioBuffer = fs.readFileSync(tempPath);

            const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: variation.model,
                    smart_format: true,
                    punctuate: true,
                    utterances: false,
                    diarize: false
                }
            );

            if (error) {
                console.error(`Error transcribing with ${variation.model}:`, error);
                updatedVariations.push(variation); // Keep original
                continue;
            }

            const deepgramResults = result.results || result;
            const channel = deepgramResults.channels?.[0];
            const alternative = channel?.alternatives?.[0];

            if (!alternative) {
                console.error(`No alternative found for ${variation.model}`);
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

            console.log(`  ✓ Got ${wordConfidences.length} words with confidence`);
            console.log(`  Overall confidence: ${(alternative.confidence * 100).toFixed(1)}%`);

            updatedVariations.push({
                ...variation,
                text: alternative.transcript,
                confidence: alternative.confidence,
                words: wordConfidences
            });

        } catch (err) {
            console.error(`Error processing ${variation.model}:`, err);
            updatedVariations.push(variation);
        }
    }

    // 5. Update model_output with new variations
    console.log(`\n\nUpdating model_output with word-level confidence...`);

    const { error: updateError } = await supabase
        .from('model_outputs')
        .update({ variations: updatedVariations })
        .eq('id', modelOutputId);

    if (updateError) {
        console.error('Error updating model_output:', updateError);
        process.exit(1);
    }

    console.log(`✅ Successfully updated model_output ${modelOutputId}`);

    // Show sample
    if (updatedVariations[0]?.words?.length > 0) {
        console.log(`\nSample word-level confidence (first 5 words):`);
        updatedVariations[0].words.slice(0, 5).forEach(w => {
            console.log(`  "${w.word}": ${(w.confidence * 100).toFixed(1)}%`);
        });
    }

    // Cleanup
    fs.unlinkSync(tempPath);
    console.log('\n');
}

// Get model_output ID from command line or use first available
const modelOutputId = process.argv[2];

if (modelOutputId) {
    reprocessModelOutput(modelOutputId);
} else {
    // Find first model_output that needs ranking
    supabase
        .from('model_outputs')
        .select('id')
        .eq('needs_ranking', true)
        .is('ranked_at', null)
        .limit(1)
        .single()
        .then(({ data, error }) => {
            if (error || !data) {
                console.error('No model_outputs found to reprocess');
                process.exit(1);
            }
            reprocessModelOutput(data.id);
        });
}
