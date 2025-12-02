#!/usr/bin/env python3
"""
Keyword Detection for Edge Case Taxonomy
Uses lightweight speech recognition ONLY for keyword spotting, not full transcription
Flags specific edge case keywords while avoiding common aviation phraseology
"""

import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

import whisper
import torch

class KeywordDetector:
    def __init__(self, taxonomy_path):
        """Initialize with edge case taxonomy"""
        with open(taxonomy_path, 'r') as f:
            self.taxonomy = json.load(f)

        # Load tiny Whisper model for fast keyword spotting
        print("Loading Whisper tiny model for keyword detection...", file=sys.stderr)
        self.model = whisper.load_model("tiny")

        # Build keyword index from taxonomy
        self.keyword_index = self._build_keyword_index()

        # Common aviation phraseology to IGNORE (prevent false positives)
        self.common_phraseology = {
            'roger', 'wilco', 'affirm', 'negative', 'standby',
            'contact', 'frequency', 'maintain', 'climb', 'descend',
            'turn', 'heading', 'altitude', 'runway', 'taxi',
            'cleared', 'hold short', 'position and hold',
            'good day', 'good morning', 'good afternoon',
            'understand', 'copied', 'readback correct'
        }

    def _build_keyword_index(self):
        """Build searchable index of keywords from taxonomy"""
        index = {}

        for category_id, category in self.taxonomy['categories'].items():
            for case in category.get('cases', []):
                case_id = case['id']
                keywords = case.get('keywords', [])

                # Store keywords with their edge case info
                index[case_id] = {
                    'name': case['name'],
                    'category': category['name'],
                    'keywords': [kw.lower() for kw in keywords],
                    'severity': case.get('severity_score', 0.5),
                    'description': case['description']
                }

        return index

    def detect(self, audio_path):
        """
        Detect keywords in audio without full transcription
        Returns: {detected_keywords, flagged_cases, keyword_score}
        """
        try:
            # Transcribe audio with Whisper (tiny model, fast)
            # We use word_timestamps to get precise keyword locations
            result = self.model.transcribe(
                audio_path,
                language='en',
                word_timestamps=True,
                fp16=torch.cuda.is_available()
            )

            # Get text segments
            text = result['text'].lower()
            words = text.split()

            # Find keyword matches with word boundary detection
            detected_keywords = []
            flagged_cases = []

            for case_id, case_info in self.keyword_index.items():
                # Check if any keywords from this case appear in text
                matches = []
                for keyword in case_info['keywords']:
                    # Check for multi-word keyword phrases
                    if self._is_keyword_present(keyword, text, words):
                        # Verify it's not just common phraseology
                        if not self._is_common_phraseology_only(keyword):
                            matches.append(keyword)

                if matches:
                    detected_keywords.extend(matches)
                    flagged_cases.append({
                        'case_id': case_id,
                        'name': case_info['name'],
                        'category': case_info['category'],
                        'matched_keywords': matches,
                        'severity': case_info['severity']
                    })

            # Calculate keyword score based on severity of detected cases
            keyword_score = 0.0
            if flagged_cases:
                # Use weighted average of top 3 severities (like audio analysis)
                severities = sorted([c['severity'] for c in flagged_cases], reverse=True)
                if len(severities) >= 1:
                    keyword_score += severities[0] * 0.6
                if len(severities) >= 2:
                    keyword_score += severities[1] * 0.25
                if len(severities) >= 3:
                    keyword_score += severities[2] * 0.15

            return {
                'detected_keywords': list(set(detected_keywords)),
                'flagged_cases': flagged_cases,
                'keyword_score': round(keyword_score, 3),
                'transcription_snippet': result['text'][:200] if result['text'] else None
            }

        except Exception as e:
            return {
                'error': str(e),
                'detected_keywords': [],
                'flagged_cases': [],
                'keyword_score': 0.0
            }

    def _is_keyword_present(self, keyword, text, words):
        """
        Check if keyword is present with proper word boundaries
        Prevents false positives like 'ra' matching 'traffic' or callsigns
        """
        keyword_lower = keyword.lower()

        # For single-word keywords, check word boundaries
        if ' ' not in keyword_lower:
            # Single word - must be a complete word, not substring
            # For very short keywords (1-2 letters), be extra strict
            if len(keyword_lower) <= 2:
                # Must be an exact word match
                return keyword_lower in words
            else:
                # For longer single words, check with word boundaries
                import re
                pattern = r'\b' + re.escape(keyword_lower) + r'\b'
                return bool(re.search(pattern, text))
        else:
            # Multi-word phrase - check if phrase exists
            return keyword_lower in text

    def _is_common_phraseology_only(self, keyword):
        """
        Check if keyword is ONLY common phraseology (should be ignored)
        Returns True if it's common phraseology that would cause false positives
        """
        # Split multi-word keywords
        words = keyword.split()

        # If ALL words are common phraseology, ignore it
        if all(word in self.common_phraseology for word in words):
            return True

        # If it's a single common word with no context, ignore
        if len(words) == 1 and keyword in self.common_phraseology:
            return True

        return False


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: keyword_detector.py <audio_file>'}))
        sys.exit(1)

    audio_path = sys.argv[1]
    taxonomy_path = os.path.join(
        os.path.dirname(__file__),
        '../../data/edge_case_taxonomy.json'
    )

    if not os.path.exists(audio_path):
        print(json.dumps({'error': f'Audio file not found: {audio_path}'}))
        sys.exit(1)

    if not os.path.exists(taxonomy_path):
        print(json.dumps({'error': f'Taxonomy file not found: {taxonomy_path}'}))
        sys.exit(1)

    detector = KeywordDetector(taxonomy_path)
    result = detector.detect(audio_path)

    print(json.dumps(result))


if __name__ == '__main__':
    main()
