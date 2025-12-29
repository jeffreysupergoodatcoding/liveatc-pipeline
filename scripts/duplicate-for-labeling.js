#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function duplicateHighConfidenceToLowConfidence() {
    console.log('=== Duplicating High Confidence Segments for Manual Labeling ===\n');

    try {
        // Get all high confidence RLHF candidates
        const { data: highConfSegments, error: fetchError } = await supabase
            .from('segments')
            .select('*')
            .eq('rlhf_candidate', true)
            .eq('needs_human_review', false);

        if (fetchError) {
            console.error('Error fetching segments:', fetchError);
            return;
        }

        console.log(`Found ${highConfSegments.length} high confidence segments to duplicate\n`);

        if (highConfSegments.length === 0) {
            console.log('No segments to duplicate.');
            return;
        }

        let duplicated = 0;

        for (const segment of highConfSegments) {
            console.log(`Duplicating segment ${segment.id}...`);

            // Get the max segment_index for this recording to avoid conflicts
            const { data: maxSegment } = await supabase
                .from('segments')
                .select('segment_index')
                .eq('recording_id', segment.recording_id)
                .order('segment_index', { ascending: false })
                .limit(1)
                .single();

            const newSegmentIndex = (maxSegment?.segment_index || 0) + 1;

            // Create a duplicate with needs_human_review = true
            const { data: duplicate, error: insertError } = await supabase
                .from('segments')
                .insert({
                    recording_id: segment.recording_id,
                    segment_index: newSegmentIndex,  // Use new index to avoid conflict
                    file_path: segment.file_path,
                    duration_seconds: segment.duration_seconds,
                    start_time_in_recording: segment.start_time_in_recording,
                    file_size_bytes: segment.file_size_bytes,
                    audio_quality_score: segment.audio_quality_score,
                    transcription_text: segment.transcription_text,
                    transcription_confidence: segment.transcription_confidence,
                    transcription_model: segment.transcription_model,
                    model_outputs: segment.model_outputs,
                    status: 'active',
                    needs_human_review: true,  // Mark for human review
                    rlhf_candidate: false      // Not an RLHF candidate
                })
                .select()
                .single();

            if (insertError) {
                console.error(`  Error duplicating segment ${segment.id}:`, insertError.message);
                continue;
            }

            console.log(`  ✓ Created duplicate: ${duplicate.id} (index: ${newSegmentIndex})`);
            duplicated++;
        }

        console.log(`\n=== Complete ===`);
        console.log(`Successfully duplicated ${duplicated}/${highConfSegments.length} segments`);
        console.log(`These segments are now available in the Low Confidence tab for manual labeling.`);

    } catch (error) {
        console.error('Error:', error);
    }
}

duplicateHighConfidenceToLowConfidence();
