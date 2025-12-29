import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';
import { logger } from '../../../../../lib/logger.js';

// Force dynamic rendering - prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/segments/[id]/audio
 * Get a signed URL for segment audio file
 */
export async function GET(request, { params }) {
  try {
    // Create a FRESH Supabase client for this request (no caching)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'cache-control': 'no-cache'
          }
        }
      }
    );

    // Await params in Next.js 14+
    const { id } = await params;

    // Get segment file path - force fresh read from database
    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('file_path, trimmed_file_path')
      .eq('id', id)
      .maybeSingle();  // Use maybeSingle instead of single to avoid caching

    if (segmentError || !segment) {
      logger.error('Segment query error:', segmentError);
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    const filePath = segment.trimmed_file_path || segment.file_path;
    logger.info(`🎵 Audio API - Segment ${id}:`);
    logger.info(`   file_path: ${segment.file_path}`);
    logger.info(`   trimmed_file_path: ${segment.trimmed_file_path || 'NOT SET'}`);
    logger.info(`   → Serving: ${filePath}`);
    logger.info(`   → Is Trimmed: ${segment.trimmed_file_path ? 'YES' : 'NO'}`);

    // Try public URL first (if bucket is public)
    const { data: publicData } = supabase.storage
      .from('liveatc-segments')
      .getPublicUrl(filePath);

    if (publicData?.publicUrl) {
      // Test if public URL works by checking if bucket is public
      try {
        const testResponse = await fetch(publicData.publicUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          logger.debug('Using public URL');
          return NextResponse.json({ url: publicData.publicUrl });
        }
      } catch (e) {
        logger.debug('Public URL not accessible, trying signed URL');
      }
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('liveatc-segments')
      .createSignedUrl(filePath, 3600);

    if (error) {
      logger.error('Error creating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate audio URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    logger.error('Error getting audio URL:', error);
    return NextResponse.json(
      { error: 'Failed to get audio URL' },
      { status: 500 }
    );
  }
}
