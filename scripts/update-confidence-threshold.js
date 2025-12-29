#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Update Confidence Threshold Migration Script
 * 
 * This script updates existing segments to match the new 90% confidence threshold.
 * Segments with confidence between 85-89% will be moved from high confidence (RLHF)
 * to low confidence (human review).
 */

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Updating Confidence Threshold ===\n');

    // Get the new threshold from environment or default to 0.90
    const newThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD_RLHF || '0.90');
    console.log(`New threshold: ${newThreshold * 100}%\n`);

    // Find all segments that are currently marked as RLHF candidates
    // but have confidence below the new threshold
    const { data: affectedSegments, error: queryError } = await supabase
        .from('segments')
        .select('id, transcription_confidence, rlhf_candidate, needs_human_review, status')
        .eq('rlhf_candidate', true)
        .lt('transcription_confidence', newThreshold);

    if (queryError) {
        console.error('Error querying segments:', queryError);
        process.exit(1);
    }

    if (!affectedSegments || affectedSegments.length === 0) {
        console.log('✓ No segments need to be updated.');
        console.log('All RLHF candidates already meet the new threshold.\n');
        process.exit(0);
    }

    console.log(`Found ${affectedSegments.length} segments to update:\n`);

    // Show summary
    const confidenceRanges = {
        '85-87%': affectedSegments.filter(s => s.transcription_confidence >= 0.85 && s.transcription_confidence < 0.87).length,
        '87-89%': affectedSegments.filter(s => s.transcription_confidence >= 0.87 && s.transcription_confidence < 0.89).length,
        '89-90%': affectedSegments.filter(s => s.transcription_confidence >= 0.89 && s.transcription_confidence < 0.90).length,
    };

    console.log('Confidence distribution of affected segments:');
    Object.entries(confidenceRanges).forEach(([range, count]) => {
        if (count > 0) {
            console.log(`  ${range}: ${count} segments`);
        }
    });
    console.log('');

    // Update these segments to be human review candidates instead
    const segmentIds = affectedSegments.map(s => s.id);

    console.log('Updating segments...');
    const { error: updateError } = await supabase
        .from('segments')
        .update({
            rlhf_candidate: false,
            needs_human_review: true,
            status: 'needs_human_review'
        })
        .in('id', segmentIds);

    if (updateError) {
        console.error('Error updating segments:', updateError);
        process.exit(1);
    }

    console.log(`✓ Successfully updated ${affectedSegments.length} segments\n`);

    console.log('Summary:');
    console.log(`  Moved from: High Confidence (RLHF)`);
    console.log(`  Moved to: Low Confidence (Human Review)`);
    console.log(`  Reason: Confidence below new ${newThreshold * 100}% threshold\n`);

    console.log('=== Migration Complete ===');
    process.exit(0);
}

main();
