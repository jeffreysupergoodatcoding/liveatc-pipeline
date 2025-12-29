import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabase-server.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /api/segments/analyze
 * Run audio analysis on all active segments
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseServer();

    // Get count of pending segments (in queue)
    const { data: pendingSegments, error } = await supabase
      .from('segments')
      .select('id')
      .eq('status', 'pending');

    if (error) {
      throw error;
    }

    if (!pendingSegments || pendingSegments.length === 0) {
      return NextResponse.json(
        { error: 'No pending segments to analyze' },
        { status: 400 }
      );
    }

    const count = pendingSegments.length;

    // Get segment IDs
    const segmentIds = pendingSegments.map(s => s.id);

    // Run analysis script on pending segments only
    const scriptPath = path.join(__dirname, '../../../../scripts/detect-edge-cases.js');

    // Start analysis in background
    const analysisPromise = (async () => {
      for (const segmentId of segmentIds) {
        try {
          await execPromise(`node "${scriptPath}" --segment-id ${segmentId}`);

          // Update segment status to 'active' after successful analysis
          // This removes it from the queue
          await supabase
            .from('segments')
            .update({ status: 'active' })
            .eq('id', segmentId);
        } catch (error) {
          console.error(`Error analyzing segment ${segmentId}:`, error);
          // Continue with next segment
        }
      }
    })();

    // Don't await - let it run in background
    analysisPromise.catch(err => {
      console.error('Background analysis error:', err);
    });

    return NextResponse.json({
      success: true,
      message: `Started analysis of ${count} segment(s)`,
      count
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}
