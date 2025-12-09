import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkStorageFiles() {
    console.log('\n=== CHECKING STORAGE FILES ===');

    // List all files in the bucket
    const { data: files, error } = await supabase.storage
        .from('liveatc-segments')
        .list('', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' }
        });

    if (error) {
        console.error('Error listing files:', error);
        return;
    }

    console.log('Folders in storage:', files.length);

    // List files in each folder
    for (const folder of files.filter(f => f.id)) {
        const { data: segments, error: segError } = await supabase.storage
            .from('liveatc-segments')
            .list(folder.name, {
                limit: 100
            });

        if (!segError && segments) {
            console.log(`\n${folder.name}: ${segments.length} files`);
            segments.forEach(s => {
                console.log(`  - ${s.name} (${(s.metadata?.size / 1024).toFixed(1)} KB)`);
            });
        }
    }

    // Check if specific segments exist
    console.log('\n=== CHECKING SPECIFIC SEGMENTS ===');
    const testPaths = [
        'kjfk_twr2_20251119_183149/seg_001.mp3',
        'kjfk_twr2_20251119_183149/seg_002.mp3',
        'kjfk_twr2_20251124_175439/seg_001.mp3'
    ];

    for (const path of testPaths) {
        const { data, error } = await supabase.storage
            .from('liveatc-segments')
            .download(path);

        if (error) {
            console.log(`❌ ${path}: ${error.message}`);
        } else {
            const size = data.size;
            console.log(`✅ ${path}: ${(size / 1024).toFixed(1)} KB`);
        }
    }
}

checkStorageFiles().then(() => process.exit(0));
