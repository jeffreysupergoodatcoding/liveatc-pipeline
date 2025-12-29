#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Delete recordings by ID
 * Usage: node delete-recordings.js <recording-id-1> <recording-id-2> ...
 */

async function deleteRecording(recordingId) {
    console.log(`\nDeleting recording: ${recordingId}`);

    try {
        // Get recording details first
        const { data: recording, error: fetchError } = await supabase
            .from('recordings')
            .select('*')
            .eq('id', recordingId)
            .single();

        if (fetchError || !recording) {
            console.error(`  ❌ Recording not found: ${fetchError?.message || 'Not found'}`);
            return { success: false, error: 'Recording not found' };
        }

        console.log(`  Airport: ${recording.airport} - ${recording.facility}`);
        console.log(`  Segments: ${recording.segment_count}`);

        // Delete from storage if raw file exists
        if (recording.raw_file_path) {
            console.log(`  Deleting from storage: ${recording.raw_file_path}`);
            const { error: storageError } = await supabase.storage
                .from('liveatc-raw')
                .remove([recording.raw_file_path]);

            if (storageError) {
                console.error(`  ⚠️  Storage deletion failed: ${storageError.message}`);
            } else {
                console.log(`  ✓ Deleted from storage`);
            }
        }

        // Delete segment files from storage (cascade will delete DB records)
        const { data: segments, error: segError } = await supabase
            .from('segments')
            .select('file_path')
            .eq('recording_id', recordingId);

        if (segments && segments.length > 0) {
            console.log(`  Deleting ${segments.length} segment files...`);
            const segmentPaths = segments.map(s => s.file_path);
            const { error: segStorageError } = await supabase.storage
                .from('liveatc-segments')
                .remove(segmentPaths);

            if (segStorageError) {
                console.error(`  ⚠️  Segment storage deletion failed: ${segStorageError.message}`);
            } else {
                console.log(`  ✓ Deleted ${segments.length} segment files`);
            }
        }

        // Delete from database (cascade will delete segments)
        const { error: deleteError } = await supabase
            .from('recordings')
            .delete()
            .eq('id', recordingId);

        if (deleteError) {
            console.error(`  ❌ Database deletion failed: ${deleteError.message}`);
            return { success: false, error: deleteError.message };
        }

        console.log(`  ✅ Recording deleted successfully`);
        return { success: true };

    } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    const recordingIds = process.argv.slice(2);

    if (recordingIds.length === 0) {
        console.error('Usage: node delete-recordings.js <recording-id-1> <recording-id-2> ...');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('Delete Recordings');
    console.log('='.repeat(60));
    console.log(`Deleting ${recordingIds.length} recording(s)...`);

    let successCount = 0;
    let errorCount = 0;

    for (const id of recordingIds) {
        const result = await deleteRecording(id);
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Deletion Complete');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    process.exit(errorCount > 0 ? 1 : 0);
}

main();
