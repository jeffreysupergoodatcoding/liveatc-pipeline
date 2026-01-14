import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabase-server.js';

export async function POST(request) {
    try {
        const supabase = getSupabaseServer();

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const timestamp = Date.now();
        const fileName = `upload_${timestamp}_${file.name}`;
        const filePath = `uploads/${fileName}`;

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        console.log('Uploading file:', filePath, 'Size:', buffer.length);

        // Upload to storage using service role (bypasses RLS)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('liveatc-segments')
            .upload(filePath, buffer, {
                contentType: file.type || 'audio/mpeg',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        console.log('Upload successful, getting or creating default recording');

        // Get or create a default "Uploads" recording for manual uploads
        let { data: uploadRecording, error: recordingFetchError } = await supabase
            .from('recordings')
            .select('id')
            .eq('airport', 'UPLOAD')
            .eq('facility', 'manual')
            .single();

        if (recordingFetchError || !uploadRecording) {
            // Create default upload recording with correct schema columns
            const { data: newRecording, error: recordingCreateError } = await supabase
                .from('recordings')
                .insert({
                    airport: 'UPLOAD',
                    facility: 'manual',
                    source_url: 'manual-upload',
                    recorded_at: new Date().toISOString(),
                    duration_seconds: 0,
                    status: 'segmented'
                })
                .select()
                .single();

            if (recordingCreateError) {
                console.error('Recording create error:', recordingCreateError);
                return NextResponse.json({ error: `Failed to create recording: ${recordingCreateError.message}` }, { status: 500 });
            }
            uploadRecording = newRecording;
        }

        console.log('Using recording ID:', uploadRecording.id);

        // Get count of existing segments to determine next index
        const { count: segmentCount } = await supabase
            .from('segments')
            .select('*', { count: 'exact', head: true })
            .eq('recording_id', uploadRecording.id);

        const nextIndex = (segmentCount || 0) + 1;

        // Create a segment record with correct schema columns
        const { data: segment, error: segmentError } = await supabase
            .from('segments')
            .insert({
                recording_id: uploadRecording.id,
                segment_index: nextIndex,
                file_path: filePath,
                duration_seconds: 0,
                start_time_in_recording: 0,
                file_size_bytes: buffer.length,
                status: 'active'
            })
            .select()
            .single();

        if (segmentError) {
            console.error('Segment error:', segmentError);
            return NextResponse.json({ error: `Failed to create segment: ${segmentError.message}` }, { status: 500 });
        }

        console.log('Segment created:', segment.id);

        return NextResponse.json({
            success: true,
            segmentId: segment.id,
            filePath: filePath
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
