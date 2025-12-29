#!/usr/bin/env node

/**
 * Check trim status of labeled segments
 * Shows which segments have trimmed files and which don't
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkTrimStatus() {
    console.log('🔍 Checking trim status of labeled segments...\n');

    // Fetch labeled segments with their trim info
    const { data: segments, error } = await supabase
        .from('segments')
        .select(`
            id,
            segment_index,
            file_path,
            trimmed_file_path,
            duration_seconds,
            recordings (
                airport,
                facility,
                recorded_at
            )
        `)
        .gt('label_count', 0)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('❌ Error fetching segments:', error);
        return;
    }

    console.log(`Found ${segments.length} labeled segments\n`);
    console.log('═══════════════════════════════════════════════════════════════════');

    for (const segment of segments) {
        const rec = segment.recordings;
        const label = `${rec?.airport} - ${rec?.facility} • Segment #${segment.segment_index + 1}`;

        console.log(`\n📎 ${label}`);
        console.log(`   ID: ${segment.id}`);
        console.log(`   Duration: ${segment.duration_seconds?.toFixed(1)}s`);
        console.log(`   Original: ${segment.file_path}`);
        console.log(`   Trimmed:  ${segment.trimmed_file_path || '❌ NOT SET'}`);

        // Check if trimmed file exists
        if (segment.trimmed_file_path) {
            const { data: fileData, error: fileError } = await supabase
                .storage
                .from('liveatc-segments')
                .download(segment.trimmed_file_path);

            if (fileError) {
                console.log(`   ⚠️  Trimmed file NOT FOUND in storage!`);
            } else {
                const sizeKB = (await fileData.arrayBuffer()).byteLength / 1024;
                console.log(`   ✅ Trimmed file exists (${sizeKB.toFixed(1)} KB)`);
            }
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');

    // Summary
    const withTrim = segments.filter(s => s.trimmed_file_path).length;

    console.log(`\n📊 Summary:`);
    console.log(`   Total labeled: ${segments.length}`);
    console.log(`   With trimmed_file_path: ${withTrim}`);
}

checkTrimStatus()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
