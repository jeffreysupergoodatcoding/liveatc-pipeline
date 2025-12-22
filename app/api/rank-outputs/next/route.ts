import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY! // Use service key for full data access
        );

        // Fetch the next model_output that needs ranking
        const { data: modelOutput, error: outputError } = await supabase
            .from('model_outputs')
            .select(`
        id,
        segment_id,
        variations,
        created_at,
        segments (
          id,
          file_path,
          duration_seconds,
          transcription_text,
          recordings (
            airport,
            facility
          )
        )
      `)
            .eq('needs_ranking', true)
            .is('ranked_at', null)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (outputError) {
            if (outputError.code === 'PGRST116') {
                // No rows found
                return NextResponse.json({
                    success: true,
                    data: null,
                    message: 'No segments available for ranking'
                });
            }
            throw outputError;
        }

        // Type the segments properly
        const segment = modelOutput.segments as any;
        const recording = segment?.recordings as any;

        const filePath = segment.file_path.startsWith('/') ? segment.file_path.slice(1) : segment.file_path;
        console.log('Getting audio URL for path:', filePath);

        // Try public URL first (if bucket is public)
        const { data: publicData } = supabase.storage
            .from('liveatc-segments')
            .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
            console.log('Using public URL:', publicData.publicUrl);
            return NextResponse.json({
                success: true,
                data: {
                    modelOutputId: modelOutput.id,
                    segmentId: modelOutput.segment_id,
                    airport: recording?.airport || 'Unknown',
                    facility: recording?.facility || 'Unknown',
                    duration: segment.duration_seconds,
                    audioUrl: publicData.publicUrl,
                    variations: modelOutput.variations,
                    originalTranscription: segment.transcription_text
                }
            });
        }

        // Fallback to signed URL if public URL doesn't work
        const { data: urlData, error: urlError } = await supabase.storage
            .from('liveatc-segments')
            .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (urlError || !urlData) {
            console.error('Error generating signed URL:', urlError);
            console.error('File path was:', filePath);

            return NextResponse.json({
                success: true,
                data: {
                    modelOutputId: modelOutput.id,
                    segmentId: modelOutput.segment_id,
                    airport: recording?.airport || 'Unknown',
                    facility: recording?.facility || 'Unknown',
                    duration: segment.duration_seconds,
                    audioUrl: null,
                    audioError: 'Audio file not found in storage',
                    variations: modelOutput.variations,
                    originalTranscription: segment.transcription_text
                }
            });
        }

        console.log('Using signed URL');

        return NextResponse.json({
            success: true,
            data: {
                modelOutputId: modelOutput.id,
                segmentId: modelOutput.segment_id,
                airport: recording?.airport || 'Unknown',
                facility: recording?.facility || 'Unknown',
                duration: segment.duration_seconds,
                audioUrl: urlData.signedUrl,
                variations: modelOutput.variations,
                originalTranscription: segment.transcription_text
            }
        });
    } catch (error) {
        console.error('Error fetching next segment:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch next segment',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
