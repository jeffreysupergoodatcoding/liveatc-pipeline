#!/usr/bin/env python3
"""
Audio-First Edge Case Analyzer
Analyzes audio features without transcription to reduce costs
"""

import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

import librosa
import numpy as np
from pydub import AudioSegment
import webrtcvad
import soundfile as sf

class AudioAnalyzer:
    def __init__(self, threshold=0.65):
        self.threshold = threshold
        self.vad = webrtcvad.Vad(2)  # Aggressiveness 0-3, 2 is balanced

    def analyze(self, audio_path):
        """
        Analyze audio file for edge case patterns
        Returns: {score, patterns, should_transcribe, features}
        """
        try:
            # Load audio with librosa
            y, sr = librosa.load(audio_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)

            # Initialize results
            patterns = []
            features = {}
            score = 0.0

            # 1. Duration Anomaly Detection
            duration_score, duration_pattern = self._check_duration(duration)
            if duration_pattern:
                patterns.append(duration_pattern)
                score += duration_score
            features['duration'] = duration

            # 2. Volume Spike Detection
            volume_score, volume_pattern = self._check_volume_spikes(y)
            if volume_pattern:
                patterns.append(volume_pattern)
                score += volume_score
            features['volume_variance'] = float(np.std(np.abs(y)))
            features['max_amplitude'] = float(np.max(np.abs(y)))

            # 3. Speech Rate Analysis (tempo)
            tempo_score, tempo_pattern = self._check_speech_rate(y, sr)
            if tempo_pattern:
                patterns.append(tempo_pattern)
                score += tempo_score
            features['tempo'] = float(librosa.beat.tempo(y=y, sr=sr)[0]) if len(y) > sr else 0.0

            # 4. Silence Pattern Detection
            silence_score, silence_pattern = self._check_silence_patterns(audio_path, duration)
            if silence_pattern:
                patterns.append(silence_pattern)
                score += silence_score
            features['silence_ratio'] = silence_score

            # 5. Signal-to-Noise Ratio
            snr_score, snr_pattern = self._check_snr(y)
            if snr_pattern:
                patterns.append(snr_pattern)
                score += snr_score
            features['snr'] = snr_score

            # 6. Speaker Overlap Detection (simplified - full pyAudioAnalysis is complex)
            overlap_score, overlap_pattern = self._check_overlap(y, sr)
            if overlap_pattern:
                patterns.append(overlap_pattern)
                score += overlap_score
            features['energy_variance'] = overlap_score

            # Normalize score to 0-1
            score = min(score, 1.0)

            # Should transcribe if score exceeds threshold
            should_transcribe = score >= self.threshold

            return {
                'score': round(score, 3),
                'patterns': patterns,
                'should_transcribe': should_transcribe,
                'features': features,
                'threshold': self.threshold
            }

        except Exception as e:
            return {
                'error': str(e),
                'score': 0.0,
                'patterns': ['analysis_error'],
                'should_transcribe': False,
                'features': {}
            }

    def _check_duration(self, duration):
        """Check for duration anomalies"""
        score = 0.0
        pattern = None

        if duration > 20:
            score = 0.3
            pattern = 'long_duration'
        elif duration < 2:
            score = 0.4
            pattern = 'cut_off'

        return score, pattern

    def _check_volume_spikes(self, y):
        """Detect volume spikes and audio distortion (stepped-on transmissions, interference)"""
        # Calculate short-term energy
        frame_length = 2048
        hop_length = 512
        energy = np.array([
            np.sum(np.abs(y[i:i+frame_length]**2))
            for i in range(0, len(y)-frame_length, hop_length)
        ])

        if len(energy) == 0:
            return 0.0, None

        mean_energy = np.mean(energy)
        std_energy = np.std(energy)

        # ENHANCED: Check for spikes AND drops (interference causes both)
        # Spikes: >1.8x average (reduced from 2x for better sensitivity)
        spikes = energy > (mean_energy + 1.8 * std_energy)
        spike_ratio = np.sum(spikes) / len(energy)

        # Check for drops (can indicate interference or garbling)
        if mean_energy > 0:
            drops = energy < (mean_energy - 1.5 * std_energy)
            drop_ratio = np.sum(drops) / len(energy)
        else:
            drop_ratio = 0.0

        # INCREASED SENSITIVITY: More than 8% spikes/drops (was 10%)
        if spike_ratio > 0.08:
            return 0.4, 'volume_spike'  # Increased from 0.35
        elif drop_ratio > 0.12:
            return 0.35, 'audio_distortion'  # New pattern

        return 0.0, None

    def _check_speech_rate(self, y, sr):
        """Check for abnormal speech rate"""
        try:
            tempo = librosa.beat.tempo(y=y, sr=sr)[0]

            # Normal speech: 120-180 BPM
            # Fast/urgent: >200 BPM
            if tempo > 200:
                return 0.25, 'rapid_speech'
            elif tempo < 80:
                return 0.15, 'slow_speech'

            return 0.0, None
        except:
            return 0.0, None

    def _check_silence_patterns(self, audio_path, duration):
        """Detect unusual silence patterns using WebRTC VAD"""
        try:
            # Load audio with pydub for VAD processing
            audio = AudioSegment.from_file(audio_path)
            audio = audio.set_frame_rate(16000).set_channels(1)  # VAD requires 16kHz mono

            # Convert to bytes
            audio_data = audio.raw_data

            # Process in 30ms frames (VAD requirement)
            frame_duration_ms = 30
            frame_size = int(16000 * frame_duration_ms / 1000) * 2  # 2 bytes per sample

            num_frames = len(audio_data) // frame_size
            speech_frames = 0
            silence_frames = 0

            for i in range(num_frames):
                frame = audio_data[i*frame_size:(i+1)*frame_size]
                if len(frame) == frame_size:
                    try:
                        is_speech = self.vad.is_speech(frame, 16000)
                        if is_speech:
                            speech_frames += 1
                        else:
                            silence_frames += 1
                    except:
                        pass

            if num_frames == 0:
                return 0.0, None

            silence_ratio = silence_frames / num_frames

            # High silence ratio might indicate cut-offs or issues
            if silence_ratio > 0.6:
                return 0.2, 'excessive_silence'
            elif silence_ratio < 0.1 and duration > 5:
                return 0.25, 'continuous_speech'  # Might be stepped-on

            return silence_ratio, None

        except Exception as e:
            return 0.0, None

    def _check_snr(self, y):
        """Estimate signal-to-noise ratio - ENHANCED for interference detection"""
        try:
            # Use spectral analysis
            S = np.abs(librosa.stft(y))

            # Estimate noise floor (bottom 15th percentile - increased from 10th)
            # Higher percentile catches more interference
            noise_floor = np.percentile(S, 15)
            signal_power = np.mean(S)

            if noise_floor > 0:
                snr = signal_power / noise_floor
            else:
                snr = float('inf')

            # ADJUSTED THRESHOLDS for better interference detection:
            # Severe interference: SNR < 6 (was 5) - score 0.55 (was 0.3)
            # Moderate interference: SNR 6-10 - score 0.45 (new tier)
            # Light interference: SNR 10-15 - score 0.35 (new tier)
            # Good quality: SNR > 15

            if snr < 6:
                return 0.55, 'poor_quality'
            elif snr < 10:
                return 0.45, 'moderate_interference'
            elif snr < 15:
                return 0.35, 'light_interference'

            return min(snr / 25, 1.0), None

        except:
            return 0.5, None

    def _check_overlap(self, y, sr):
        """Detect potential speaker overlaps AND chaotic interference using energy variance"""
        try:
            # Calculate energy over time
            hop_length = 512
            energy = librosa.feature.rms(y=y, hop_length=hop_length)[0]

            # High variance in energy suggests overlapping speech OR interference
            energy_variance = np.std(energy) / (np.mean(energy) + 1e-6)

            # ENHANCED THRESHOLDS for interference:
            # Very high variance (>1.0) = severe interference or multiple overlaps
            # High variance (>0.7, was 0.8) = stepped-on or moderate interference
            # Medium variance (>0.5) = possible audio issues

            if energy_variance > 1.0:
                return 0.45, 'severe_interference'  # New tier
            elif energy_variance > 0.7:  # Reduced from 0.8
                return 0.4, 'stepped_on'  # Increased from 0.35
            elif energy_variance > 0.5:
                return 0.3, 'audio_instability'  # New tier

            return energy_variance, None

        except:
            return 0.0, None


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: audio_analyzer.py <audio_file>'}))
        sys.exit(1)

    audio_path = sys.argv[1]
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.65

    if not os.path.exists(audio_path):
        print(json.dumps({'error': f'File not found: {audio_path}'}))
        sys.exit(1)

    analyzer = AudioAnalyzer(threshold=threshold)
    result = analyzer.analyze(audio_path)

    print(json.dumps(result))


if __name__ == '__main__':
    main()
