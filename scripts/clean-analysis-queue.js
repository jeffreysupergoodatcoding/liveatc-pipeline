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
 * Clean Analysis Queue
 * 
 * This script removes segments from the analysis queue (active: true)
 * if they have already been transcribed.
 */

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Cleaning Analysis Queue ===\n');

    // Find all segments that are marked as pending (in queue) but have already been transcribed
    const { data: queuedSegments, error: queryError } = await supabase
        .from('segments')
        .select('id, transcription_confidence, transcription_text, rlhf_candidate, needs_human_review, status')
        .eq('status', 'pending');

    if (queryError) {
        console.error('Error querying segments:', queryError);
        process.exit(1);
    }

    if (!queuedSegments || queuedSegments.length === 0) {
        console.log('✓ Analysis queue is empty.\n');
        process.exit(0);
    }

    console.log(`Found ${queuedSegments.length} segments in the queue\n`);

    // Find which ones have already been transcribed
    const transcribedInQueue = queuedSegments.filter(s =>
        s.transcription_confidence !== null || s.transcription_text !== null
    );

    if (transcribedInQueue.length === 0) {
        console.log('✓ All queued segments are pending transcription.\n');
        console.log(`${queuedSegments.length} segments waiting to be analyzed.`);
        process.exit(0);
    }

    console.log(`Found ${transcribedInQueue.length} segments that have already been transcribed:\n`);

    // Show breakdown
    const highConfidence = transcribedInQueue.filter(s => s.rlhf_candidate === true);
    const lowConfidence = transcribedInQueue.filter(s => s.needs_human_review === true);

    console.log('Breakdown:');
    console.log(`  High Confidence (RLHF): ${highConfidence.length}`);
    console.log(`  Low Confidence (Human Review): ${lowConfidence.length}`);
    console.log('');

    // Update these segments to 'active' status (removes from queue)
    const segmentIds = transcribedInQueue.map(s => s.id);

    console.log(`Removing ${segmentIds.length} analyzed segments from queue...`);
    const { error: updateError } = await supabase
        .from('segments')
        .update({ status: 'active' })
        .in('id', segmentIds);

    if (updateError) {
        console.error('Error updating segments:', updateError);
        process.exit(1);
    }

    console.log(`✓ Successfully removed ${segmentIds.length} segments from queue\n`);

    const remaining = queuedSegments.length - transcribedInQueue.length;
    if (remaining > 0) {
        console.log(`${remaining} segments remain in queue (not yet analyzed)`);
    } else {
        console.log('Analysis queue is now empty.');
    }

    console.log('\n=== Cleanup Complete ===');
    process.exit(0);
}

main();
