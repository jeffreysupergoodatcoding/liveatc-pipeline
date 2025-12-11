import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Process high-confidence segments through the RLHF pipeline
 * 
 * Usage:
 *   node scripts/process-high-confidence.js --limit 10
 *   node scripts/process-high-confidence.js --all
 */

async function processHighConfidenceSegments(options = {}) {
    const { limit = 10, minConfidence = 0.90 } = options;

    console.log('🔍 Finding high-confidence segments from edge detection pipeline...');
    console.log(`   Looking for: rlhf_candidate = true`);
    console.log(`   Limit: ${limit === Infinity ? 'all' : limit}`);

    // Find segments marked as RLHF candidates by the confidence pipeline
    // that haven't been processed yet
    let query = supabase
        .from('segments')
        .select('id, transcription_text, transcription_confidence, file_path')
        .eq('rlhf_candidate', true)  // Only segments from confidence pipeline
        .not('file_path', 'is', null)
        .neq('status', 'needs_ranking')  // Not already processed
        .order('transcription_confidence', { ascending: false });

    if (limit !== Infinity) {
        query = query.limit(limit);
    }

    const { data: segments, error } = await query;

    if (error) {
        console.error('❌ Error fetching segments:', error);
        return;
    }

    if (!segments || segments.length === 0) {
        console.log('✅ No high-confidence segments found to process');
        return;
    }

    console.log(`\n📊 Found ${segments.length} segments to process\n`);

    const results = {
        total: segments.length,
        processed: 0,
        highConfidence: 0,
        lowConfidence: 0,
        errors: 0,
        details: []
    };

    // Process each segment
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        console.log(`\n[${i + 1}/${segments.length}] Processing segment ${segment.id}`);
        console.log(`   Current confidence: ${(segment.transcription_confidence * 100).toFixed(2)}%`);

        try {
            // Call the process-audio API
            const response = await fetch('http://localhost:3000/api/process-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ segmentId: segment.id }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'API request failed');
            }

            results.processed++;

            if (result.status === 'high_confidence') {
                results.highConfidence++;
                console.log(`   ✅ High confidence: ${(result.confidence * 100).toFixed(2)}%`);
                console.log(`   📝 Generated ${result.variations.length} variations`);
                console.log(`   🎯 Status: ${result.next_step}`);
            } else {
                results.lowConfidence++;
                console.log(`   ⚠️  Low confidence: ${(result.confidence * 100).toFixed(2)}%`);
                console.log(`   👤 Status: ${result.next_step}`);
            }

            results.details.push({
                segmentId: segment.id,
                status: result.status,
                confidence: result.confidence,
                variationCount: result.variations?.length || 0
            });

            // Rate limiting - wait 1 second between requests
            if (i < segments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            results.errors++;
            console.error(`   ❌ Error processing segment:`, error.message);
            results.details.push({
                segmentId: segment.id,
                error: error.message
            });
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total segments:        ${results.total}`);
    console.log(`Successfully processed: ${results.processed}`);
    console.log(`High confidence:       ${results.highConfidence} (ready for ranking)`);
    console.log(`Low confidence:        ${results.lowConfidence} (needs human review)`);
    console.log(`Errors:                ${results.errors}`);
    console.log('='.repeat(60) + '\n');

    return results;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    limit: 10,
    minConfidence: 0.90
};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
        options.limit = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--all') {
        options.limit = Infinity;
    } else if (args[i] === '--min-confidence' && args[i + 1]) {
        options.minConfidence = parseFloat(args[i + 1]);
        i++;
    }
}

// Run the script
console.log('🚀 Starting high-confidence segment processing...\n');
processHighConfidenceSegments(options)
    .then(() => {
        console.log('✅ Processing complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
