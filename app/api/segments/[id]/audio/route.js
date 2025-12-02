import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';

/**
 * GET /api/segments/[id]/audio
 * Get a signed URL for segment audio file
 */
export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseServer();
    // Get segment file path
    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('file_path')
      .eq('id', params.id)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('liveatc-segments')
      .createSignedUrl(segment.file_path, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate audio URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error('Error getting audio URL:', error);
    return NextResponse.json(
      { error: 'Failed to get audio URL' },
      { status: 500 }
    );
  }
}
