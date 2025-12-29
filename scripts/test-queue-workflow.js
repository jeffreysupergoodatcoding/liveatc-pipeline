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

    console.log('=== Testing Complete Queue Workflow ===\n');

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Find a test segment
    console.log('Test 1: Finding test segment...');
    const { data: testSegments, error: findError } = await supabase
        .from('segments')
        .select('id, status, transcription_confidence')
        .eq('status', 'active')
        .limit(1);

    if (findError || !testSegments || testSegments.length === 0) {
        console.log('  ❌ FAILED: No active segments found');
        testsFailed++;
    } else {
        console.log(`  ✅ PASSED: Found segment ${testSegments[0].id}`);
        testsPassed++;
    }

    const testSegment = testSegments[0];

    // Test 2: Add to queue
    console.log('\nTest 2: Adding segment to queue...');
    const { error: queueError } = await supabase
        .from('segments')
        .update({ status: 'pending' })
        .eq('id', testSegment.id);

    if (queueError) {
        console.log(`  ❌ FAILED: ${queueError.message}`);
        testsFailed++;
    } else {
        console.log('  ✅ PASSED: Segment added to queue');
        testsPassed++;
    }

    // Test 3: Verify in queue
    console.log('\nTest 3: Verifying segment appears in queue...');
    const { data: queueCheck, error: checkError } = await supabase
        .from('segments')
        .select('id, status')
        .eq('status', 'pending');

    if (checkError) {
        console.log(`  ❌ FAILED: ${checkError.message}`);
        testsFailed++;
    } else if (!queueCheck.find(s => s.id === testSegment.id)) {
        console.log('  ❌ FAILED: Segment not found in queue');
        testsFailed++;
    } else {
        console.log(`  ✅ PASSED: Queue contains ${queueCheck.length} segment(s)`);
        testsPassed++;
    }

    // Test 4: Simulate analysis (add transcription if missing)
    console.log('\nTest 4: Simulating analysis...');
    if (!testSegment.transcription_confidence) {
        const { error: transcribeError } = await supabase
            .from('segments')
            .update({
                transcription_text: 'Test transcription',
                transcription_confidence: 0.95,
                rlhf_candidate: true,
                needs_human_review: false
            })
            .eq('id', testSegment.id);

        if (transcribeError) {
            console.log(`  ❌ FAILED: ${transcribeError.message}`);
            testsFailed++;
        } else {
            console.log('  ✅ PASSED: Transcription added');
            testsPassed++;
        }
    } else {
        console.log('  ✅ PASSED: Segment already transcribed');
        testsPassed++;
    }

    // Test 5: Remove from queue (change to active)
    console.log('\nTest 5: Removing from queue after analysis...');
    const { error: removeError } = await supabase
        .from('segments')
        .update({ status: 'active' })
        .eq('id', testSegment.id);

    if (removeError) {
        console.log(`  ❌ FAILED: ${removeError.message}`);
        testsFailed++;
    } else {
        console.log('  ✅ PASSED: Status updated to active');
        testsPassed++;
    }

    // Test 6: Verify queue is cleared
    console.log('\nTest 6: Verifying segment removed from queue...');
    const { data: finalCheck, error: finalError } = await supabase
        .from('segments')
        .select('id, status')
        .eq('status', 'pending');

    if (finalError) {
        console.log(`  ❌ FAILED: ${finalError.message}`);
        testsFailed++;
    } else if (finalCheck.find(s => s.id === testSegment.id)) {
        console.log('  ❌ FAILED: Segment still in queue');
        testsFailed++;
    } else {
        console.log(`  ✅ PASSED: Segment removed from queue (${finalCheck.length} remaining)`);
        testsPassed++;
    }

    // Test 7: Verify segment status
    console.log('\nTest 7: Verifying final segment status...');
    const { data: segmentCheck, error: segError } = await supabase
        .from('segments')
        .select('id, status, rlhf_candidate, needs_human_review')
        .eq('id', testSegment.id)
        .single();

    if (segError) {
        console.log(`  ❌ FAILED: ${segError.message}`);
        testsFailed++;
    } else if (segmentCheck.status !== 'active') {
        console.log(`  ❌ FAILED: Status is '${segmentCheck.status}', expected 'active'`);
        testsFailed++;
    } else {
        console.log(`  ✅ PASSED: Status is 'active'`);
        console.log(`     - RLHF Candidate: ${segmentCheck.rlhf_candidate}`);
        console.log(`     - Needs Review: ${segmentCheck.needs_human_review}`);
        testsPassed++;
    }

    // Test 8: Check for orphaned pending segments
    console.log('\nTest 8: Checking for orphaned pending segments...');
    const { data: orphaned, error: orphanError } = await supabase
        .from('segments')
        .select('id, status, transcription_confidence')
        .eq('status', 'pending')
        .not('transcription_confidence', 'is', null);

    if (orphanError) {
        console.log(`  ❌ FAILED: ${orphanError.message}`);
        testsFailed++;
    } else if (orphaned && orphaned.length > 0) {
        console.log(`  ⚠️  WARNING: Found ${orphaned.length} transcribed segments still in queue`);
        console.log('     Run: node scripts/clean-analysis-queue.js');
        testsPassed++;
    } else {
        console.log('  ✅ PASSED: No orphaned segments');
        testsPassed++;
    }

    // Results
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${testsPassed}/8`);
    console.log(`Failed: ${testsFailed}/8`);

    if (testsFailed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Queue system is working correctly.');
    } else {
        console.log('\n❌ SOME TESTS FAILED. Please review the errors above.');
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

main();
