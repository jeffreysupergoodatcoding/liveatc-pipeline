#!/usr/bin/env node

/**
 * Script to check raw database JSON structure
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

async function checkRawJSON() {
    const { data, error } = await supabase
        .from('model_outputs')
        .select('id, variations')
        .eq('needs_ranking', true)
        .is('ranked_at', null)
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('\n=== Raw Database JSON ===\n');
    console.log('Model Output ID:', data.id);
    console.log('\nVariations (stringified):');
    console.log(JSON.stringify(data.variations, null, 2));

    console.log('\n\nFirst variation structure:');
    const firstVar = data.variations[0];
    console.log('Keys:', Object.keys(firstVar));
    console.log('Has words:', 'words' in firstVar);
    console.log('Words value:', firstVar.words);
    console.log('Words type:', typeof firstVar.words);

    if (firstVar.words) {
        console.log('Words length:', firstVar.words.length);
        console.log('First word:', firstVar.words[0]);
    }
}

checkRawJSON();
