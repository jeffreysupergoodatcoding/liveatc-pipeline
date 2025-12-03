'use client';

import { useState, useEffect } from 'react';
import styles from './FlaggedSegments.module.css';

export default function FlaggedSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    minScore: 0,
    reviewed: 'all'
  });
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchFlaggedSegments();
  }, [filters]);

  async function fetchFlaggedSegments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.minScore > 0) params.append('minScore', filters.minScore);
      if (filters.reviewed !== 'all') params.append('reviewed', filters.reviewed);

      const response = await fetch(`/api/segments/flagged?${params}`);
      const data = await response.json();
      setSegments(data.segments || []);
    } catch (error) {
      console.error('Error fetching flagged segments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(approved) {
    if (!selectedSegment) return;

    try {
      const response = await fetch(`/api/segments/${selectedSegment.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewed: true,
          approved,
          notes: reviewNotes
        })
      });

      if (response.ok) {
        setReviewMode(false);
        setReviewNotes('');
        setSelectedSegment(null);
        fetchFlaggedSegments();
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading flagged segments...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="all">All Categories</option>
            <option value="safety_critical">Safety Critical</option>
            <option value="emergency_declarations">Emergency Declarations</option>
            <option value="readback_errors">Readback Errors</option>
            <option value="communication_failures">Communication Failures</option>
            <option value="phraseology_issues">Phraseology Issues</option>
            <option value="environmental_conditions">Environmental Conditions</option>
            <option value="operational_issues">Operational Issues</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Min Score</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={filters.minScore}
            onChange={(e) => setFilters({ ...filters, minScore: parseFloat(e.target.value) })}
          />
          <span className={styles.scoreValue}>{filters.minScore.toFixed(1)}</span>
        </div>

        <div className={styles.filterGroup}>
          <label>Review Status</label>
          <select
            value={filters.reviewed}
            onChange={(e) => setFilters({ ...filters, reviewed: e.target.value })}
          >
            <option value="all">All</option>
            <option value="true">Reviewed</option>
            <option value="false">Not Reviewed</option>
          </select>
        </div>

        <button className={styles.refreshButton} onClick={fetchFlaggedSegments}>
          ↻ Refresh
        </button>
      </div>

      {segments.length === 0 ? (
        <div className={styles.empty}>
          <p>No flagged segments found</p>
          <span>Try adjusting your filters</span>
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.segmentList}>
            <div className={styles.listHeader}>
              <h4>{segments.length} Flagged Segments</h4>
            </div>
            {segments.map((segment) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                selected={selectedSegment?.id === segment.id}
                onClick={() => {
                  setSelectedSegment(segment);
                  setReviewMode(false);
                  setReviewNotes('');
                }}
              />
            ))}
          </div>

          {selectedSegment && (
            <div className={styles.detailsPanel}>
              <SegmentDetails
                segment={selectedSegment}
                reviewMode={reviewMode}
                reviewNotes={reviewNotes}
                onReviewNotesChange={setReviewNotes}
                onStartReview={() => setReviewMode(true)}
                onCancelReview={() => {
                  setReviewMode(false);
                  setReviewNotes('');
                }}
                onApprove={() => submitReview(true)}
                onReject={() => submitReview(false)}
                onClose={() => {
                  setSelectedSegment(null);
                  setReviewMode(false);
                  setReviewNotes('');
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentCard({ segment, selected, onClick }) {
  const topMatch = segment.matches?.[0];

  return (
    <div
      className={`${styles.segmentCard} ${selected ? styles.selected : ''} ${segment.reviewed ? styles.reviewed : ''}`}
      onClick={onClick}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <span className={styles.airport}>{segment.airport} - {segment.facility}</span>
          <span className={styles.date}>{new Date(segment.recorded_at).toLocaleString()}</span>
        </div>
        <div className={styles.scoreDisplay}>
          <div className={styles.score} data-severity={getSeverityLevel(segment.audio_analysis_score || 0)}>
            {((segment.audio_analysis_score || 0) * 100).toFixed(0)}
          </div>
        </div>
      </div>

      {segment.transcription && (
        <div className={styles.transcription}>
          {segment.transcription.substring(0, 120)}...
        </div>
      )}

      {topMatch && (
        <div className={styles.topMatch}>
          <span className={styles.matchCategory}>{formatCategory(topMatch.category)}</span>
          <span className={styles.matchName}>{topMatch.case_name}</span>
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.matchCount}>{segment.matches?.length || 0} matches</span>
        {segment.speaker_count > 1 && (
          <span className={styles.speakers}>{segment.speaker_count} speakers</span>
        )}
        {segment.reviewed && (
          <span className={styles.reviewedBadge}>Reviewed</span>
        )}
      </div>
    </div>
  );
}

function SegmentDetails({ segment, reviewMode, reviewNotes, onReviewNotesChange, onStartReview, onCancelReview, onApprove, onReject, onClose }) {
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
        {/* Audio Analysis (Audio-First System) */}
        {segment.audio_analysis_score !== null && segment.audio_analysis_score !== undefined && (
          <section>
            <h5>Audio Analysis</h5>
            <div className={styles.audioAnalysis}>
              <div className={styles.scoreBar}>
                <div
                  className={styles.scoreFill}
                  style={{ width: `${segment.audio_analysis_score * 100}%` }}
                  data-severity={getSeverityLevel(segment.audio_analysis_score)}
                />
              </div>
              <div className={styles.scoreText}>
                <span>{(segment.audio_analysis_score * 100).toFixed(1)}%</span>
                <span className={styles.severityLabel}>
                  {getSeverityLevel(segment.audio_analysis_score).toUpperCase()}
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

              {segment.keywords_detected && segment.keywords_detected.length > 0 && (
                <div className={styles.keywords}>
                  <strong>Keywords:</strong>
                  <div className={styles.keywordTags}>
                    {segment.keywords_detected.map((keyword, i) => (
                      <span key={i} className={styles.keywordTag}>
                        {keyword}
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
                        <span className={styles.featureLabel}>Volume Variance:</span>
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

        {/* Detected Edge Cases */}
        {segment.matches && segment.matches.length > 0 && (
          <section>
            <h5>Detected Edge Cases ({segment.matches.length})</h5>
            <div className={styles.matches}>
              {segment.matches.map((match, i) => (
                <div key={i} className={styles.match}>
                  <div className={styles.matchHeader}>
                    <span className={styles.matchName}>{match.case_name}</span>
                    <span className={styles.matchSeverity} data-severity={getSeverityLevel(match.severity)}>
                      {(match.severity * 100).toFixed(0)}
                    </span>
                  </div>
                  <div className={styles.matchMeta}>
                    <span className={styles.matchCategory}>{formatCategory(match.category)}</span>
                    <span className={styles.matchType}>{match.match_type}</span>
                    <span className={styles.matchConfidence}>
                      {(match.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  {match.evidence && (
                    <div className={styles.evidence}>
                      <strong>Evidence:</strong>
                      <pre>{JSON.stringify(match.evidence, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Review Section */}
        {segment.reviewed ? (
          <section>
            <h5>Review</h5>
            <div className={styles.reviewInfo}>
              <p><strong>Reviewed:</strong> {new Date(segment.reviewed_at).toLocaleString()}</p>
              {segment.review_notes && (
                <p><strong>Notes:</strong> {segment.review_notes}</p>
              )}
            </div>
          </section>
        ) : reviewMode ? (
          <section>
            <h5>Submit Review</h5>
            <textarea
              className={styles.reviewTextarea}
              placeholder="Add review notes (optional)..."
              value={reviewNotes}
              onChange={(e) => onReviewNotesChange(e.target.value)}
              rows={4}
            />
            <div className={styles.reviewActions}>
              <button onClick={onApprove} className={styles.approveButton}>
                Approve
              </button>
              <button onClick={onReject} className={styles.rejectButton}>
                Reject
              </button>
              <button onClick={onCancelReview} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </section>
        ) : (
          <section>
            <button onClick={onStartReview} className={styles.startReviewButton}>
              Start Review
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function formatCategory(category) {
  return category.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getSeverityLevel(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.70) return 'high';
  if (score >= 0.50) return 'medium';
  return 'low';
}
