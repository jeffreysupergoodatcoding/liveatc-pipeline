import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logger } from '../../../../../lib/logger.js';

/**
 * POST /api/segments/[id]/ai-suggest
 * Get AI-powered transcription suggestion using OpenAI GPT-4
 */
export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const {
            airport,
            facility,
            transcription,
            confidence,
            wordConfidences,
            duration,
            chatHistory,
            userMessage
        } = body;

        // Check for OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Build system message with aviation context
        const systemMessage = {
            role: 'system',
            content: `You are an expert in aviation radio communications and ATC (Air Traffic Control) operations. You are helping review and correct automatic transcriptions of ATC radio transmissions.

Context for this segment:
- Airport: ${airport}
- Facility: ${facility} 
- Duration: ${duration?.toFixed(1)}s
- Automatic transcription: "${transcription}"
- Overall confidence: ${(confidence * 100).toFixed(1)}%

Your expertise includes:
1. Standard aviation phraseology and terminology
2. Airport-specific context (runways, gates, taxiways)
3. Facility type operations (ground control, tower, approach, etc.)
4. Common speech patterns in ATC communications
5. Phonetic alphabet and number pronunciation

When asked for transcription corrections, provide ONLY the corrected text. If parts are unclear, use [UNKNOWN].
For other questions, provide helpful, concise answers based on aviation knowledge and the segment context.`
        };

        logger.info('AI chat request for segment:', id);

        // Build messages array
        const messages = [systemMessage];

        // Add chat history if exists
        if (chatHistory && chatHistory.length > 0) {
            messages.push(...chatHistory);
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.3,
            max_tokens: 500
        });

        const suggestion = completion.choices[0].message.content.trim();

        logger.info('AI response generated');

        return NextResponse.json({
            suggestion,
            model: 'gpt-4o',
            confidence: completion.choices[0].finish_reason === 'stop' ? 'high' : 'medium'
        });

    } catch (error) {
        logger.error('Error generating AI suggestion:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate AI suggestion' },
            { status: 500 }
        );
    }
}

function buildPrompt({ airport, facility, transcription, confidence, wordConfidences, duration }) {
    let prompt = `Airport: ${airport}\n`;
    prompt += `Facility: ${facility}\n`;
    prompt += `Duration: ${duration?.toFixed(1)}s\n`;
    prompt += `Overall Confidence: ${(confidence * 100).toFixed(1)}%\n\n`;

    prompt += `Automatic Transcription (potentially incorrect):\n"${transcription}"\n\n`;

    if (wordConfidences && wordConfidences.length > 0) {
        prompt += `Word-level confidence scores:\n`;
        wordConfidences.forEach((word, idx) => {
            const conf = (word.confidence * 100).toFixed(0);
            prompt += `  ${idx + 1}. "${word.word}" (${conf}%)\n`;
        });
        prompt += `\n`;
    }

    prompt += `Based on the context and low confidence scores, what is the most likely correct transcription? `;
    prompt += `Consider:\n`;
    prompt += `- Standard aviation phraseology\n`;
    prompt += `- ${airport} airport layout and operations\n`;
    prompt += `- ${facility} typical communications\n`;
    prompt += `- Low-confidence words may be mishearing of similar-sounding aviation terms\n\n`;
    prompt += `Provide the corrected transcription:`;

    return prompt;
}
