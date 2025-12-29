import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function fixLabeledSegments() {
    console.log('Finding segments with labels that still need human review...');

    // Get all segments that have labels (label_count > 0) but still flagged for human review
    const { data: segments, error: fetchError } = await supabase
        .from('segments')
        .select('id, label_count, needs_human_review')
        .gt('label_count', 0)
        .eq('needs_human_review', true);

    if (fetchError) {
        console.error('Error fetching segments:', fetchError);
        return;
    }

    console.log(`Found ${segments.length} segments with labels that are still flagged for human review`);

    if (segments.length === 0) {
        console.log('✓ All labeled segments are correctly marked!');
        return;
    }

    // Update all of them to needs_human_review = false
    const segmentIds = segments.map(s => s.id);

    const { error: updateError } = await supabase
        .from('segments')
        .update({ needs_human_review: false })
        .in('id', segmentIds);

    if (updateError) {
        console.error('Error updating segments:', updateError);
        return;
    }

    console.log(`✓ Updated ${segments.length} segments to remove needs_human_review flag`);
    console.log('Done!');
}

fixLabeledSegments();
