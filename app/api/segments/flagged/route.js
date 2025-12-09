import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabase-server.js';

/**
 * GET /api/segments/flagged
 * Get all flagged segments with their edge case matches
 *
 * Query params:
 * - category: filter by edge case category
 * - minScore: minimum audio analysis score
 * - reviewed: filter by review status (true/false)
 * - limit: number of results (default 100)
 * - offset: pagination offset (default 0)
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const minScore = searchParams.get('minScore');
    const reviewed = searchParams.get('reviewed');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query segments that need human review (confidence < 85%)
    let query = supabase
      .from('segments')
      .select(`
        *,
        recordings!inner(airport, facility, recorded_at)
      `)
      .eq('needs_human_review', true)
      .order('transcription_confidence', { ascending: true })  // Show lowest confidence first
      .range(offset, offset + limit - 1);

    // Apply filters
    if (minScore) {
      query = query.gte('transcription_confidence', parseFloat(minScore));
    }

    if (reviewed !== null) {
      query = query.eq('reviewed', reviewed === 'true');
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform to flat structure
    const flatSegments = data?.map(segment => ({
      ...segment,
      airport: segment.recordings.airport,
      facility: segment.recordings.facility,
      recorded_at: segment.recordings.recorded_at,
      matches: []  // No edge case matches for confidence-based routing
    })) || [];

    return NextResponse.json({
      segments: flatSegments,
      count: flatSegments.length,
      total: count
    });
  } catch (error) {
    console.error('Error getting flagged segments:', error);
    return NextResponse.json(
      { error: 'Failed to get flagged segments' },
      { status: 500 }
    );
  }
}
