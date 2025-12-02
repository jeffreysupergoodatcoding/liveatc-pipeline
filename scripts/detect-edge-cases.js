#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

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

/**
 * Edge Case Detection Script
 * Batch process segments through edge case detection
 *
 * Usage:
 *   node detect-edge-cases.js                    # Process all unanalyzed segments
 *   node detect-edge-cases.js --limit 10         # Process first 10 unanalyzed segments
 *   node detect-edge-cases.js --recording-id <id> # Process all segments from a specific recording
 *   node detect-edge-cases.js --segment-id <id>  # Process a specific segment
 *   node detect-edge-cases.js --reprocess        # Reprocess all segments (even analyzed ones)
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    limit: null,
    recordingId: null,
    segmentId: null,
    reprocess: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      parsed.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--recording-id' && args[i + 1]) {
      parsed.recordingId = args[i + 1];
      i++;
    } else if (args[i] === '--segment-id' && args[i + 1]) {
      parsed.segmentId = args[i + 1];
      i++;
    } else if (args[i] === '--reprocess') {
      parsed.reprocess = true;
    }
  }

  return parsed;
}

async function getSegmentsToProcess(options) {
  console.log('Querying segments...');

  let query = supabase
    .from('segments')
    .select('*')
    .order('created_at', { ascending: true });

  // Filter by specific segment
  if (options.segmentId) {
    query = query.eq('id', options.segmentId);
  }
  // Filter by recording
  else if (options.recordingId) {
    query = query.eq('recording_id', options.recordingId);
  }
  // Filter unprocessed only (unless reprocessing)
  else if (!options.reprocess) {
    query = query.is('audio_analysis_score', null);
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query segments: ${error.message}`);
  }

  return data;
}

async function downloadSegment(segment, tempDir) {
  const tempPath = path.join(tempDir, `segment_${segment.id}.mp3`);

  // Download from Supabase storage
  const { data, error } = await supabase.storage
    .from('liveatc-segments')
    .download(segment.file_path);

  if (error) {
    throw new Error(`Failed to download segment: ${error.message}`);
  }

  // Save to temp file
  const buffer = Buffer.from(await data.arrayBuffer());
  await fs.writeFile(tempPath, buffer);

  return tempPath;
}

async function runAudioAnalysis(audioPath) {
  const threshold = parseFloat(process.env.AUDIO_ANALYSIS_THRESHOLD || '0.65');
  const analyzerPath = path.join(__dirname, '..', 'backend', 'services', 'python', 'audio_analyzer.py');

  try {
    const { stdout } = await execPromise(`python3 "${analyzerPath}" "${audioPath}" ${threshold}`);
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Audio analysis error:', error.message);
    return {
      score: 0.0,
      patterns: [],
      should_transcribe: true, // Fallback to transcription on error
      features: {},
      error: error.message
    };
  }
}

async function runKeywordDetection(audioPath) {
  const detectorPath = path.join(__dirname, '..', 'backend', 'services', 'python', 'keyword_detector.py');

  try {
    const { stdout, stderr } = await execPromise(`python3 "${detectorPath}" "${audioPath}"`);
    // stderr contains Whisper loading messages, stdout has JSON result
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Keyword detection error:', error.message);
    return {
      detected_keywords: [],
      flagged_cases: [],
      keyword_score: 0.0,
      error: error.message
    };
  }
}

// Removed: detectEdgeCases function - transcription disabled, audio analysis only

async function saveResults(segmentId, detectionResult, audioAnalysis = null, keywordDetection = null) {
  // Build update object
  const updateData = {};

  // Audio analysis results (if available)
  if (audioAnalysis) {
    updateData.audio_analysis_score = audioAnalysis.score;
    updateData.detected_patterns = audioAnalysis.patterns;
    updateData.audio_features = audioAnalysis.features;

    // Clear any old transcription data (audio-only mode)
    updateData.transcription = null;
    updateData.transcription_confidence = null;
    updateData.edge_case_score = null;
    updateData.speaker_count = null;
    updateData.flagged = false;
    updateData.detected_edge_cases = null;
  }

  // Keyword detection results (if available)
  if (keywordDetection) {
    updateData.keywords_detected = keywordDetection.detected_keywords;
    updateData.keyword_check_done = true;

    // Store flagged cases in detected_patterns field (along with audio patterns)
    const flaggedCaseNames = keywordDetection.flagged_cases.map(c => c.case_id);
    if (updateData.detected_patterns) {
      // Combine audio patterns and keyword-detected cases
      updateData.detected_patterns = [...updateData.detected_patterns, ...flaggedCaseNames];
    } else {
      updateData.detected_patterns = flaggedCaseNames;
    }

    // Combine keyword score with audio score (weighted average)
    // Audio features: 60%, Keywords: 40%
    if (audioAnalysis && keywordDetection.keyword_score > 0) {
      const combinedScore = (audioAnalysis.score * 0.6) + (keywordDetection.keyword_score * 0.4);
      updateData.audio_analysis_score = Math.min(1.0, combinedScore);
    } else if (keywordDetection.keyword_score > 0) {
      // If no audio analysis, use keyword score alone
      updateData.audio_analysis_score = keywordDetection.keyword_score;
    }

    // Flag segment if keyword score is high (≥0.65) OR combined score is high
    if (keywordDetection.keyword_score >= 0.65 || updateData.audio_analysis_score >= 0.65) {
      updateData.flagged = true;
    }
  }

  // Transcription results (if available)
  if (detectionResult) {
    updateData.transcription = detectionResult.transcription.text;
    updateData.transcription_confidence = detectionResult.transcription.confidence;
    updateData.edge_case_score = detectionResult.edgeCaseScore;
    updateData.speaker_count = detectionResult.transcription.speakerCount;
    updateData.flagged = detectionResult.flagged;
    updateData.detected_edge_cases = detectionResult.detectedEdgeCases;
  }

  // Update segment
  const { error: segmentError } = await supabase
    .from('segments')
    .update(updateData)
    .eq('id', segmentId);

  if (segmentError) {
    throw new Error(`Failed to update segment: ${segmentError.message}`);
  }

  // Clear old edge case matches when running audio-only mode
  if (audioAnalysis && !detectionResult) {
    await supabase
      .from('edge_case_matches')
      .delete()
      .eq('segment_id', segmentId);
  }

  // Insert edge case matches (only if detection was run)
  if (detectionResult && detectionResult.detectedEdgeCases) {
    const matches = detectionResult.detectedEdgeCases.map(match => ({
      segment_id: segmentId,
      case_id: match.caseId,
      case_name: match.caseName,
      category: match.category,
      severity: match.severity,
      confidence: match.confidence,
      match_type: match.matchType,
      evidence: match.evidence,
      is_custom_rule: false
    }));

    // Add custom rule matches
    const customMatches = detectionResult.customRuleMatches.map(match => ({
      segment_id: segmentId,
      case_id: match.ruleId,
      case_name: match.ruleName,
      category: 'custom',
      severity: match.priority === 'critical' ? 1.0 : match.priority === 'high' ? 0.8 : match.priority === 'medium' ? 0.6 : 0.4,
      confidence: match.confidence,
      match_type: 'custom_rule',
      evidence: { matchedConditions: match.matchedConditions },
      is_custom_rule: true
    }));

    const allMatches = [...matches, ...customMatches];

    if (allMatches.length > 0) {
      // Delete existing matches for this segment (in case of reprocessing)
      await supabase
        .from('edge_case_matches')
        .delete()
        .eq('segment_id', segmentId);

      const { error: matchError } = await supabase
        .from('edge_case_matches')
        .insert(allMatches);

      if (matchError) {
        throw new Error(`Failed to insert edge case matches: ${matchError.message}`);
      }
    }
  }
}

async function processSegment(segment, tempDir, index, total) {
  const segmentLabel = `[${index + 1}/${total}] Segment ${segment.id.substring(0, 8)}`;

  console.log('\n' + '='.repeat(80));
  console.log(`${segmentLabel}`);
  console.log('='.repeat(80));
  console.log(`  Recording: ${segment.recording_id.substring(0, 8)}`);
  console.log(`  Duration: ${segment.duration_seconds}s`);
  console.log(`  File: ${segment.file_path}`);

  let tempPath = null;
  let audioAnalysis = null;
  let keywordDetection = null;

  try {
    // Download segment
    console.log('  ⬇️  Downloading...');
    tempPath = await downloadSegment(segment, tempDir);

    // Audio analysis (audio features)
    console.log('  🎵 Running audio feature analysis...');
    audioAnalysis = await runAudioAnalysis(tempPath);
    console.log(`     Audio Score: ${audioAnalysis.score.toFixed(3)}`);
    console.log(`     Patterns: ${audioAnalysis.patterns.length > 0 ? audioAnalysis.patterns.join(', ') : 'none'}`);

    // Keyword detection (edge case taxonomy keywords)
    console.log('  🔍 Running keyword detection...');
    keywordDetection = await runKeywordDetection(tempPath);
    console.log(`     Keyword Score: ${keywordDetection.keyword_score.toFixed(3)}`);
    console.log(`     Keywords Found: ${keywordDetection.detected_keywords.length}`);
    console.log(`     Flagged Cases: ${keywordDetection.flagged_cases.length}`);

    // Save combined results
    console.log('  💾 Saving results...');
    await saveResults(segment.id, null, audioAnalysis, keywordDetection);

    // Calculate final combined score
    const finalScore = audioAnalysis && keywordDetection.keyword_score > 0
      ? Math.min(1.0, (audioAnalysis.score * 0.6) + (keywordDetection.keyword_score * 0.4))
      : audioAnalysis ? audioAnalysis.score : keywordDetection.keyword_score;

    // Summary
    console.log('  ✅ Complete!');
    console.log(`     Final Score: ${finalScore.toFixed(3)} (audio: ${audioAnalysis.score.toFixed(3)}, keywords: ${keywordDetection.keyword_score.toFixed(3)})`);
    console.log(`     Audio Patterns: ${audioAnalysis.patterns.length}`);
    console.log(`     Edge Cases Flagged: ${keywordDetection.flagged_cases.length}`);

    if (audioAnalysis.patterns.length > 0) {
      console.log(`     Audio Patterns:`);
      audioAnalysis.patterns.forEach(pattern => {
        console.log(`       - ${pattern.replace(/_/g, ' ')}`);
      });
    }

    if (keywordDetection.flagged_cases.length > 0) {
      console.log(`     Flagged Edge Cases:`);
      keywordDetection.flagged_cases.forEach(edgeCase => {
        console.log(`       - ${edgeCase.name} (${edgeCase.case_id}): ${edgeCase.matched_keywords.join(', ')}`);
      });
    }

    return {
      success: true,
      segment,
      audioAnalysis,
      keywordDetection,
      finalScore
    };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, segment, error: error.message };
  } finally {
    // Clean up temp file
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}

async function main() {
  const options = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         LiveATC Edge Case Detection - Batch Processor        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Get segments to process
    const segments = await getSegmentsToProcess(options);

    if (segments.length === 0) {
      console.log('No segments to process!');
      console.log('');
      console.log('Tips:');
      console.log('  - Use --reprocess to reanalyze already processed segments');
      console.log('  - Check if segments have been uploaded to Supabase');
      process.exit(0);
    }

    console.log(`Found ${segments.length} segment(s) to process`);
    console.log('');

    // Create temp directory
    const tempDir = path.join(os.tmpdir(), `edge-case-detection-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    console.log('Running audio-only analysis (no transcription)...');
    console.log('');

    // Process segments
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < segments.length; i++) {
      const result = await processSegment(segments[i], tempDir, i, segments.length);
      results.push(result);

      // Brief pause between segments to avoid rate limits
      if (i < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const audioAnalyzedCount = results.filter(r => r.success && r.audioAnalysis).length;
    const highScoreCount = results.filter(r => r.success && r.audioAnalysis && r.audioAnalysis.score >= 0.65).length;
    const totalDuration = (Date.now() - startTime) / 1000;

    console.log('\n' + '═'.repeat(80));
    console.log('BATCH PROCESSING COMPLETE - AUDIO ANALYSIS ONLY');
    console.log('═'.repeat(80));
    console.log(`  Total segments: ${segments.length}`);
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${failureCount}`);
    console.log(`  🎵 Audio analyzed: ${audioAnalyzedCount}`);
    console.log(`  ⭐ High interest (≥65%): ${highScoreCount}`);
    console.log(`  ⏱️  Total time: ${totalDuration.toFixed(1)}s (${(totalDuration / segments.length).toFixed(1)}s per segment)`);
    console.log('═'.repeat(80));
    console.log('');

    if (failureCount > 0) {
      console.log('Failed segments:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.segment.id}: ${r.error}`);
      });
      console.log('');
    }

    process.exit(failureCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
