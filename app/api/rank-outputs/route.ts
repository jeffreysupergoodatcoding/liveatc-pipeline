import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabase-server.js';
import { logger } from '../../../lib/logger.js';

interface ScoreSet {
    accuracy: number;
    completeness: number;
    clarity: number;
}

interface RankingSubmission {
    modelOutputId: string;
    scores: {
        output1: ScoreSet;
        output2: ScoreSet;
        output3: ScoreSet;
    };
    overallRanking: number[]; // e.g., [1, 3, 2] means output1 is 1st, output2 is 3rd, output3 is 2nd
    generalNotes: string;
    outputNotes: {
        output1: string;
        output2: string;
        output3: string;
    };
    timeSpentSeconds: number;
}

export async function POST(request: Request) {
    try {
        const body: RankingSubmission = await request.json();
        const { modelOutputId, scores, overallRanking, generalNotes, outputNotes, timeSpentSeconds } = body;

        // Validate input
        if (!modelOutputId || !scores || !overallRanking || overallRanking.length !== 3) {
            return NextResponse.json(
                { success: false, error: 'Invalid input data' },
                { status: 400 }
            );
        }

        // Use service role to bypass RLS for write operations
        const supabase = getSupabaseServer();

        // Fetch the model output with variations
        const { data: modelOutput, error: fetchError } = await supabase
            .from('model_outputs')
            .select('segment_id, variations')
            .eq('id', modelOutputId)
            .single();

        if (fetchError || !modelOutput) {
            return NextResponse.json(
                { success: false, error: 'Model output not found' },
                { status: 404 }
            );
        }

        const variations = modelOutput.variations as any[];

        // Combine scores with notes for storage
        const detailedScores = {
            output1: { ...scores.output1, note: outputNotes?.output1 || '' },
            output2: { ...scores.output2, note: outputNotes?.output2 || '' },
            output3: { ...scores.output3, note: outputNotes?.output3 || '' }
        };

        // Create preference pairs from ranking
        // For ranking [1, 3, 2], we create pairs: 1>3, 1>2, 2>3
        const preferencePairs = [];
        const rankedIndices = overallRanking.map((rank, idx) => ({ rank, idx }))
            .sort((a, b) => a.rank - b.rank)
            .map(item => item.idx);

        for (let i = 0; i < rankedIndices.length; i++) {
            for (let j = i + 1; j < rankedIndices.length; j++) {
                const betterIdx = rankedIndices[i];
                const worseIdx = rankedIndices[j];

                const betterOutput = variations[betterIdx];
                const worseOutput = variations[worseIdx];

                const betterScores = scores[`output${betterIdx + 1}` as keyof typeof scores];
                const worseScores = scores[`output${worseIdx + 1}` as keyof typeof scores];

                preferencePairs.push({
                    segment_id: modelOutput.segment_id,
                    model_output_id: modelOutputId,
                    prompt: '', // Can be added later if needed
                    chosen: betterOutput.text,
                    rejected: worseOutput.text,
                    chosen_confidence: betterOutput.confidence,
                    rejected_confidence: worseOutput.confidence,
                    chosen_accuracy_score: betterScores.accuracy,
                    chosen_completeness_score: betterScores.completeness,
                    chosen_clarity_score: betterScores.clarity,
                    rejected_accuracy_score: worseScores.accuracy,
                    rejected_completeness_score: worseScores.completeness,
                    rejected_clarity_score: worseScores.clarity,
                    notes: generalNotes,
                    source: 'rlhf'
                });
            }
        }

        // Insert preference pairs
        const { error: pairsError } = await supabase
            .from('preference_pairs')
            .insert(preferencePairs);

        if (pairsError) {
            logger.error('Error inserting preference pairs:', pairsError);
            return NextResponse.json(
                { success: false, error: 'Failed to save preference pairs' },
                { status: 500 }
            );
        }

        // Update model_outputs with detailed scores and ranking
        const { error: updateError } = await supabase
            .from('model_outputs')
            .update({
                detailed_scores: detailedScores,
                overall_ranking: overallRanking,
                notes: generalNotes,
                ranked_at: new Date().toISOString(),
                ranking_time_seconds: timeSpentSeconds,
                needs_ranking: false
            })
            .eq('id', modelOutputId);

        if (updateError) {
            logger.error('Error updating model output:', updateError);
            return NextResponse.json(
                { success: false, error: 'Failed to update model output' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Rankings saved successfully',
            preferencePairsCreated: preferencePairs.length
        });
    } catch (error) {
        logger.error('Error processing ranking submission:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process ranking',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
