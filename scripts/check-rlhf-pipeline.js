#!/usr/bin/env node

/**
 * Script to check RLHF pipeline status
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

async function checkRLHFPipeline() {
    console.log('\n=== RLHF Pipeline Status ===\n');

    // 1. Check high confidence segments
    const { data: highConfSegments, error: segError } = await supabase
        .from('segments')
        .select('id, transcription_confidence, status, rlhf_candidate')
        .eq('rlhf_candidate', true)
        .order('created_at', { ascending: false });

    if (segError) {
        console.error('Error fetching segments:', segError);
    } else {
        console.log(`📊 High Confidence Segments (rlhf_candidate = true): ${highConfSegments.length}`);
        const needsRanking = highConfSegments.filter(s => s.status === 'needs_ranking');
        console.log(`   - Status = 'needs_ranking': ${needsRanking.length}`);
    }

    // 2. Check model_outputs
    const { data: modelOutputs, error: outputError } = await supabase
        .from('model_outputs')
        .select('id, segment_id, needs_ranking, ranked_at, variations')
        .order('created_at', { ascending: false });

    if (outputError) {
        console.error('Error fetching model_outputs:', outputError);
    } else {
        console.log(`\n📝 Model Outputs (total): ${modelOutputs.length}`);
        const needsRanking = modelOutputs.filter(m => m.needs_ranking === true && m.ranked_at === null);
        const ranked = modelOutputs.filter(m => m.ranked_at !== null);
        console.log(`   - Needs ranking (needs_ranking=true, ranked_at=null): ${needsRanking.length}`);
        console.log(`   - Already ranked (ranked_at IS NOT NULL): ${ranked.length}`);

        if (needsRanking.length > 0) {
            console.log('\n   📋 Segments ready for ranking:');
            needsRanking.slice(0, 5).forEach((m, i) => {
                const varCount = m.variations ? m.variations.length : 0;
                console.log(`      ${i + 1}. Segment: ${m.segment_id.substring(0, 8)}... (${varCount} variations)`);
            });
            if (needsRanking.length > 5) {
                console.log(`      ... and ${needsRanking.length - 5} more`);
            }
        }
    }

    // 3. Check preference_pairs
    const { data: prefPairs, error: prefError } = await supabase
        .from('preference_pairs')
        .select('id, segment_id, source, created_at')
        .eq('source', 'rlhf')
        .order('created_at', { ascending: false });

    if (prefError) {
        console.error('Error fetching preference_pairs:', prefError);
    } else {
        console.log(`\n💎 Preference Pairs (source='rlhf'): ${prefPairs.length}`);
        if (prefPairs.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayPairs = prefPairs.filter(p => new Date(p.created_at) >= today);
            console.log(`   - Created today: ${todayPairs.length}`);
        }
    }

    console.log('\n=== Summary ===');
    const readyForRanking = modelOutputs?.filter(m => m.needs_ranking === true && m.ranked_at === null).length || 0;
    const totalRanked = modelOutputs?.filter(m => m.ranked_at !== null).length || 0;
    const totalPairs = prefPairs?.length || 0;

    console.log(`✅ ${readyForRanking} segments ready for human ranking`);
    console.log(`✅ ${totalRanked} segments already ranked`);
    console.log(`✅ ${totalPairs} preference pairs created for RLHF training`);

    if (readyForRanking === 0) {
        console.log('\n⚠️  No segments ready for ranking. Process more high-confidence segments to generate variants.');
    } else {
        console.log(`\n🎯 Visit /rank-outputs to start ranking!`);
    }

    console.log('');
}

checkRLHFPipeline();
