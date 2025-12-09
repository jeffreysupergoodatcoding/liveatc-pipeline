import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkSegments() {
    const { data, error } = await supabase
        .from('segments')
        .select('id, transcription_confidence, rlhf_candidate, needs_human_review')
        .order('transcription_confidence', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('\n=== ALL SEGMENTS ===');
    console.log('Total:', data.length);
    console.log('\nHigh Confidence (rlhf_candidate = true):');
    data.filter(s => s.rlhf_candidate).forEach(s => {
        console.log(`  ${s.id.substring(0, 8)}: ${(s.transcription_confidence * 100).toFixed(1)}%`);
    });

    console.log('\nLow Confidence (needs_human_review = true):');
    data.filter(s => s.needs_human_review).forEach(s => {
        console.log(`  ${s.id.substring(0, 8)}: ${(s.transcription_confidence * 100).toFixed(1)}%`);
    });
}

checkSegments().then(() => process.exit(0));
