#!/usr/bin/env node

/**
 * Script to check if word-level data exists in database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWordData() {
    console.log('\n=== Checking Word-Level Data in Database ===\n');

    const { data: modelOutputs, error } = await supabase
        .from('model_outputs')
        .select('id, variations')
        .eq('needs_ranking', true)
        .is('ranked_at', null)
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching model_output:', error);
        process.exit(1);
    }

    console.log(`Model Output ID: ${modelOutputs.id}\n`);
    console.log('Variations structure:');

    const variations = modelOutputs.variations;

    variations.forEach((v, i) => {
        console.log(`\n${i + 1}. ${v.model}:`);
        console.log(`   Text: "${v.text.substring(0, 50)}..."`);
        console.log(`   Confidence: ${(v.confidence * 100).toFixed(1)}%`);
        console.log(`   Has 'words' property: ${v.hasOwnProperty('words')}`);
        console.log(`   Words type: ${typeof v.words}`);
        console.log(`   Words is array: ${Array.isArray(v.words)}`);
        console.log(`   Words length: ${v.words ? v.words.length : 'N/A'}`);

        if (v.words && v.words.length > 0) {
            console.log(`   Sample words (first 3):`);
            v.words.slice(0, 3).forEach((w, j) => {
                console.log(`      ${j + 1}. "${w.word}": ${(w.confidence * 100).toFixed(1)}%`);
            });
        } else {
            console.log(`   ⚠️  No words data!`);
        }
    });

    console.log('\n');
}

checkWordData();
