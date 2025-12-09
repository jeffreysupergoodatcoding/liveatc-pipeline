import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
    console.log('\n=== CHECKING SEGMENTS TABLE SCHEMA ===\n');

    // Get a sample segment to see its fields
    const { data, error } = await supabase
        .from('segments')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Available columns in segments table:');
    Object.keys(data).sort().forEach(key => {
        console.log(`  - ${key}: ${typeof data[key]}`);
    });

    // Check if manual_transcription column exists
    if ('manual_transcription' in data) {
        console.log('\n✅ manual_transcription column exists');
    } else {
        console.log('\n❌ manual_transcription column does NOT exist - need to add it');
    }
}

checkSchema().then(() => process.exit(0));
