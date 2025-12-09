import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkAudioFiles() {
    const { data, error } = await supabase
        .from('segments')
        .select('id, file_path, duration_seconds')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('\n=== CHECKING AUDIO FILES ===');
    console.log('Total segments:', data.length);

    const missingPath = data.filter(s => !s.file_path);
    const zeroDuration = data.filter(s => !s.duration_seconds || s.duration_seconds === 0);

    console.log('\nSegments with missing file_path:', missingPath.length);
    if (missingPath.length > 0) {
        missingPath.forEach(s => {
            console.log(`  ${s.id.substring(0, 8)}: file_path = ${s.file_path}`);
        });
    }

    console.log('\nSegments with zero/null duration:', zeroDuration.length);
    if (zeroDuration.length > 0) {
        zeroDuration.forEach(s => {
            console.log(`  ${s.id.substring(0, 8)}: duration = ${s.duration_seconds}, path = ${s.file_path}`);
        });
    }

    // Test a few signed URLs
    console.log('\n=== TESTING SIGNED URLs ===');
    for (const segment of data.slice(0, 3)) {
        if (segment.file_path) {
            const { data: urlData, error: urlError } = await supabase.storage
                .from('liveatc-segments')
                .createSignedUrl(segment.file_path, 3600);

            if (urlError) {
                console.log(`❌ ${segment.id.substring(0, 8)}: ${urlError.message}`);
            } else {
                console.log(`✅ ${segment.id.substring(0, 8)}: URL generated`);
            }
        }
    }
}

checkAudioFiles().then(() => process.exit(0));
