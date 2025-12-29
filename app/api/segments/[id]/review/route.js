import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';
import { logger } from '../../../../../lib/logger.js';

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
    logger.debug('Review API received:', body);

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
      updates.transcription_text = manualTranscription;
      logger.debug('Adding manual transcription to updates');
    }

    logger.debug('Updating segment with:', updates);

    const { data: segment, error: updateError } = await supabase
      .from('segments')
      .update(updates)
      .eq('id', id)
      .select('*, recordings!inner(airport, facility, recorded_at)')
      .single();

    if (updateError) {
      logger.error('Error updating segment:', updateError);
      throw updateError;
    }

    logger.debug('Segment updated successfully');

    // If approved, create a segment label
    if (approved && manualTranscription) {
      logger.debug('Creating segment label...');

      const labelData = {
        segment_id: id,
        transcription: manualTranscription,
        response: contextNotes || null, // Use response field for context notes
        confidence: 'high', // Manual transcriptions are high confidence
        created_at: new Date().toISOString(),
        user_id: reviewedBy || null
      };

      logger.debug('Label data:', labelData);

      const { error: labelError } = await supabase
        .from('segment_labels')
        .insert(labelData);

      if (labelError) {
        logger.error('Error creating segment label:', labelError);
        // Don't fail the whole request if label creation fails
      } else {
        logger.debug('Segment label created successfully');

        // Update segment to remove from human review queue
        const { error: flagError } = await supabase
          .from('segments')
          .update({ needs_human_review: false })
          .eq('id', id);

        if (flagError) {
          logger.error('Error updating needs_human_review flag:', flagError);
        } else {
          logger.debug('Segment removed from human review queue');
        }
      }
    }

    return NextResponse.json(segment);
  } catch (error) {
    logger.error('Error updating review status:', error);
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
    logger.error('Error getting review details:', error);
    return NextResponse.json(
      { error: 'Failed to get review details' },
      { status: 500 }
    );
  }
}
