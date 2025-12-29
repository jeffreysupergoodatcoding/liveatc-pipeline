#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkSegments() {
    // Get all low confidence segments
    const { data, error } = await supabase
        .from('segments')
        .select('id, transcription_text, transcription_confidence, needs_human_review')
        .eq('needs_human_review', true)
        .order('transcription_confidence', { ascending: true })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} low confidence segments:\n`);

    data.forEach((seg, i) => {
        console.log(`${i + 1}. ID: ${seg.id.substring(0, 8)}...`);
        console.log(`   Confidence: ${((seg.transcription_confidence || 0) * 100).toFixed(1)}%`);
        console.log(`   Has transcription: ${seg.transcription_text ? 'YES' : 'NO'}`);
        if (seg.transcription_text) {
            console.log(`   Text: ${seg.transcription_text.substring(0, 80)}...`);
        }
        console.log('');
    });
}

checkSegments();
