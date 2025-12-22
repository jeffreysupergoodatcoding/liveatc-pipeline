import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get today's date at midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count ranked today
        const { count: rankedToday, error: todayError } = await supabase
            .from('model_outputs')
            .select('*', { count: 'exact', head: true })
            .gte('ranked_at', today.toISOString())
            .not('ranked_at', 'is', null);

        if (todayError) throw todayError;

        // Count total ranked
        const { count: totalRanked, error: totalError } = await supabase
            .from('model_outputs')
            .select('*', { count: 'exact', head: true })
            .not('ranked_at', 'is', null);

        if (totalError) throw totalError;

        // Calculate average time
        const { data: avgData, error: avgError } = await supabase
            .from('model_outputs')
            .select('ranking_time_seconds')
            .not('ranking_time_seconds', 'is', null);

        if (avgError) throw avgError;

        let avgMinutes = 0;
        if (avgData && avgData.length > 0) {
            const totalSeconds = avgData.reduce((sum, item) => sum + (item.ranking_time_seconds || 0), 0);
            avgMinutes = Math.round((totalSeconds / avgData.length) / 60 * 10) / 10;
        }

        return NextResponse.json({
            success: true,
            data: {
                rankedToday: rankedToday || 0,
                totalRanked: totalRanked || 0,
                avgMinutes: avgMinutes
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch statistics',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
