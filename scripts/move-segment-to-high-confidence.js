#!/usr/bin/env node

/**
 * Script to manually move a segment from low confidence to high confidence
 * Usage: node scripts/move-segment-to-high-confidence.js <segment-id>
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function moveSegmentToHighConfidence(segmentId) {
    console.log(`Moving segment ${segmentId} to high confidence...`);

    // First, fetch the segment to see its current state
    const { data: segment, error: fetchError } = await supabase
        .from('segments')
        .select('*')
        .eq('id', segmentId)
        .single();

    if (fetchError || !segment) {
        console.error('Error fetching segment:', fetchError);
        process.exit(1);
    }

    console.log('\nCurrent segment state:');
    console.log(`  Confidence: ${segment.transcription_confidence ? (segment.transcription_confidence * 100).toFixed(1) + '%' : 'Not set'}`);
    console.log(`  RLHF Candidate: ${segment.rlhf_candidate}`);
    console.log(`  Needs Human Review: ${segment.needs_human_review}`);
    console.log(`  Status: ${segment.status}`);

    // Update the segment to be high confidence
    const { error: updateError } = await supabase
        .from('segments')
        .update({
            rlhf_candidate: true,
            needs_human_review: false
        })
        .eq('id', segmentId);

    if (updateError) {
        console.error('Error updating segment:', updateError);
        process.exit(1);
    }

    console.log('\n✅ Segment successfully moved to high confidence (RLHF)');
    console.log('  rlhf_candidate: true');
    console.log('  needs_human_review: false');
}

// Get segment ID from command line arguments
const segmentId = process.argv[2];

if (!segmentId) {
    console.error('Usage: node move-segment-to-high-confidence.js <segment-id>');
    process.exit(1);
}

moveSegmentToHighConfidence(segmentId);
