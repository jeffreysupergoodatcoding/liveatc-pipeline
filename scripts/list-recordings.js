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
  process.env.SUPABASE_KEY
);

async function listRecordings() {
  console.log('Fetching recordings from Supabase...\n');

  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('No recordings found.');
    return;
  }

  console.log(`Found ${data.length} recording(s):\n`);

  for (const rec of data) {
    console.log(`ID: ${rec.id}`);
    console.log(`Airport: ${rec.airport}`);
    console.log(`Facility: ${rec.facility}`);
    console.log(`Duration: ${rec.duration_seconds}s`);
    console.log(`Status: ${rec.status}`);
    console.log(`Recorded: ${new Date(rec.recorded_at).toLocaleString()}`);
    console.log(`File: ${rec.raw_file_path}`);
    console.log('─'.repeat(60));
  }
}

listRecordings();
