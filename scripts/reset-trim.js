#!/usr/bin/env node

/**
 * Reset trim for specific segments
 * This clears the trimmed_file_path so the segment can be re-trimmed
 * 
 * Usage: node scripts/reset-trim.js <segment_id> [segment_id2] ...
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function resetTrim(segmentIds) {
    console.log(`🔄 Resetting trim for ${segmentIds.length} segment(s)...\n`);

    for (const id of segmentIds) {
        // Get current segment info
        const { data: segment, error: fetchError } = await supabase
            .from('segments')
            .select('id, segment_index, file_path, trimmed_file_path, recordings(airport, facility)')
            .eq('id', id)
            .single();

        if (fetchError || !segment) {
            console.log(`❌ Segment ${id} not found`);
            continue;
        }

        const rec = segment.recordings;
        console.log(`📎 ${rec?.airport} - ${rec?.facility} • Segment #${segment.segment_index + 1}`);
        console.log(`   Current trimmed_file_path: ${segment.trimmed_file_path || 'NOT SET'}`);

        if (!segment.trimmed_file_path) {
            console.log(`   ⚠️  Already not trimmed, skipping\n`);
            continue;
        }

        // Clear the trimmed_file_path
        const { error: updateError } = await supabase
            .from('segments')
            .update({
                trimmed_file_path: null,
                remove_regions: null
            })
            .eq('id', id);

        if (updateError) {
            console.log(`   ❌ Failed to reset: ${updateError.message}\n`);
        } else {
            console.log(`   ✅ Reset! Segment will now use original file.\n`);
        }
    }

    console.log('Done! You can now re-trim these segments in the admin UI.');
}

// Get segment IDs from command line
const segmentIds = process.argv.slice(2);

if (segmentIds.length === 0) {
    console.log('Usage: node scripts/reset-trim.js <segment_id> [segment_id2] ...');
    console.log('\nExample:');
    console.log('  node scripts/reset-trim.js 3e824a8f-71b0-4779-823a-b283aa1a0a48');
    process.exit(1);
}

resetTrim(segmentIds)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
