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
    // Await params in Next.js 14+
    const { id } = await params;

    const body = await request.json();
    console.log('Review API received:', body);

    const { reviewed, approved, notes, manualTranscription, contextNotes, reviewedBy } = body;

    // Update segment with review information
    const updates = {
      reviewed,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      review_notes: notes || null,
      reviewed_by: reviewedBy || null
    };

    // If manual transcription provided, update it
    if (manualTranscription) {
      updates.transcription = manualTranscription;
      // updates.manual_transcription = true; // TODO: Add this column via migration
      console.log('Adding manual transcription to updates');
    }

    console.log('Updating segment with:', updates);

    const { data: segment, error: updateError } = await supabase
      .from('segments')
      .update(updates)
      .eq('id', id)
      .select('*, recordings!inner(airport, facility, recorded_at)')
      .single();

    if (updateError) {
      console.error('Error updating segment:', updateError);
      throw updateError;
    }

    console.log('Segment updated successfully');

    // If approved, create a segment label
    if (approved && manualTranscription) {
      console.log('Creating segment label...');

      const labelData = {
        segment_id: id,
        transcription: manualTranscription,
        response: contextNotes || null, // Use response field for context notes
        confidence: 'high', // Manual transcriptions are high confidence
        created_at: new Date().toISOString(),
        user_id: reviewedBy || null
      };

      console.log('Label data:', labelData);

      const { error: labelError } = await supabase
        .from('segment_labels')
        .insert(labelData);

      if (labelError) {
        console.error('Error creating segment label:', labelError);
        // Don't fail the whole request if label creation fails
      } else {
        console.log('Segment label created successfully');
      }
    }

    return NextResponse.json(segment);
  } catch (error) {
    console.error('Error updating review status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update review status' },
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
    // Await params in Next.js 14+
    const { id } = await params;

    const { data, error } = await supabase
      .from('segments')
      .select('reviewed, reviewed_at, review_notes, reviewed_by')
      .eq('id', id)
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
