import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkCORS() {
    console.log('\n=== CHECKING SUPABASE STORAGE CORS ===\n');

    console.log('Supabase URL:', process.env.SUPABASE_URL);
    console.log('\nTo fix CORS issues:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to Storage > Configuration');
    console.log('3. Add CORS policy for localhost:3000');
    console.log('\nOr use Supabase CLI:');
    console.log('supabase storage update liveatc-segments --cors-allowed-origins="http://localhost:3000"');

    // Test if we can get a public URL
    const { data: segments } = await supabase
        .from('segments')
        .select('file_path')
        .limit(1)
        .single();

    if (segments) {
        console.log('\n=== TESTING SIGNED URL ===');
        const { data, error } = await supabase.storage
            .from('liveatc-segments')
            .createSignedUrl(segments.file_path, 3600);

        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Signed URL generated:', data.signedUrl);
            console.log('\nTry opening this URL in your browser:');
            console.log(data.signedUrl);
        }
    }
}

checkCORS().then(() => process.exit(0));
