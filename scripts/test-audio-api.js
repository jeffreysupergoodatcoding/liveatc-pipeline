import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function testAudioApi() {
    const segmentId = 'c27718f1-4749-403a-879d-b51457bf2f7b'; // Segment #5

    console.log('Testing DB and Audio API logic for Segment:', segmentId);

    // 1. Direct DB Check
    const { data: segment, error } = await supabase
        .from('segments')
        .select('file_path, trimmed_file_path')
        .eq('id', segmentId)
        .single();

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log('\n--- DB State ---');
    console.log('Original Path:', segment.file_path);
    console.log('Trimmed Path:', segment.trimmed_file_path);

    // 2. Simulate API Logic
    const filePath = segment.trimmed_file_path || segment.file_path;
    console.log('\n--- API Logic Verification ---');
    console.log('API would select:', filePath);

    if (filePath === segment.trimmed_file_path) {
        console.log('✅ API selects TRIMMED file');
    } else {
        console.log('❌ API selects ORIGINAL file (Trim missing or logic error)');
    }

    // 3. Check Storage
    const { data: fileData, error: fileError } = await supabase.storage
        .from('liveatc-segments')
        .createSignedUrl(filePath, 60);

    if (fileData) {
        console.log('Storage URL generated:', fileData.signedUrl.substring(0, 50) + '...');
    } else {
        console.error('Storage Error:', fileError);
    }
}

testAudioApi();
