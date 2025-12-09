import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
    console.log('\n=== APPLYING MIGRATION: Add manual_transcription column ===\n');

    const sql = `
    ALTER TABLE segments
    ADD COLUMN IF NOT EXISTS manual_transcription BOOLEAN DEFAULT FALSE;
  `;

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // Try direct query if RPC doesn't work
            console.log('Trying direct approach...');

            // Use the SQL editor approach
            const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'apikey': process.env.SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: sql })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
        }

        console.log('✅ Migration applied successfully!');
        console.log('\nVerifying...');

        // Verify the column was added
        const { data: segment } = await supabase
            .from('segments')
            .select('manual_transcription')
            .limit(1)
            .single();

        if (segment && 'manual_transcription' in segment) {
            console.log('✅ Column verified: manual_transcription exists');
        } else {
            console.log('⚠️  Could not verify column - please check Supabase dashboard');
        }

    } catch (error) {
        console.error('❌ Error applying migration:', error.message);
        console.log('\n📝 Please apply this SQL manually in Supabase SQL Editor:');
        console.log(sql);
    }
}

applyMigration().then(() => process.exit(0));
