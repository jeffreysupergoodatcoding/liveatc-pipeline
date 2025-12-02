import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase-server.js';
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
    const supabase = supabaseServer;

    // Get count of active segments
    const { data: activeSegments, error } = await supabase
      .from('segments')
      .select('id')
      .eq('active', true);

    if (error) {
      throw error;
    }

    if (!activeSegments || activeSegments.length === 0) {
      return NextResponse.json(
        { error: 'No active segments to analyze' },
        { status: 400 }
      );
    }

    const count = activeSegments.length;

    // Get segment IDs
    const segmentIds = activeSegments.map(s => s.id);

    // Run analysis script on active segments only
    // Use --active flag to analyze only active segments
    const scriptPath = path.join(__dirname, '../../../../scripts/detect-edge-cases.js');

    // Start analysis in background
    // We'll analyze each active segment sequentially
    const analysisPromise = (async () => {
      for (const segmentId of segmentIds) {
        try {
          await execPromise(`node "${scriptPath}" --segment-id ${segmentId}`);

          // Deactivate segment after successful analysis
          await supabase
            .from('segments')
            .update({ active: false })
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
