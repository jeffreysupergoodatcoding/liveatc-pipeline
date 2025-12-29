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

    console.log('=== Clearing Analysis Queue ===\n');

    // Get all pending segments
    const { data: pendingSegments, error: queryError } = await supabase
        .from('segments')
        .select('id')
        .eq('status', 'pending');

    if (queryError) {
        console.error('Error querying segments:', queryError);
        process.exit(1);
    }

    if (!pendingSegments || pendingSegments.length === 0) {
        console.log('✓ Queue is already empty.\n');
        process.exit(0);
    }

    console.log(`Found ${pendingSegments.length} segments in queue\n`);
    console.log('Clearing all segments from queue...');

    // Update all to 'active' status
    const { error: updateError } = await supabase
        .from('segments')
        .update({ status: 'active' })
        .eq('status', 'pending');

    if (updateError) {
        console.error('Error updating segments:', updateError);
        process.exit(1);
    }

    console.log(`✓ Successfully cleared ${pendingSegments.length} segments from queue\n`);
    console.log('=== Queue Cleared ===');
    process.exit(0);
}

main();
