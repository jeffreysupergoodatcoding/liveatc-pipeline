import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function getSegment() {
    const { data, error } = await supabase
        .from('segments')
        .select('id, file_path, transcription_confidence')
        .not('file_path', 'is', null)
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Segment ID:', data[0].id);
        console.log('File Path:', data[0].file_path);
        console.log('Current Confidence:', data[0].transcription_confidence);
    } else {
        console.log('No segments found');
    }
}

getSegment();
