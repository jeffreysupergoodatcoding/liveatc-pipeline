#!/usr/bin/env node

/**
 * Pipeline Status Check
 * Verifies all components of the LiveATC pipeline are working
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('🔍 LiveATC Pipeline Status Check\n');
console.log('='.repeat(60));

// Check 1: Environment Variables
console.log('\n📋 Environment Variables:');
const requiredEnvVars = [
    'DEEPGRAM_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'LIVEATC_FEEDS'
];

let envOk = true;
for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
        if (envVar === 'LIVEATC_FEEDS') {
            try {
                const feeds = JSON.parse(value);
                console.log(`   ✅ ${envVar}: ${feeds.length} feeds configured`);
            } catch {
                console.log(`   ❌ ${envVar}: Invalid JSON`);
                envOk = false;
            }
        } else {
            console.log(`   ✅ ${envVar}: Set`);
        }
    } else {
        console.log(`   ❌ ${envVar}: Not set`);
        envOk = false;
    }
}

// Check 2: Database Connection
console.log('\n🗄️  Database Connection:');
try {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
        .from('recordings')
        .select('id')
        .limit(1);

    if (error) {
        console.log(`   ❌ Database connection failed: ${error.message}`);
    } else {
        console.log('   ✅ Database connection successful');
    }

    // Check tables exist
    const tables = ['recordings', 'segments', 'segment_labels', 'model_outputs'];
    for (const table of tables) {
        const { error: tableError } = await supabase
            .from(table)
            .select('id')
            .limit(1);

        if (tableError && tableError.code !== 'PGRST116') {
            console.log(`   ❌ Table '${table}': ${tableError.message}`);
        } else {
            console.log(`   ✅ Table '${table}': Exists`);
        }
    }

    // Check data counts
    console.log('\n📊 Data Statistics:');

    const { count: recordingCount } = await supabase
        .from('recordings')
        .select('id', { count: 'exact', head: true });
    console.log(`   📼 Recordings: ${recordingCount || 0}`);

    const { count: segmentCount } = await supabase
        .from('segments')
        .select('id', { count: 'exact', head: true });
    console.log(`   ✂️  Segments: ${segmentCount || 0}`);

    const { count: highConfCount } = await supabase
        .from('segments')
        .select('id', { count: 'exact', head: true })
        .gte('transcription_confidence', 0.90);
    console.log(`   🎯 High confidence (>90%): ${highConfCount || 0}`);

    const { count: modelOutputCount } = await supabase
        .from('model_outputs')
        .select('id', { count: 'exact', head: true });
    console.log(`   🤖 Model outputs (RLHF): ${modelOutputCount || 0}`);

    const { count: needsRankingCount } = await supabase
        .from('segments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'needs_ranking');
    console.log(`   📝 Needs ranking: ${needsRankingCount || 0}`);

} catch (error) {
    console.log(`   ❌ Database check failed: ${error.message}`);
}

// Check 3: Scripts
console.log('\n📜 Pipeline Scripts:');
const scripts = [
    'liveatc-recorder.js',
    'segment-audio.js',
    'upload-to-supabase.js',
    'scheduled-pipeline.js',
    'process-high-confidence.js'
];

for (const script of scripts) {
    const scriptPath = path.join(__dirname, script);
    try {
        await fs.access(scriptPath);
        console.log(`   ✅ ${script}`);
    } catch {
        console.log(`   ❌ ${script}: Not found`);
    }
}

// Check 4: Directories
console.log('\n📁 Directories:');
const dirs = [
    'recordings/raw',
    'recordings/segments',
    'logs'
];

for (const dir of dirs) {
    const dirPath = path.join(__dirname, '..', dir);
    try {
        await fs.access(dirPath);
        console.log(`   ✅ ${dir}`);
    } catch {
        console.log(`   ⚠️  ${dir}: Not found (will be created on first run)`);
    }
}

// Check 5: API Endpoints
console.log('\n🌐 API Endpoints (Next.js must be running):');
const endpoints = [
    '/api/process-audio',
    '/api/segments/process-batch',
    '/api/segments/active'
];

console.log('   ℹ️  Start dev server with: npm run dev');
console.log('   ℹ️  Then test at: http://localhost:3000/test-outputs');

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));

if (envOk) {
    console.log('✅ Environment: Configured');
} else {
    console.log('❌ Environment: Missing variables (check .env file)');
}

console.log('\n🚀 Available Commands:');
console.log('   npm run record     - Record from LiveATC');
console.log('   npm run segment    - Segment audio files');
console.log('   npm run upload     - Upload to Supabase');
console.log('   npm run pipeline   - Run full pipeline (scheduled)');
console.log('   npm run process-rlhf - Process high-confidence segments');
console.log('   npm run dev        - Start Next.js dev server');

console.log('\n📖 Documentation:');
console.log('   QUICKSTART.md           - Getting started guide');
console.log('   PIPELINE_USAGE.md       - Pipeline usage');
console.log('   RLHF_BATCH_PROCESSING.md - RLHF pipeline guide');

console.log('\n');
