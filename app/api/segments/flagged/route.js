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

    // Use the pre-built view for better performance
    let query = supabase
      .from('flagged_segments_with_matches')
      .select('*')
      .order('audio_analysis_score', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (minScore) {
      query = query.gte('audio_analysis_score', parseFloat(minScore));
    }

    if (reviewed !== null) {
      query = query.eq('reviewed', reviewed === 'true');
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Filter by category if specified (client-side filter since it's in JSONB)
    let filteredData = data;
    if (category) {
      filteredData = data.filter(segment =>
        segment.matches.some(match => match.category === category)
      );
    }

    return NextResponse.json({
      segments: filteredData,
      count: filteredData.length,
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
