import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';
import { logger } from '../../../../../lib/logger.js';

/**
 * POST /api/segments/[id]/activate
 * Toggle segment active status for analysis queue
 */
export async function POST(request, { params }) {
  try {
    const supabase = getSupabaseServer();
    // Await params in Next.js 14+
    const { id } = await params;

    const body = await request.json();
    const { active } = body;

    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'active must be a boolean' },
        { status: 400 }
      );
    }

    // Update segment active status
    const { data, error } = await supabase
      .from('segments')
      .update({ active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating segment active status:', error);
      return NextResponse.json(
        { error: 'Failed to update segment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, segment: data });
  } catch (error) {
    logger.error('Error in activate endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
