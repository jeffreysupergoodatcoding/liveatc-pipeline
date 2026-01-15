import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkCounts() {
    // Total count
    const { count: totalCount, error: totalError } = await supabase
        .from('segment_labels')
        .select('*', { count: 'exact', head: true });
    
    if (totalError) {
        console.error('Error getting total count:', totalError);
        return;
    }
    
    console.log(`📊 Total segments in segment_labels: ${totalCount}`);
    
    // Clean segments (no [UNKNOWN])
    const { count: cleanCount, error: cleanError } = await supabase
        .from('segment_labels')
        .select('*', { count: 'exact', head: true })
        .not('transcription', 'like', '%[UNKNOWN]%');
    
    if (cleanError) {
        console.error('Error getting clean count:', cleanError);
        return;
    }
    
    console.log(`✅ Clean segments (no [UNKNOWN]): ${cleanCount}`);
    console.log(`⚠️  Segments with [UNKNOWN]: ${totalCount - cleanCount}`);
    
    // Show the one with [UNKNOWN] if any
    if (totalCount - cleanCount > 0) {
        const { data: unknownSegs, error: unknownError } = await supabase
            .from('segment_labels')
            .select('id, transcription')
            .like('transcription', '%[UNKNOWN]%');
        
        if (!unknownError && unknownSegs) {
            console.log(`\n🔍 Segments with [UNKNOWN]:`);
            unknownSegs.forEach(seg => {
                console.log(`   ID: ${seg.id}`);
                console.log(`   Text: "${seg.transcription.substring(0, 100)}..."`);
                console.log('');
            });
        }
    }
}

checkCounts().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
