import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabase-server.js';

/**
 * POST /api/segments/process-batch
 * Process multiple high-confidence segments for RLHF
 * 
 * Request body:
 * {
 *   "limit": 10,              // Optional: max segments to process
 *   "minConfidence": 0.90     // Optional: minimum confidence threshold
 * }
 * 
 * Response:
 * {
 *   "status": "processing",
 *   "segmentIds": ["uuid1", "uuid2", ...],
 *   "count": 10
 * }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { limit = 10, minConfidence = 0.90 } = body;

        const supabase = getSupabaseServer();

        // Find segments marked as RLHF candidates by the confidence pipeline
        // that haven't been processed yet
        let query = supabase
            .from('segments')
            .select('id, transcription_confidence, file_path')
            .eq('rlhf_candidate', true)  // Only segments from confidence pipeline
            .not('file_path', 'is', null)
            .neq('status', 'needs_ranking')  // Not already processed
            .order('transcription_confidence', { ascending: false });

        if (limit && limit !== 'all') {
            query = query.limit(parseInt(limit));
        }

        const { data: segments, error } = await query;

        if (error) {
            throw error;
        }

        if (!segments || segments.length === 0) {
            return NextResponse.json({
                status: 'no_segments',
                message: 'No high-confidence segments found to process',
                count: 0
            });
        }

        const segmentIds = segments.map(s => s.id);

        // Return immediately - processing will happen asynchronously
        // In production, you'd use a queue system (Bull, BullMQ, etc.)
        return NextResponse.json({
            status: 'queued',
            message: `Queued ${segmentIds.length} segments for processing`,
            segmentIds: segmentIds,
            count: segmentIds.length,
            minConfidence: minConfidence
        });

    } catch (error) {
        console.error('Error queuing batch processing:', error);
        return NextResponse.json(
            {
                error: 'Failed to queue batch processing',
                details: error.message
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/segments/process-batch
 * Get list of segments eligible for batch processing
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.90');

        const supabase = getSupabaseServer();

        // Count segments marked as RLHF candidates that are eligible for processing
        const { count, error } = await supabase
            .from('segments')
            .select('id', { count: 'exact', head: true })
            .eq('rlhf_candidate', true)
            .not('file_path', 'is', null)
            .neq('status', 'needs_ranking');

        if (error) {
            throw error;
        }

        return NextResponse.json({
            eligibleCount: count || 0,
            message: `${count || 0} RLHF candidate segments ready for processing`
        });

    } catch (error) {
        console.error('Error checking eligible segments:', error);
        return NextResponse.json(
            {
                error: 'Failed to check eligible segments',
                details: error.message
            },
            { status: 500 }
        );
    }
}
