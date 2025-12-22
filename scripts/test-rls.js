import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('Testing RLS with anon key (what frontend uses):\n');

// Try to read segments
const { data: segments, error: readError } = await supabase
  .from('segments')
  .select('id, audio_analysis_score')
  .limit(1);

if (readError) {
  console.log('❌ READ blocked by RLS:', readError.message);
  console.log('   Code:', readError.code);
} else {
  console.log('✅ READ allowed:', segments?.length || 0, 'segment(s)');
}

// Try to write (should be blocked if RLS is working)
const { data: writeData, error: writeError } = await supabase
  .from('segments')
  .update({ audio_analysis_score: 0.99 })
  .eq('id', '00000000-0000-0000-0000-000000000000');

if (writeError) {
  if (writeError.code === '42501') {
    console.log('✅ WRITE blocked by RLS (SECURE!)');
  } else {
    console.log('✅ WRITE failed:', writeError.message);
  }
} else {
  console.log('⚠️  WRITE allowed - RLS may not be configured!');
}

// Try to delete (should be blocked)
const { error: deleteError } = await supabase
  .from('segments')
  .delete()
  .eq('id', '00000000-0000-0000-0000-000000000000');

if (deleteError) {
  if (deleteError.code === '42501') {
    console.log('✅ DELETE blocked by RLS (SECURE!)');
  } else {
    console.log('✅ DELETE failed:', deleteError.message);
  }
} else {
  console.log('⚠️  DELETE allowed - RLS may not be configured!');
}

console.log('\n=== RLS Security Assessment ===');
console.log('If READS work but WRITES/DELETES are blocked:');
console.log('  → RLS is properly configured ✅');
console.log('  → Frontend queries are SAFE ✅');
console.log('  → Same capabilities as API routes for reads ✅');

process.exit(0);
