#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const recordingId = process.argv[2];

if (!recordingId) {
    console.error('Usage: node get-segments.js <recording-id>');
    process.exit(1);
}

const { data, error } = await supabase
    .from('segments')
    .select('id, segment_index, duration_seconds')
    .eq('recording_id', recordingId)
    .order('segment_index');

if (error) {
    console.error('Error:', error);
    process.exit(1);
}

console.log(`Found ${data.length} segments:`);
data.forEach(seg => {
    console.log(`  ${seg.id} (index ${seg.segment_index}, ${seg.duration_seconds.toFixed(2)}s)`);
});
