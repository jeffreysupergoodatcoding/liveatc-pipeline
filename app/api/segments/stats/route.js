import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabase-server.js';
import { logger } from '../../../../lib/logger.js';

/**
 * GET /api/segments/stats
 * Get audio analysis statistics (audio-first, no transcription)
 *
 * ⚠️  WARNING: This endpoint is UNUSED by the frontend (uses direct Supabase queries)
 * Consider removing this file to reduce attack surface
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();

    // Query segments for audio analysis stats
    const { data: segments, error: segmentsError } = await supabase
      .from('segments')
      .select('audio_analysis_score, detected_patterns');

    if (segmentsError) {
      logger.error('Error querying segments:', segmentsError);
      throw segmentsError;
    }

    // Calculate audio analysis statistics
    const analyzedSegments = segments.filter(s => s.audio_analysis_score !== null);
    const totalSegments = segments.length;
    const analyzedCount = analyzedSegments.length;

    // Calculate average audio score
    const avgAudioScore = analyzedCount > 0
      ? analyzedSegments.reduce((sum, s) => sum + s.audio_analysis_score, 0) / analyzedCount
      : null;

    // Count high interest segments (≥65%)
    const highInterestCount = analyzedSegments.filter(s => s.audio_analysis_score >= 0.65).length;

    // Count unique patterns detected
    const allPatterns = analyzedSegments
      .filter(s => s.detected_patterns && s.detected_patterns.length > 0)
      .flatMap(s => s.detected_patterns);
    const uniquePatterns = new Set(allPatterns);

    // Pattern distribution
    const patternCounts = {};
    allPatterns.forEach(pattern => {
      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    });

    // Convert to array for display
    const patternsByType = Object.entries(patternCounts)
      .map(([pattern, count]) => ({
        pattern: pattern,
        count: count
      }))
      .sort((a, b) => b.count - a.count);

    // Audio score distribution (like severity distribution but for audio scores)
    const scoreDistribution = {
      high: analyzedSegments.filter(s => s.audio_analysis_score >= 0.65).length,      // High interest
      medium: analyzedSegments.filter(s => s.audio_analysis_score >= 0.35 && s.audio_analysis_score < 0.65).length,  // Medium
      low: analyzedSegments.filter(s => s.audio_analysis_score >= 0.1 && s.audio_analysis_score < 0.35).length,   // Low
      routine: analyzedSegments.filter(s => s.audio_analysis_score < 0.1).length     // Routine
    };

    const stats = {
      total_segments: totalSegments,
      analyzed_segments: analyzedCount,
      high_interest_segments: highInterestCount,
      avg_audio_score: avgAudioScore,
      unique_patterns_detected: uniquePatterns.size
    };

    return NextResponse.json({
      overall: stats,
      byPattern: patternsByType,
      scoreDistribution
    });
  } catch (error) {
    logger.error('Error getting statistics:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}
