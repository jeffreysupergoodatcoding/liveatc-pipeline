'use client';

import { useState, useEffect } from 'react';
import styles from './FlaggedSegments.module.css'; // Reuse same styles
import { supabase } from '../../../../lib/supabase';

export default function AnalyzedSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'with_variants', 'without_variants'

  useEffect(() => {
    fetchAnalyzedSegments();
  }, []);

  async function fetchAnalyzedSegments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('segments')
        .select(`
          *,
          recordings!inner(airport, facility, recorded_at)
        `)
        .eq('rlhf_candidate', true)  // Only show high confidence segments (>= 85%)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to flat structure and fetch model outputs count
      const flatSegments = await Promise.all(data.map(async (segment) => {
        // Check if this segment has model outputs
        const { data: outputs, error: outputError } = await supabase
          .from('model_outputs')
          .select('id, variations')
          .eq('segment_id', segment.id)
          .limit(1);

        const hasVariants = outputs && outputs.length > 0 && outputs[0].variations && outputs[0].variations.length > 0;
        const variantCount = hasVariants ? outputs[0].variations.length : 0;

        return {
          ...segment,
          airport: segment.recordings.airport,
          facility: segment.recordings.facility,
          recorded_at: segment.recordings.recorded_at,
          hasVariants,
          variantCount
        };
      }));

      setSegments(flatSegments);
    } catch (error) {
      console.error('Error fetching analyzed segments:', error);
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredSegments = segments.filter(segment => {
    if (filter === 'with_variants') return segment.hasVariants;
    if (filter === 'without_variants') return !segment.hasVariants;
    return true; // 'all'
  });

  const withVariantsCount = segments.filter(s => s.hasVariants).length;
  const withoutVariantsCount = segments.filter(s => !s.hasVariants).length;

  if (loading) {
    return <div className={styles.loading}>Loading analyzed segments...</div>;
  }

  if (segments.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No analyzed segments yet</p>
        <span>Run audio analysis to see segments here</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${filter === 'all' ? styles.activeTab : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({segments.length})
        </button>
        <button
          className={`${styles.filterTab} ${filter === 'with_variants' ? styles.activeTab : ''}`}
          onClick={() => setFilter('with_variants')}
        >
          With Variants ({withVariantsCount})
        </button>
        <button
          className={`${styles.filterTab} ${filter === 'without_variants' ? styles.activeTab : ''}`}
          onClick={() => setFilter('without_variants')}
        >
          Need Processing ({withoutVariantsCount})
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.segmentList}>
          <div className={styles.listHeader}>
            <h4>Analyzed Segments ({filteredSegments.length})</h4>
          </div>
          {filteredSegments.map(segment => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              isSelected={selectedSegment?.id === segment.id}
              onClick={() => setSelectedSegment(segment)}
            />
          ))}
        </div>

        <div className={styles.detailsPanel}>
          {selectedSegment ? (
            <SegmentDetails
              segment={selectedSegment}
              onClose={() => setSelectedSegment(null)}
              onRefresh={fetchAnalyzedSegments}
            />
          ) : (
            <div className={styles.empty}>
              <p>Select a segment to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentCard({ segment, isSelected, onClick }) {
  // Use transcription confidence
  const confidence = segment.transcription_confidence || 0;

  return (
    <div
      className={`${styles.segmentCard} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <div className={styles.airport}>{segment.airport} - {segment.facility}</div>
          <div className={styles.date}>{new Date(segment.recorded_at).toLocaleString()}</div>
        </div>
        <div className={styles.scoreDisplay}>
          <div
            className={styles.score}
            data-severity={confidence >= 0.85 ? 'low' : 'high'}
          >
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Variant Status Badge */}
      <div className={styles.variantStatus}>
        {segment.hasVariants ? (
          <span className={styles.variantBadge} data-status="ready">
            ✓ {segment.variantCount} Variants Generated
          </span>
        ) : (
          <span className={styles.variantBadge} data-status="pending">
            ⚠ Need Processing
          </span>
        )}
      </div>

      {/* Show Transcription for High Confidence */}
      {segment.transcription && (
        <div className={styles.transcription}>
          {segment.transcription.substring(0, 150)}...
        </div>
      )}

      <div className={styles.cardFooter}>
        <span>{segment.duration_seconds?.toFixed(1)}s</span>
        <span className={styles.matchCount}>Confidence: {(confidence * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function SegmentDetails({ segment, onClose, onRefresh }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [audioError, setAudioError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [modelOutputs, setModelOutputs] = useState(null);
  const [loadingOutputs, setLoadingOutputs] = useState(false);
  const [segmentStatus, setSegmentStatus] = useState(segment?.status);

  useEffect(() => {
    if (segment?.id) {
      fetchAudioUrl();
      setSegmentStatus(segment.status);
      if (segment.status === 'needs_ranking') {
        fetchModelOutputs();
      }
    }
  }, [segment?.id, segment?.status]);

  async function fetchAudioUrl() {
    setLoadingAudio(true);
    setAudioUrl(null);
    setAudioError(null);
    try {
      console.log('Fetching audio for segment:', segment.id);
      const response = await fetch(`/api/segments/${segment.id}/audio`);
      console.log('Audio API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Audio data received:', data);

      if (data.url) {
        setAudioUrl(data.url);
        console.log('Audio URL set:', data.url);
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      console.error('Error fetching audio URL:', error);
      setAudioError(error.message);
      setAudioUrl(null);
    } finally {
      setLoadingAudio(false);
    }
  }

  async function fetchModelOutputs() {
    setLoadingOutputs(true);
    try {
      const { data, error } = await supabase
        .from('model_outputs')
        .select('*')
        .eq('segment_id', segment.id)
        .single();

      if (error) throw error;
      setModelOutputs(data);
    } catch (error) {
      console.error('Error fetching model outputs:', error);
      setModelOutputs(null);
    } finally {
      setLoadingOutputs(false);
    }
  }

  async function processForRLHF() {
    setProcessing(true);
    try {
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentId: segment.id })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`Error: ${result.error || 'Failed to process segment'}`);
        return;
      }

      // Successfully processed - update status and fetch model outputs
      if (result.status === 'high_confidence') {
        setSegmentStatus('needs_ranking');
        // Fetch the updated model outputs
        await fetchModelOutputs();
        // Refresh the parent list to update variant counts
        if (onRefresh) {
          onRefresh();
        }
      }

    } catch (error) {
      console.error('Error processing for RLHF:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className={styles.details}>
      <div className={styles.detailsHeader}>
        <div>
          <h4>Segment Details</h4>
          <p className={styles.segmentMeta}>
            {segment.airport} - {segment.facility} • {new Date(segment.recorded_at).toLocaleString()}
          </p>
          <p className={styles.segmentId}>
            ID: {segment.id}
          </p>
        </div>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      <div className={styles.detailsBody}>
        {/* RLHF Processing Status */}
        <section>
          <h5>RLHF Status</h5>
          <div className={styles.rlhfSection}>
            {segmentStatus === 'needs_ranking' ? (
              <div className={styles.rlhfSuccess}>
                <span className={styles.rlhfBadge}>✓ Ready for Ranking</span>
                <p>This segment has been processed with 3 different models and is ready for human ranking.</p>
              </div>
            ) : (
              <div className={styles.rlhfPending}>
                <button
                  onClick={processForRLHF}
                  disabled={processing}
                  className={styles.rlhfProcessButton}
                >
                  {processing ? 'Processing...' : 'Process for RLHF'}
                </button>
                <p className={styles.rlhfDescription}>
                  Generate 3 model variations (nova-2, enhanced, base) for human ranking
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Model Variations - Only show if processed */}
        {segmentStatus === 'needs_ranking' && modelOutputs && (
          <section>
            <h5>Model Variations</h5>
            {loadingOutputs ? (
              <p className={styles.loadingAudio}>Loading variations...</p>
            ) : (
              <div className={styles.variationsContainer}>
                {modelOutputs.variations.map((variation, index) => (
                  <div key={index} className={styles.variationCard}>
                    <div className={styles.variationHeader}>
                      <span className={styles.variationRank}>#{variation.rank_position}</span>
                      <div className={styles.variationModel}>
                        <span className={styles.modelName}>{variation.model}</span>
                        <span className={styles.modelDesc}>{variation.model_description}</span>
                      </div>
                      <div className={styles.variationConfidence}>
                        <span className={styles.confidenceValue}>{(variation.confidence * 100).toFixed(2)}%</span>
                        <span className={styles.confidenceLabel}>
                          {variation.confidence >= 0.90 ? 'High' : variation.confidence >= 0.70 ? 'Medium' : 'Low'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.variationText}>
                      {variation.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Transcription Confidence Score */}
        <section>
          <h5>Transcription Confidence</h5>
          <div className={styles.audioAnalysis}>
            <div className={styles.scoreBar}>
              <div
                className={styles.scoreFill}
                style={{ width: `${(segment.transcription_confidence || 0) * 100}%` }}
                data-severity={segment.transcription_confidence >= 0.85 ? 'low' : 'high'}
              />
            </div>
            <div className={styles.scoreText}>
              <span>{((segment.transcription_confidence || 0) * 100).toFixed(1)}%</span>
              <span className={styles.severityLabel}>
                {segment.transcription_confidence >= 0.85 ? 'HIGH CONFIDENCE' : 'LOW CONFIDENCE'}
              </span>
            </div>
          </div>
        </section>

        {/* Audio Analysis */}
        {segment.audio_analysis_score !== null && segment.audio_analysis_score !== undefined && (
          <section>
            <h5>Audio Analysis</h5>
            <div className={styles.audioAnalysis}>
              <div className={styles.scoreBar}>
                <div
                  className={styles.scoreFill}
                  style={{ width: `${segment.audio_analysis_score * 100}%` }}
                  data-severity={segment.audio_analysis_score >= 0.65 ? 'high' : 'low'}
                />
              </div>
              <div className={styles.scoreText}>
                <span>{(segment.audio_analysis_score * 100).toFixed(1)}%</span>
                <span className={styles.severityLabel}>
                  {segment.audio_analysis_score >= 0.65 ? 'INTERESTING' : 'ROUTINE'}
                </span>
              </div>

              {segment.detected_patterns && segment.detected_patterns.length > 0 && (
                <div className={styles.patterns}>
                  <strong>Patterns:</strong>
                  <div className={styles.patternTags}>
                    {segment.detected_patterns.map((pattern, i) => (
                      <span key={i} className={styles.patternTag}>
                        {pattern.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {segment.audio_features && Object.keys(segment.audio_features).length > 0 && (
                <div className={styles.features}>
                  <strong>Audio Features:</strong>
                  <div className={styles.featureGrid}>
                    {segment.audio_features.tempo && (
                      <div className={styles.feature}>
                        <span className={styles.featureLabel}>Tempo:</span>
                        <span className={styles.featureValue}>{segment.audio_features.tempo.toFixed(0)} BPM</span>
                      </div>
                    )}
                    {segment.audio_features.volume_variance !== undefined && (
                      <div className={styles.feature}>
                        <span className={styles.featureLabel}>Volume Var:</span>
                        <span className={styles.featureValue}>{segment.audio_features.volume_variance.toFixed(3)}</span>
                      </div>
                    )}
                    {segment.audio_features.snr !== undefined && (
                      <div className={styles.feature}>
                        <span className={styles.featureLabel}>SNR:</span>
                        <span className={styles.featureValue}>{segment.audio_features.snr.toFixed(2)}</span>
                      </div>
                    )}
                    {segment.audio_features.silence_ratio !== undefined && (
                      <div className={styles.feature}>
                        <span className={styles.featureLabel}>Silence:</span>
                        <span className={styles.featureValue}>{(segment.audio_features.silence_ratio * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Transcription */}
        {segment.transcription && (
          <section>
            <h5>Transcription</h5>
            <div className={styles.transcriptionBox}>
              <p>{segment.transcription}</p>
              {segment.transcription_confidence && (
                <div className={styles.confidence}>
                  Confidence: {(segment.transcription_confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </section>
        )}

        {/* Audio Playback */}
        <section style={{ position: 'relative', zIndex: 10 }}>
          <h5>Audio</h5>
          {loadingAudio ? (
            <p className={styles.loadingAudio}>Loading audio...</p>
          ) : audioError ? (
            <p className={styles.noAudio}>Error loading audio: {audioError}</p>
          ) : audioUrl ? (
            <div style={{ position: 'relative', zIndex: 10 }}>
              <audio
                controls
                className={styles.audioPlayer}
                src={audioUrl}
                key={audioUrl}
                preload="metadata"
                style={{ display: 'block', width: '100%' }}
                onError={(e) => {
                  console.error('Audio element error:', e);
                  console.error('Audio error code:', e.target.error?.code);
                  console.error('Audio error message:', e.target.error?.message);
                  setAudioError(`Playback error: ${e.target.error?.message || 'Unknown error'}`);
                }}
                onLoadedMetadata={() => console.log('Audio metadata loaded')}
                onCanPlay={() => console.log('Audio can play')}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                <a href={audioUrl} target="_blank" rel="noopener noreferrer">
                  Download audio file
                </a>
              </p>
            </div>
          ) : (
            <p className={styles.noAudio}>Audio not available</p>
          )}
          {segment.duration_seconds && (
            <span className={styles.duration}>{segment.duration_seconds.toFixed(1)}s</span>
          )}
        </section>

      </div>
    </div>
  );
}
