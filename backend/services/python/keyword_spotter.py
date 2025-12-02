#!/usr/bin/env python3
"""
Deepgram Keyword Spotting
Cheap keyword detection without full transcription (~$0.01 per clip vs $0.04)
"""

import sys
import json
import os
from deepgram import DeepgramClient, PrerecordedOptions, FileSource

# Critical aviation keywords
KEYWORDS = [
    'emergency', 'mayday', 'pan pan', 'unable', 'stop',
    'go around', 'missed approach', 'abort', 'pull up',
    'terrain', 'tcas', 'traffic', 'conflict', 'warning',
    'caution', 'alert', 'failed', 'failure', 'lost',
    'minimum fuel', 'priority'
]

class KeywordSpotter:
    def __init__(self, api_key):
        self.client = DeepgramClient(api_key)

    def spot_keywords(self, audio_path):
        """
        Use Deepgram with keyword boosting for cheap keyword detection
        Returns: {keywords_found, confidence, should_transcribe}
        """
        try:
            with open(audio_path, 'rb') as audio:
                buffer_data = audio.read()

            payload: FileSource = {
                'buffer': buffer_data,
            }

            # Use keyword search mode (cheaper than full transcription)
            options = PrerecordedOptions(
                model='nova-2',
                smart_format=True,
                keywords=KEYWORDS,  # Boost these keywords
                keywords_threshold=0.5,  # Lower threshold for detection
                diarize=False,  # Don't need speaker diarization
                punctuate=False,  # Don't need punctuation
                utterances=False,  # Don't need utterance detection
            )

            response = self.client.listen.prerecorded.v('1').transcribe_file(
                payload, options
            )

            # Extract results
            results = response.to_dict()

            # Get transcript and check for keywords
            transcript = ''
            if results.get('results') and results['results'].get('channels'):
                channel = results['results']['channels'][0]
                if channel.get('alternatives'):
                    transcript = channel['alternatives'][0].get('transcript', '')

            # Check which keywords were found
            keywords_found = []
            for keyword in KEYWORDS:
                if keyword.lower() in transcript.lower():
                    keywords_found.append(keyword)

            # Get confidence
            confidence = 0.0
            if results.get('results') and results['results'].get('channels'):
                channel = results['results']['channels'][0]
                if channel.get('alternatives'):
                    confidence = channel['alternatives'][0].get('confidence', 0.0)

            # Should fully transcribe if keywords found or low confidence
            should_transcribe = len(keywords_found) > 0 or confidence < 0.7

            return {
                'keywords_found': keywords_found,
                'confidence': round(confidence, 3),
                'should_transcribe': should_transcribe,
                'partial_transcript': transcript[:200],  # First 200 chars only
                'keyword_count': len(keywords_found)
            }

        except Exception as e:
            return {
                'error': str(e),
                'keywords_found': [],
                'confidence': 0.0,
                'should_transcribe': False,
                'keyword_count': 0
            }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: keyword_spotter.py <api_key> <audio_file>'}))
        sys.exit(1)

    api_key = sys.argv[1]
    audio_path = sys.argv[2]

    if not os.path.exists(audio_path):
        print(json.dumps({'error': f'File not found: {audio_path}'}))
        sys.exit(1)

    spotter = KeywordSpotter(api_key)
    result = spotter.spot_keywords(audio_path)

    print(json.dumps(result))


if __name__ == '__main__':
    main()
