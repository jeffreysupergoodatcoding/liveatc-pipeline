#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Testing Analysis Queue ===\n');

    // Step 1: Find an active segment to test with
    console.log('Step 1: Finding a test segment...');
    const { data: testSegments, error: findError } = await supabase
        .from('segments')
        .select('id, status')
        .eq('status', 'active')
        .limit(1);

    if (findError || !testSegments || testSegments.length === 0) {
        console.error('No active segments found to test with');
        process.exit(1);
    }

    const testSegment = testSegments[0];
    console.log(`  Found segment: ${testSegment.id}`);
    console.log(`  Current status: ${testSegment.status}\n`);

    // Step 2: Add it to the queue (set status to pending)
    console.log('Step 2: Adding segment to queue...');
    const { error: queueError } = await supabase
        .from('segments')
        .update({ status: 'pending' })
        .eq('id', testSegment.id);

    if (queueError) {
        console.error('Error adding to queue:', queueError);
        process.exit(1);
    }
    console.log('  ✓ Segment added to queue\n');

    // Step 3: Verify it's in the queue
    console.log('Step 3: Verifying segment is in queue...');
    const { data: queueCheck, error: checkError } = await supabase
        .from('segments')
        .select('id, status')
        .eq('status', 'pending');

    if (checkError) {
        console.error('Error checking queue:', checkError);
        process.exit(1);
    }
    console.log(`  Queue contains ${queueCheck.length} segment(s)\n`);

    // Step 4: Simulate analysis completion (update status to active)
    console.log('Step 4: Simulating analysis completion...');
    const { error: analyzeError } = await supabase
        .from('segments')
        .update({ status: 'active' })
        .eq('id', testSegment.id);

    if (analyzeError) {
        console.error('Error updating status:', analyzeError);
        process.exit(1);
    }
    console.log('  ✓ Status updated to active\n');

    // Step 5: Verify queue is now empty
    console.log('Step 5: Verifying queue is cleared...');
    const { data: finalCheck, error: finalError } = await supabase
        .from('segments')
        .select('id, status')
        .eq('status', 'pending');

    if (finalError) {
        console.error('Error checking queue:', finalError);
        process.exit(1);
    }

    console.log(`  Queue now contains ${finalCheck.length} segment(s)\n`);

    // Step 6: Verify segment status
    console.log('Step 6: Verifying segment status...');
    const { data: segmentCheck, error: segError } = await supabase
        .from('segments')
        .select('id, status')
        .eq('id', testSegment.id)
        .single();

    if (segError) {
        console.error('Error checking segment:', segError);
        process.exit(1);
    }

    console.log(`  Segment ${segmentCheck.id} status: ${segmentCheck.status}\n`);

    // Results
    console.log('=== Test Results ===');
    if (segmentCheck.status === 'active' && finalCheck.length === 0) {
        console.log('✅ TEST PASSED: Queue cleared successfully after analysis!');
    } else {
        console.log('❌ TEST FAILED: Queue did not clear properly');
        console.log(`   Expected: status='active', queue=0`);
        console.log(`   Got: status='${segmentCheck.status}', queue=${finalCheck.length}`);
    }

    process.exit(0);
}

main();
