#!/usr/bin/env node

/**
 * Script to check segment and model_outputs status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSegment(segmentId) {
    console.log(`\nChecking segment: ${segmentId}\n`);

    // Fetch segment
    const { data: segment, error: segmentError } = await supabase
        .from('segments')
        .select('*')
        .eq('id', segmentId)
        .single();

    if (segmentError || !segment) {
        console.error('Error fetching segment:', segmentError);
        process.exit(1);
    }

    console.log('Segment Info:');
    console.log(`  Status: ${segment.status}`);
    console.log(`  Confidence: ${segment.transcription_confidence ? (segment.transcription_confidence * 100).toFixed(1) + '%' : 'Not set'}`);
    console.log(`  RLHF Candidate: ${segment.rlhf_candidate}`);
    console.log(`  Needs Human Review: ${segment.needs_human_review}`);

    // Fetch model outputs
    const { data: modelOutputs, error: outputsError } = await supabase
        .from('model_outputs')
        .select('*')
        .eq('segment_id', segmentId);

    console.log(`\nModel Outputs:`);
    if (outputsError) {
        console.error('  Error:', outputsError);
    } else if (!modelOutputs || modelOutputs.length === 0) {
        console.log('  ❌ No model outputs found');
    } else {
        console.log(`  ✓ Found ${modelOutputs.length} record(s)`);
        modelOutputs.forEach((output, i) => {
            console.log(`\n  Record ${i + 1}:`);
            console.log(`    ID: ${output.id}`);
            console.log(`    Created: ${output.created_at}`);
            console.log(`    Needs Ranking: ${output.needs_ranking}`);
            if (output.variations && Array.isArray(output.variations)) {
                console.log(`    Variations: ${output.variations.length}`);
                output.variations.forEach((v, j) => {
                    console.log(`      ${j + 1}. ${v.model} (${(v.confidence * 100).toFixed(1)}%): ${v.text?.substring(0, 60)}...`);
                });
            }
        });
    }
}

const segmentId = process.argv[2] || 'a6eedd69-e4c9-41b8-92f1-66709191a001';
checkSegment(segmentId);
