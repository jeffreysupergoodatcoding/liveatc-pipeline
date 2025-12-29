import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';

/**
 * POST /api/segments/[id]/queue
 * Toggle segment queue status
 */
export async function POST(request, { params }) {
    try {
        const supabase = getSupabaseServer();
        const { id } = await params;
        const body = await request.json();
        const { inQueue } = body;

        // Update status: true = pending (in queue), false = active (not in queue)
        const newStatus = inQueue ? 'pending' : 'active';

        const { data, error } = await supabase
            .from('segments')
            .update({ status: newStatus })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error toggling queue status:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to toggle queue status' },
            { status: 500 }
        );
    }
}
