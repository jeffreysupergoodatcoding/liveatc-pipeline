#!/usr/bin/env node
/**
 * Test Audio-First Migration
 * Verifies new columns and views exist
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testMigration() {
  console.log('Testing audio-first migration...\n');

  try {
    // Test 1: Query segments with new columns
    console.log('1. Testing new columns in segments table...');
    const { data: segments, error: segError } = await supabase
      .from('segments')
      .select('id, audio_analysis_score, detected_patterns, keywords_detected, transcription_pending, audio_features, keyword_check_done')
      .limit(1);

    if (segError) {
      console.error('❌ Segments query failed:', segError.message);
      return false;
    }
    console.log('✅ New columns exist in segments table');

    // Test 2: Query audio_flagged_segments view
    console.log('\n2. Testing audio_flagged_segments view...');
    const { data: audioFlagged, error: afError } = await supabase
      .from('audio_flagged_segments')
      .select('*')
      .limit(1);

    if (afError) {
      console.error('❌ audio_flagged_segments view failed:', afError.message);
      return false;
    }
    console.log('✅ audio_flagged_segments view exists');

    // Test 3: Query transcription_queue view
    console.log('\n3. Testing transcription_queue view...');
    const { data: queue, error: qError } = await supabase
      .from('transcription_queue')
      .select('*')
      .limit(1);

    if (qError) {
      console.error('❌ transcription_queue view failed:', qError.message);
      return false;
    }
    console.log('✅ transcription_queue view exists');

    // Test 4: Query updated edge_case_statistics view
    console.log('\n4. Testing updated edge_case_statistics view...');
    const { data: stats, error: statsError } = await supabase
      .from('edge_case_statistics')
      .select('*')
      .single();

    if (statsError) {
      console.error('❌ edge_case_statistics view failed:', statsError.message);
      return false;
    }

    console.log('✅ edge_case_statistics view updated');
    console.log('\nStatistics:');
    console.log('  - Total segments:', stats.total_segments);
    console.log('  - Audio analyzed:', stats.audio_analyzed_segments);
    console.log('  - Transcribed:', stats.transcribed_segments);
    console.log('  - Flagged:', stats.flagged_segments);
    console.log('  - Pending transcription:', stats.pending_transcription);
    console.log('  - Segments with keywords:', stats.segments_with_keywords);

    console.log('\n✅ All migration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Migration test failed:', error.message);
    return false;
  }
}

testMigration().then(success => {
  process.exit(success ? 0 : 1);
});
