import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabase-server.js';
import { createClient } from '@deepgram/sdk';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../../lib/logger.js';

/**
 * POST /api/process-audio
 * Process a segment with Deepgram to get 3 alternative transcriptions
 * 
 * Request body:
 * {
 *   "segmentId": "uuid-of-segment"
 * }
 * 
 * Response:
 * - High confidence (>=85%): { status: 'high_confidence', variations: [...], next_step: 'needs_ranking' }
 * - Low confidence (<85%): { status: 'low_confidence', confidence: X, next_step: 'needs_human_review' }
 */
export async function POST(request) {
  try {
    const { segmentId } = await request.json();

    if (!segmentId) {
      return NextResponse.json(
        { error: 'segmentId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Fetch segment from database
    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('*')
      .eq('id', segmentId)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    if (!segment.file_path) {
      return NextResponse.json(
        { error: 'Segment has no audio file' },
        { status: 400 }
      );
    }

    // Download audio file from Supabase Storage
    const { data: audioData, error: downloadError } = await supabase
      .storage
      .from('liveatc-segments')
      .download(segment.file_path);

    if (downloadError || !audioData) {
      logger.error('Error downloading audio:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download audio file' },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const audioBuffer = Buffer.from(await audioData.arrayBuffer());

    // Initialize Deepgram client
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    const deepgram = createClient(deepgramApiKey);

    // Call Deepgram API with 3 different models to get diverse variations
    // nova-2: Most accurate, latest model
    // enhanced: Balanced accuracy and speed
    // base: Faster, good baseline for comparison
    logger.info('Calling Deepgram API with 3 different models...');

    const models = [
      { name: 'nova-2', description: 'Most accurate, latest model' },
      { name: 'enhanced', description: 'Balanced accuracy and speed' },
      { name: 'base', description: 'Faster, good for general use' }
    ];

    const transcriptionPromises = models.map((modelInfo, index) =>
      deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: modelInfo.name,
          language: 'en',
          smart_format: true,
          punctuate: true,
          words: true, // Enable word-level confidence and timestamps
          keywords: [
            'mayday:5',
            'pan-pan:5',
            'runway:3',
            'taxiway:3',
            'clearance:3',
            'altitude:3',
            'heading:3',
            'emergency:4',
            'traffic:3',
            'squawk:3',
            'TCAS:4',
            'hold short:4',
            'line up and wait:4',
            'cleared to land:4',
            'cleared for takeoff:4',
            'go around:4',
            'unable:3',
            'wilco:3',
            'roger:2',
            'affirm:3',
            'negative:3'
          ]
        }
      ).then(response => ({
        response,
        modelUsed: modelInfo.name,
        modelDescription: modelInfo.description,
        rankPosition: index + 1
      }))
    );

    // Wait for all 3 transcriptions to complete
    const modelResults = await Promise.all(transcriptionPromises);
    logger.info(`Received ${modelResults.length} transcription responses from different models`);

    // Extract transcriptions from all responses
    const variations = [];
    for (let i = 0; i < modelResults.length; i++) {
      const { response, modelUsed, modelDescription, rankPosition } = modelResults[i];
      const result = response.result || response.results || response;
      const deepgramResults = result.results || result;

      if (!deepgramResults || !deepgramResults.channels || !deepgramResults.channels[0]) {
        logger.error(`Invalid response structure for model ${modelUsed}`);
        continue;
      }

      const channel = deepgramResults.channels[0];
      const alternatives = channel.alternatives || [];

      if (alternatives.length === 0) {
        logger.error(`No alternatives in response from model ${modelUsed}`);
        continue;
      }

      const alternative = alternatives[0];

      // Extract word-level confidence if available
      const words = alternative.words || [];
      const wordConfidences = words.map(word => ({
        word: word.word,
        confidence: word.confidence,
        start: word.start,
        end: word.end
      }));

      variations.push({
        text: alternative.transcript,
        confidence: alternative.confidence,
        words: wordConfidences, // Add word-level confidence
        rank_position: rankPosition,
        model: modelUsed,
        model_description: modelDescription
      });
    }

    if (variations.length === 0) {
      return NextResponse.json(
        { error: 'No transcription variations returned' },
        { status: 500 }
      );
    }

    logger.info(`Successfully generated ${variations.length} variations from models: ${variations.map(v => v.model).join(', ')}`);

    // Use the first variation (nova-2) as primary since it's most accurate
    const primary = variations[0];
    const primaryConfidence = primary.confidence;

    // Check confidence threshold (85%)
    if (primaryConfidence >= 0.85) {
      // High confidence - store for RLHF ranking

      // Update segment
      const { error: updateError } = await supabase
        .from('segments')
        .update({
          transcription_text: primary.transcript,
          transcription_confidence: primaryConfidence,
          status: 'needs_ranking'
        })
        .eq('id', segmentId);

      if (updateError) {
        logger.error('Error updating segment:', updateError);
        return NextResponse.json(
          { error: 'Failed to update segment' },
          { status: 500 }
        );
      }

      // Insert into model_outputs table
      const { error: insertError } = await supabase
        .from('model_outputs')
        .insert({
          segment_id: segmentId,
          variations: variations,
          needs_ranking: true
        });

      if (insertError) {
        logger.error('Error inserting model outputs:', insertError);
        return NextResponse.json(
          { error: 'Failed to store model outputs' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: 'high_confidence',
        confidence: primaryConfidence,
        variations: variations,
        next_step: 'needs_ranking',
        message: 'Segment ready for RLHF ranking'
      });

    } else {
      // Low confidence - flag for human review

      const { error: updateError } = await supabase
        .from('segments')
        .update({
          transcription_text: primary.transcript,
          transcription_confidence: primaryConfidence,
          needs_human_review: true,
          status: 'needs_human_review'
        })
        .eq('id', segmentId);

      if (updateError) {
        logger.error('Error updating segment:', updateError);
        return NextResponse.json(
          { error: 'Failed to update segment' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: 'low_confidence',
        confidence: primaryConfidence,
        transcription: primary.transcript,
        variations: variations,  // Include variations for debugging/review
        next_step: 'needs_human_review',
        message: 'Segment flagged for human review'
      });
    }

  } catch (error) {
    logger.error('Error processing audio:', error);
    return NextResponse.json(
      {
        error: 'Failed to process audio',
        details: error.message
      },
      { status: 500 }
    );
  }
}
