import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';

/**
 * PATCH /api/segments/[id]/review
 * Mark segment as reviewed
 *
 * Body:
 * {
 *   reviewed: boolean,
 *   reviewNotes?: string,
 *   reviewedBy?: string (user ID)
 * }
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = getSupabaseServer();
    const { reviewed, reviewNotes, reviewedBy } = await request.json();

    const updates = {
      reviewed,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      review_notes: reviewNotes || null,
      reviewed_by: reviewedBy || null
    };

    const { data, error } = await supabase
      .from('segments')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating review status:', error);
    return NextResponse.json(
      { error: 'Failed to update review status' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/segments/[id]/review
 * Get review details for a segment
 */
export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('segments')
      .select('reviewed, reviewed_at, review_notes, reviewed_by')
      .eq('id', params.id)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting review details:', error);
    return NextResponse.json(
      { error: 'Failed to get review details' },
      { status: 500 }
    );
  }
}
