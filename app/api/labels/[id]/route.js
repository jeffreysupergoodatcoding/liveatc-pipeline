import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabase-server.js';
import { logger } from '../../../../lib/logger.js';

/**
 * PATCH /api/labels/[id]
 * Update a segment label
 */
export async function PATCH(request, { params }) {
    try {
        const supabase = getSupabaseServer();
        const { id } = await params;
        const body = await request.json();

        const { transcription, response } = body;

        logger.info('Updating label:', id);

        const { data, error } = await supabase
            .from('segment_labels')
            .update({
                transcription,
                response
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Error updating label:', error);
            throw error;
        }

        logger.info('Label updated successfully');

        return NextResponse.json(data);
    } catch (error) {
        logger.error('Error in label update:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update label' },
            { status: 500 }
        );
    }
}
