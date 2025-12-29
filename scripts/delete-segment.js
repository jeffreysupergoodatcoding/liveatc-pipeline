#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function deleteSegment() {
    // Find KIAH - twr • Segment #9
    const { data: segments, error: findError } = await supabase
        .from('segments')
        .select(`
            id,
            segment_index,
            recordings (
                airport,
                facility
            )
        `)
        .eq('segment_index', 8); // segment_index is 0-based, so #9 is index 8

    if (findError) {
        console.error('Error finding segment:', findError);
        return;
    }

    // Filter for KIAH twr
    const target = segments.find(s =>
        s.recordings?.airport === 'KIAH' &&
        s.recordings?.facility === 'twr'
    );

    if (!target) {
        console.log('❌ Could not find KIAH - twr • Segment #9');
        return;
    }

    console.log(`\n📍 Found segment:`);
    console.log(`   ID: ${target.id}`);
    console.log(`   ${target.recordings.airport} - ${target.recordings.facility} • Segment #${target.segment_index + 1}`);

    // Delete the segment (will cascade delete labels)
    const { error: deleteError } = await supabase
        .from('segments')
        .delete()
        .eq('id', target.id);

    if (deleteError) {
        console.error('❌ Error deleting segment:', deleteError);
        return;
    }

    console.log('\n✅ Segment and associated labels deleted successfully!');
}

deleteSegment()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
