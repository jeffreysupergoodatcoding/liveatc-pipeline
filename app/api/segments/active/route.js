import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase-server.js';

/**
 * GET /api/segments/active
 * Get all active segments queued for analysis
 *
 * ⚠️  WARNING: This endpoint is UNUSED by the frontend (uses direct Supabase queries)
 * Consider removing this file to reduce attack surface
 */
export async function GET(request) {
  try {
    const supabase = supabaseServer;

    const { data, error } = await supabase
      .from('segments')
      .select(`
        *,
        recordings!inner(airport, facility, recorded_at)
      `)
      .eq('active', true)
      .order('created_at', { ascending: false });

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
    console.error('Error getting active segments:', error);
    return NextResponse.json(
      { error: 'Failed to get active segments' },
      { status: 500 }
    );
  }
}
