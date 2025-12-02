#!/usr/bin/env node

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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
DROP VIEW IF EXISTS edge_case_statistics;

CREATE VIEW edge_case_statistics AS
SELECT
    COUNT(*) as total_segments,
    COUNT(*) FILTER (WHERE transcription IS NOT NULL) as transcribed_segments,
    COUNT(*) FILTER (WHERE flagged = TRUE) as flagged_segments,
    COUNT(*) FILTER (WHERE reviewed = TRUE) as reviewed_segments,
    AVG(edge_case_score) FILTER (WHERE edge_case_score IS NOT NULL) as avg_edge_case_score,
    AVG(transcription_confidence) FILTER (WHERE transcription_confidence IS NOT NULL) as avg_transcription_confidence,
    (SELECT COUNT(DISTINCT case_id) FROM edge_case_matches) as unique_edge_cases_detected
FROM segments;
`;

console.log('Fixing edge_case_statistics view...');
console.log('');
console.log('⚠️  This script cannot execute DDL statements via the Supabase client.');
console.log('');
console.log('Please apply this migration manually:');
console.log('');
console.log('1. Go to: https://supabase.com/dashboard/project/wqppszoyvtqauthbvtgc/sql');
console.log('2. Paste the following SQL:');
console.log('');
console.log('==================================================');
console.log(sql);
console.log('==================================================');
console.log('');
console.log('3. Click "Run"');
console.log('');
