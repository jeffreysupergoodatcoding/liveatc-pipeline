#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Cleanup Old Recordings Script
 * Deletes recordings and their associated files older than a specified number of days
 * 
 * Usage:
 *   node cleanup-old-recordings.js --days 30
 *   node cleanup-old-recordings.js --days 7 --dry-run
 */

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        days: 30,
        dryRun: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) {
            parsed.days = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--dry-run') {
            parsed.dryRun = true;
        }
    }

    return parsed;
}

async function getOldRecordings(daysOld) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    console.log(`Finding recordings older than ${cutoffDate.toISOString()}...`);

    const { data, error } = await supabase
        .from('recordings')
        .select('id, raw_file_path, created_at, airport, facility')
        .lt('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch recordings: ${error.message}`);
    }

    return data || [];
}

async function getSegmentsForRecording(recordingId) {
    const { data, error } = await supabase
        .from('segments')
        .select('id, file_path')
        .eq('recording_id', recordingId);

    if (error) {
        throw new Error(`Failed to fetch segments: ${error.message}`);
    }

    return data || [];
}

async function deleteFile(filePath, bucketName) {
    const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

    if (error) {
        console.error(`  ⚠️  Failed to delete ${filePath}: ${error.message}`);
        return false;
    }

    return true;
}

async function deleteRecording(recording, dryRun = false) {
    console.log(`\nProcessing: ${recording.airport} ${recording.facility} - ${recording.created_at}`);

    // Get all segments
    const segments = await getSegmentsForRecording(recording.id);
    console.log(`  Found ${segments.length} segments`);

    if (dryRun) {
        console.log(`  [DRY RUN] Would delete:`);
        console.log(`    - Raw file: ${recording.raw_file_path}`);
        console.log(`    - ${segments.length} segment files`);
        console.log(`    - ${segments.length} segment database records`);
        console.log(`    - 1 recording database record`);
        return {
            success: true,
            filesDeleted: segments.length + 1,
            bytesFreed: 0 // Can't calculate in dry run
        };
    }

    let filesDeleted = 0;
    let errors = 0;

    // Delete segment files from storage
    for (const segment of segments) {
        const success = await deleteFile(segment.file_path, 'liveatc-segments');
        if (success) filesDeleted++;
        else errors++;
    }

    // Delete raw file from storage
    const rawDeleted = await deleteFile(recording.raw_file_path, 'liveatc-raw');
    if (rawDeleted) filesDeleted++;
    else errors++;

    // Delete segments from database
    const { error: segmentError } = await supabase
        .from('segments')
        .delete()
        .eq('recording_id', recording.id);

    if (segmentError) {
        console.error(`  ⚠️  Failed to delete segment records: ${segmentError.message}`);
        errors++;
    } else {
        console.log(`  ✓ Deleted ${segments.length} segment records`);
    }

    // Delete recording from database
    const { error: recordingError } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recording.id);

    if (recordingError) {
        console.error(`  ⚠️  Failed to delete recording record: ${recordingError.message}`);
        errors++;
    } else {
        console.log(`  ✓ Deleted recording record`);
    }

    return {
        success: errors === 0,
        filesDeleted,
        errors
    };
}

async function getStorageStats() {
    // Get total recordings
    const { count: recordingCount } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true });

    // Get total segments
    const { count: segmentCount } = await supabase
        .from('segments')
        .select('*', { count: 'exact', head: true });

    return {
        recordings: recordingCount || 0,
        segments: segmentCount || 0
    };
}

async function main() {
    const args = parseArgs();

    console.log('='.repeat(60));
    console.log('LiveATC Cleanup Script');
    console.log('='.repeat(60));
    console.log(`Mode: ${args.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
    console.log(`Deleting recordings older than: ${args.days} days`);
    console.log('');

    // Get current stats
    const statsBefore = await getStorageStats();
    console.log('Current Storage:');
    console.log(`  Recordings: ${statsBefore.recordings}`);
    console.log(`  Segments: ${statsBefore.segments}`);
    console.log('');

    // Get old recordings
    const oldRecordings = await getOldRecordings(args.days);

    if (oldRecordings.length === 0) {
        console.log(`✓ No recordings older than ${args.days} days found.`);
        process.exit(0);
    }

    console.log(`Found ${oldRecordings.length} recordings to delete`);
    console.log('');

    // Confirm if not dry run
    if (!args.dryRun) {
        console.log('⚠️  WARNING: This will permanently delete data!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('');
    }

    // Delete recordings
    let totalFilesDeleted = 0;
    let totalErrors = 0;
    let successCount = 0;

    for (let i = 0; i < oldRecordings.length; i++) {
        const recording = oldRecordings[i];
        process.stdout.write(`\rProgress: ${i + 1}/${oldRecordings.length}`);

        const result = await deleteRecording(recording, args.dryRun);

        if (result.success) {
            successCount++;
            totalFilesDeleted += result.filesDeleted;
        } else {
            totalErrors += result.errors;
        }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('Cleanup Complete');
    console.log('='.repeat(60));
    console.log(`Successfully processed: ${successCount}/${oldRecordings.length} recordings`);
    console.log(`Files deleted: ${totalFilesDeleted}`);
    if (totalErrors > 0) {
        console.log(`Errors: ${totalErrors}`);
    }

    if (!args.dryRun) {
        const statsAfter = await getStorageStats();
        console.log('');
        console.log('Storage After Cleanup:');
        console.log(`  Recordings: ${statsAfter.recordings} (${statsBefore.recordings - statsAfter.recordings} deleted)`);
        console.log(`  Segments: ${statsAfter.segments} (${statsBefore.segments - statsAfter.segments} deleted)`);
    }

    process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('Cleanup failed:', error.message);
    process.exit(1);
});
