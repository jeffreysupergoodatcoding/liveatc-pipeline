'use client';

import { useState, useEffect } from 'react';
import styles from './FlaggedSegments.module.css'; // Reuse same styles
import { supabase } from '../../../../lib/supabase';

export default function AnalyzedSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);

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
        .or('audio_analysis_score.not.is.null,transcription.not.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to flat structure
      const flatSegments = data.map(segment => ({
        ...segment,
        airport: segment.recordings.airport,
        facility: segment.recordings.facility,
        recorded_at: segment.recordings.recorded_at
      }));

      setSegments(flatSegments);
    } catch (error) {
      console.error('Error fetching analyzed segments:', error);
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }

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
      <div className={styles.content}>
        <div className={styles.segmentList}>
          <div className={styles.listHeader}>
            <h4>Analyzed Segments ({segments.length})</h4>
          </div>
          {segments.map(segment => (
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
  const hasAudioAnalysis = segment.audio_analysis_score !== null;

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
          {hasAudioAnalysis && (
            <div
              className={styles.score}
              data-severity={segment.audio_analysis_score >= 0.65 ? 'high' : 'low'}
            >
              {(segment.audio_analysis_score * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {segment.detected_patterns && segment.detected_patterns.length > 0 && (
        <div className={styles.topMatch}>
          <span className={styles.matchCategory}>PATTERNS</span>
          <span className={styles.matchName}>{segment.detected_patterns.join(', ')}</span>
        </div>
      )}


      <div className={styles.cardFooter}>
        <span>{segment.duration_seconds?.toFixed(1)}s</span>
        {hasAudioAnalysis && <span className={styles.matchCount}>Audio Analyzed</span>}
      </div>
    </div>
  );
}

function SegmentDetails({ segment, onClose }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(true);

  useEffect(() => {
    if (segment?.id) {
      fetchAudioUrl();
    }
  }, [segment?.id]);

  async function fetchAudioUrl() {
    setLoadingAudio(true);
    try {
      const response = await fetch(`/api/segments/${segment.id}/audio`);
      const data = await response.json();
      if (data.url) {
        setAudioUrl(data.url);
      }
    } catch (error) {
      console.error('Error fetching audio URL:', error);
    } finally {
      setLoadingAudio(false);
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
        </div>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      <div className={styles.detailsBody}>
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

        {/* Audio Playback */}
        <section>
          <h5>Audio</h5>
          {loadingAudio ? (
            <p className={styles.loadingAudio}>Loading audio...</p>
          ) : audioUrl ? (
            <audio controls className={styles.audioPlayer} key={audioUrl}>
              <source src={audioUrl} type="audio/mpeg" />
              Your browser does not support audio playback.
            </audio>
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
