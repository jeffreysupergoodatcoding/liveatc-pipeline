import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../../lib/supabase-server.js';

/**
 * GET /api/segments/[id]/audio
 * Get a signed URL for segment audio file
 */
export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseServer();
    // Await params in Next.js 14+
    const { id } = await params;

    // Get segment file path
    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('file_path')
      .eq('id', id)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Try public URL first (if bucket is public)
    const { data: publicData } = supabase.storage
      .from('liveatc-segments')
      .getPublicUrl(segment.file_path);

    if (publicData?.publicUrl) {
      // Test if public URL works by checking if bucket is public
      try {
        const testResponse = await fetch(publicData.publicUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          console.log('Using public URL');
          return NextResponse.json({ url: publicData.publicUrl });
        }
      } catch (e) {
        console.log('Public URL not accessible, trying signed URL');
      }
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
