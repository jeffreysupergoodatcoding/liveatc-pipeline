#!/usr/bin/env node

/**
 * Script to find and remove duplicate model_outputs
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

async function findAndRemoveDuplicates() {
    console.log('\n=== Finding Duplicate Model Outputs ===\n');

    // Fetch all model_outputs
    const { data: modelOutputs, error } = await supabase
        .from('model_outputs')
        .select('id, segment_id, created_at, needs_ranking, ranked_at')
        .order('segment_id', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching model_outputs:', error);
        process.exit(1);
    }

    console.log(`Total model_outputs: ${modelOutputs.length}\n`);

    // Group by segment_id
    const bySegment = new Map();
    modelOutputs.forEach(output => {
        if (!bySegment.has(output.segment_id)) {
            bySegment.set(output.segment_id, []);
        }
        bySegment.get(output.segment_id).push(output);
    });

    // Find duplicates
    const duplicates = [];
    bySegment.forEach((outputs, segmentId) => {
        if (outputs.length > 1) {
            console.log(`\n🔍 Found ${outputs.length} outputs for segment: ${segmentId.substring(0, 8)}...`);
            outputs.forEach((output, i) => {
                console.log(`   ${i + 1}. ID: ${output.id.substring(0, 8)}... | Created: ${output.created_at} | Needs Ranking: ${output.needs_ranking} | Ranked: ${output.ranked_at ? 'Yes' : 'No'}`);
            });

            // Keep the first one (oldest), mark others for deletion
            const toDelete = outputs.slice(1);
            duplicates.push(...toDelete);
        }
    });

    if (duplicates.length === 0) {
        console.log('\n✅ No duplicates found!');
        return;
    }

    console.log(`\n\n⚠️  Found ${duplicates.length} duplicate(s) to delete:`);
    duplicates.forEach(dup => {
        console.log(`   - ${dup.id} (segment: ${dup.segment_id.substring(0, 8)}...)`);
    });

    // Delete duplicates
    console.log('\n🗑️  Deleting duplicates...');
    const idsToDelete = duplicates.map(d => d.id);

    const { error: deleteError } = await supabase
        .from('model_outputs')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('Error deleting duplicates:', deleteError);
        process.exit(1);
    }

    console.log(`\n✅ Successfully deleted ${duplicates.length} duplicate(s)!`);

    // Verify
    const { data: remaining, error: verifyError } = await supabase
        .from('model_outputs')
        .select('id, segment_id')
        .order('created_at', { ascending: true });

    if (verifyError) {
        console.error('Error verifying:', verifyError);
    } else {
        console.log(`\n📊 Remaining model_outputs: ${remaining.length}`);

        // Check for any remaining duplicates
        const segmentCounts = new Map();
        remaining.forEach(r => {
            segmentCounts.set(r.segment_id, (segmentCounts.get(r.segment_id) || 0) + 1);
        });

        const stillDuplicated = Array.from(segmentCounts.entries()).filter(([_, count]) => count > 1);
        if (stillDuplicated.length > 0) {
            console.log('\n⚠️  Still have duplicates:');
            stillDuplicated.forEach(([segId, count]) => {
                console.log(`   - ${segId.substring(0, 8)}...: ${count} outputs`);
            });
        } else {
            console.log('✅ All duplicates removed - each segment now has exactly 1 model_output!\n');
        }
    }
}

findAndRemoveDuplicates();
