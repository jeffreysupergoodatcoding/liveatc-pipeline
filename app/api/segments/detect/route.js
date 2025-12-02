import { NextResponse } from 'next/server';
import { EdgeCaseDetector } from '../../../../backend/services/detection/EdgeCaseDetector.js';
import { supabaseServer as supabase } from '../../../../lib/supabase-server.js';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

/**
 * POST /api/segments/detect
 * Analyze uploaded audio file for edge cases
 *
 * Accepts:
 * - multipart/form-data with audio file
 * - JSON with { segmentId: string } to re-analyze existing segment
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type');

    let audioPath;
    let segmentId = null;
    let tempFile = null;

    // Handle file upload
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const audioFile = formData.get('audio');

      if (!audioFile) {
        return NextResponse.json(
          { error: 'No audio file provided' },
          { status: 400 }
        );
      }

      // Save to temp file
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      tempFile = path.join(os.tmpdir(), `upload-${Date.now()}.mp3`);
      await fs.writeFile(tempFile, buffer);
      audioPath = tempFile;
    }
    // Handle segment ID
    else if (contentType?.includes('application/json')) {
      const body = await request.json();
      segmentId = body.segmentId;

      if (!segmentId) {
        return NextResponse.json(
          { error: 'No segmentId provided' },
          { status: 400 }
        );
      }

      // Get segment from database
      const { data: segment, error } = await supabase
        .from('segments')
        .select('file_path')
        .eq('id', segmentId)
        .single();

      if (error || !segment) {
        return NextResponse.json(
          { error: 'Segment not found' },
          { status: 404 }
        );
      }

      // Download from storage
      const { data: fileData } = await supabase.storage
        .from('liveatc-segments')
        .download(segment.file_path);

      if (!fileData) {
        return NextResponse.json(
          { error: 'Failed to download segment file' },
          { status: 500 }
        );
      }

      // Save to temp file
      const buffer = Buffer.from(await fileData.arrayBuffer());
      tempFile = path.join(os.tmpdir(), `segment-${segmentId}.mp3`);
      await fs.writeFile(tempFile, buffer);
      audioPath = tempFile;
    }
    else {
      return NextResponse.json(
        { error: 'Invalid content type. Use multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    // Initialize detector
    const detector = new EdgeCaseDetector();
    await detector.initialize();

    // Run detection
    const result = await detector.detect(audioPath);

    // Save results to database if this is for an existing segment
    if (segmentId) {
      await saveDetectionResults(segmentId, result);
    }

    // Clean up temp file
    if (tempFile) {
      await fs.unlink(tempFile).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error detecting edge cases:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to detect edge cases' },
      { status: 500 }
    );
  }
}

/**
 * Save detection results to database
 */
async function saveDetectionResults(segmentId, detectionResult) {
  // Update segment with detection results
  const { error: segmentError } = await supabase
    .from('segments')
    .update({
      transcription: detectionResult.transcription.text,
      transcription_confidence: detectionResult.transcription.confidence,
      edge_case_score: detectionResult.edgeCaseScore,
      speaker_count: detectionResult.transcription.speakerCount,
      flagged: detectionResult.flagged,
      detected_edge_cases: detectionResult.detectedEdgeCases
    })
    .eq('id', segmentId);

  if (segmentError) {
    console.error('Error updating segment:', segmentError);
  }

  // Insert edge case matches
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
    const { error: matchError } = await supabase
      .from('edge_case_matches')
      .insert(allMatches);

    if (matchError) {
      console.error('Error inserting edge case matches:', matchError);
    }
  }
}
