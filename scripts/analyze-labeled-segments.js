#!/usr/bin/env node

/**
 * Analyze Labeled Segments
 * 
 * This script analyzes your labeled segments to understand [UNKNOWN] usage patterns
 * and help decide on the best training data strategy.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function analyzeLabeledSegments() {
    console.log('🔍 Analyzing Labeled Segments...\n');

    // Fetch all labeled segments
    const { data: labels, error } = await supabase
        .from('segment_labels')
        .select(`
      id,
      segment_id,
      transcription,
      response,
      created_at,
      segments (
        id,
        duration_seconds,
        transcription_confidence,
        file_path,
        trimmed_file_path
      )
    `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching labels:', error);
        return;
    }

    if (!labels || labels.length === 0) {
        console.log('⚠️  No labeled segments found.');
        return;
    }

    console.log(`📊 Found ${labels.length} labeled segments\n`);

    // Analyze patterns
    const stats = {
        total: labels.length,
        withUnknown: 0,
        clean: 0,
        trimmed: 0,
        unknownCounts: {},
        totalWords: 0,
        unknownWords: 0,
        segmentLengths: [],
        examples: {
            clean: [],
            withUnknown: []
        }
    };

    labels.forEach(label => {
        const text = label.transcription || '';
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const unknownMatches = text.match(/\[UNKNOWN\]/g);
        const unknownCount = unknownMatches ? unknownMatches.length : 0;

        stats.totalWords += words.length;
        stats.unknownWords += unknownCount;

        if (label.segments?.trimmed_file_path) {
            stats.trimmed++;
        }

        if (unknownCount > 0) {
            stats.withUnknown++;
            stats.unknownCounts[unknownCount] = (stats.unknownCounts[unknownCount] || 0) + 1;

            // Save example
            if (stats.examples.withUnknown.length < 10) {
                stats.examples.withUnknown.push({
                    text: text,
                    unknownCount: unknownCount,
                    duration: label.segments?.duration_seconds,
                    wordCount: words.length
                });
            }
        } else {
            stats.clean++;

            // Save example
            if (stats.examples.clean.length < 5) {
                stats.examples.clean.push({
                    text: text,
                    duration: label.segments?.duration_seconds,
                    wordCount: words.length
                });
            }
        }

        if (label.segments?.duration_seconds) {
            stats.segmentLengths.push(label.segments.duration_seconds);
        }
    });

    // Calculate averages
    const avgLength = stats.segmentLengths.length > 0
        ? stats.segmentLengths.reduce((a, b) => a + b, 0) / stats.segmentLengths.length
        : 0;

    const avgWordsPerSegment = stats.totalWords / stats.total;
    const percentUnknown = (stats.withUnknown / stats.total * 100).toFixed(1);
    const percentClean = (stats.clean / stats.total * 100).toFixed(1);

    // Display results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 OVERALL STATISTICS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Labeled:           ${stats.total}`);
    console.log(`✅ Clean (no [UNKNOWN]): ${stats.clean} (${percentClean}%)`);
    console.log(`⚠️  Contains [UNKNOWN]:   ${stats.withUnknown} (${percentUnknown}%)`);
    console.log(`✂️  Trimmed segments:     ${stats.trimmed}`);
    console.log('');
    console.log(`Average segment length:  ${avgLength.toFixed(2)}s`);
    console.log(`Average words/segment:   ${avgWordsPerSegment.toFixed(1)}`);
    console.log(`Total words:             ${stats.totalWords}`);
    console.log(`[UNKNOWN] markers:       ${stats.unknownWords}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 [UNKNOWN] DISTRIBUTION');
    console.log('═══════════════════════════════════════════════════════════');
    Object.entries(stats.unknownCounts)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([count, segments]) => {
            console.log(`${count} [UNKNOWN](s): ${segments} segments`);
        });
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CLEAN EXAMPLES (First 5)');
    console.log('═══════════════════════════════════════════════════════════');
    stats.examples.clean.forEach((ex, i) => {
        console.log(`${i + 1}. [${ex.duration?.toFixed(1)}s, ${ex.wordCount} words]`);
        console.log(`   "${ex.text}"`);
        console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️  [UNKNOWN] EXAMPLES (First 10)');
    console.log('═══════════════════════════════════════════════════════════');
    stats.examples.withUnknown.forEach((ex, i) => {
        console.log(`${i + 1}. [${ex.duration?.toFixed(1)}s, ${ex.wordCount} words, ${ex.unknownCount} UNKNOWN(s)]`);
        console.log(`   "${ex.text}"`);
        console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('💡 RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════');

    if (percentClean >= 70) {
        console.log('✅ You have a good ratio of clean segments!');
        console.log('   → Strategy: Filter out [UNKNOWN] segments during export');
        console.log(`   → Training set size: ~${stats.clean} segments`);
    } else if (percentClean >= 40) {
        console.log('⚠️  Moderate [UNKNOWN] usage.');
        console.log('   → Strategy: Consider splitting segments at [UNKNOWN] boundaries');
        console.log('   → OR: Filter and collect more clean labels');
    } else {
        console.log('❌ High [UNKNOWN] usage - most segments have unclear portions');
        console.log('   → Strategy: Either split segments OR collect new, cleaner data');
        console.log('   → Consider adjusting your labeling criteria');
    }

    console.log('');

    const multiUnknown = Object.entries(stats.unknownCounts)
        .filter(([count]) => parseInt(count) > 1)
        .reduce((sum, [, segments]) => sum + segments, 0);

    if (multiUnknown > stats.withUnknown * 0.3) {
        console.log('⚠️  Many segments have multiple [UNKNOWN] markers');
        console.log('   → Splitting these would likely produce very short chunks');
        console.log('   → Better to filter them out entirely');
    } else {
        console.log('✅ Most [UNKNOWN] segments have just 1-2 markers');
        console.log('   → Splitting might be viable if you have word timestamps');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
}

analyzeLabeledSegments().catch(console.error);
