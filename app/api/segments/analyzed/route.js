import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase-server.js';

/**
 * GET /api/segments/analyzed
 * Get all analyzed segments (audio analysis OR transcription)
 *
 * ⚠️  WARNING: This endpoint is UNUSED by the frontend (uses direct Supabase queries)
 * Consider removing this file to reduce attack surface
 */
export async function GET(request) {
  try {
    const supabase = supabaseServer;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query segments that have been analyzed (audio OR transcription)
    const { data, error } = await supabase
      .from('segments')
      .select(`
        *,
        recordings!inner(airport, facility, recorded_at)
      `)
      .or('audio_analysis_score.not.is.null,transcription.not.is.null')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform to flat structure
    const segments = data.map(segment => ({
      ...segment,
      airport: segment.recordings.airport,
      facility: segment.recordings.facility,
      recorded_at: segment.recordings.recorded_at,
      recordings: undefined
    }));

    return NextResponse.json({
      segments,
      count: segments.length
    });
  } catch (error) {
    console.error('Error getting analyzed segments:', error);
    return NextResponse.json(
      { error: 'Failed to get analyzed segments' },
      { status: 500 }
    );
  }
}
