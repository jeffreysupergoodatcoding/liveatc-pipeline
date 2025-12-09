'use client';

import { useState, useEffect } from 'react';
import styles from './FlaggedSegments.module.css';

export default function FlaggedSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    minScore: 0,
    reviewed: 'all',
    routing: 'all'
  });
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [manualTranscription, setManualTranscription] = useState('');
  const [contextNotes, setContextNotes] = useState('');

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

    // Validate that manual transcription is provided if approved
    if (approved && !manualTranscription.trim()) {
      alert('Please provide a manual transcription before approving.');
      return;
    }

    console.log('Submitting review:', {
      approved,
      manualTranscription,
      contextNotes,
      reviewNotes
    });

    try {
      const response = await fetch(`/api/segments/${selectedSegment.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewed: true,
          approved,
          notes: reviewNotes,
          manualTranscription: manualTranscription.trim(),
          contextNotes: contextNotes.trim()
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        alert(`Failed to submit review: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('Review submitted successfully:', data);

      // Show success message
      alert(approved ? 'Segment approved and labeled!' : 'Segment rejected.');

      // Reset form
      setReviewMode(false);
      setReviewNotes('');
      setManualTranscription('');
      setContextNotes('');
      setSelectedSegment(null);

      // Refresh the list
      fetchFlaggedSegments();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert(`Error: ${error.message}`);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading flagged segments...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
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
          <label>Routing</label>
          <select
            value={filters.routing}
            onChange={(e) => setFilters({ ...filters, routing: e.target.value })}
          >
            <option value="all">All</option>
            <option value="rlhf">RLHF Candidates (High Conf)</option>
            <option value="review">Human Review (Low Conf)</option>
          </select>
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
      </div >

      {
        segments.length === 0 ? (
          <div className={styles.empty}>
            <p>No low confidence segments found</p>
            <span>Try adjusting your filters</span>
          </div>
        ) : (
          <div className={styles.content}>
            <div className={styles.segmentList}>
              <div className={styles.listHeader}>
                <h4>{segments.length} Low Confidence Segments (Human Review)</h4>
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
                    setManualTranscription('');
                    setContextNotes('');
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
                  manualTranscription={manualTranscription}
                  contextNotes={contextNotes}
                  onReviewNotesChange={setReviewNotes}
                  onManualTranscriptionChange={setManualTranscription}
                  onContextNotesChange={setContextNotes}
                  onStartReview={() => setReviewMode(true)}
                  onCancelReview={() => {
                    setReviewMode(false);
                    setReviewNotes('');
                    setManualTranscription('');
                    setContextNotes('');
                  }}
                  onApprove={() => submitReview(true)}
                  onReject={() => submitReview(false)}
                  onClose={() => {
                    setSelectedSegment(null);
                    setReviewMode(false);
                    setReviewNotes('');
                    setManualTranscription('');
                    setContextNotes('');
                  }}
                />
              </div>
            )}
          </div>
        )
      }
    </div >
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
          <div className={styles.score} data-severity={getSeverityLevel(segment.transcription_confidence || 0)}>
            {((segment.transcription_confidence || 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Transcription Hidden for Low Confidence (Human Review) */}

      {/* Edge Case Matches removed from card view to simplify */}

      <div className={styles.cardFooter}>
        <span className={styles.matchCount}>Confidence: {((segment.transcription_confidence || 0) * 100).toFixed(1)}%</span>
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

function SegmentDetails({
  segment,
  reviewMode,
  reviewNotes,
  manualTranscription,
  contextNotes,
  onReviewNotesChange,
  onManualTranscriptionChange,
  onContextNotesChange,
  onStartReview,
  onCancelReview,
  onApprove,
  onReject,
  onClose
}) {
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
        {/* Confidence Score Display */}
        <section>
          <h5>Transcription Confidence</h5>
          <div className={styles.audioAnalysis}>
            <div className={styles.scoreBar}>
              <div
                className={styles.scoreFill}
                style={{ width: `${(segment.transcription_confidence || 0) * 100}%` }}
                data-severity={getSeverityLevel(segment.transcription_confidence || 0)}
              />
            </div>
            <div className={styles.scoreText}>
              <span>{((segment.transcription_confidence || 0) * 100).toFixed(1)}%</span>
              <span className={styles.severityLabel}>
                {getConfidenceLabel(segment.transcription_confidence || 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Audio Features (Optional, keeping if present for debugging but demoting) */}
        {segment.audio_features && Object.keys(segment.audio_features).length > 0 && (
          <div className={styles.features}>
            <div className={styles.featureGrid}>
              {segment.audio_features.snr !== undefined && (
                <div className={styles.feature}>
                  <span className={styles.featureLabel}>SNR:</span>
                  <span className={styles.featureValue}>{segment.audio_features.snr.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
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

        {/* Detected Edge Cases Hidden
        {segment.matches && segment.matches.length > 0 && (
          <section>
            <h5>Detected Edge Cases ({segment.matches.length})</h5>
            ...
          </section>
        )} 
        */}

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

            {/* Manual Transcription Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                Manual Transcription <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                className={styles.reviewTextarea}
                placeholder="Enter the correct transcription for this audio segment..."
                value={manualTranscription}
                onChange={(e) => onManualTranscriptionChange(e.target.value)}
                rows={4}
                style={{ marginBottom: '0' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                This will be used as the ground truth transcription for training.
              </p>
            </div>

            {/* Context Notes Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                Context Notes (Optional)
              </label>
              <textarea
                className={styles.reviewTextarea}
                placeholder="Add context (e.g., 'emergency situation', 'multiple speakers', 'background noise')..."
                value={contextNotes}
                onChange={(e) => onContextNotesChange(e.target.value)}
                rows={2}
                style={{ marginBottom: '0' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Additional context to help with training (e.g., emergency, weather conditions, etc.)
              </p>
            </div>

            {/* Review Notes Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                Review Notes (Optional)
              </label>
              <textarea
                className={styles.reviewTextarea}
                placeholder="Add internal review notes..."
                value={reviewNotes}
                onChange={(e) => onReviewNotesChange(e.target.value)}
                rows={2}
              />
            </div>

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

function getConfidenceLabel(score) {
  if (score >= 0.85) return 'HIGH CONFIDENCE';
  if (score >= 0.70) return 'MEDIUM CONFIDENCE';
  if (score >= 0.50) return 'LOW CONFIDENCE';
  return 'VERY LOW CONFIDENCE';
}

function getSeverityLevel(score) {
  // For Confidence: High is Good (Blue/Low severity), Low is Bad (Red/Critical severity)
  if (score >= 0.85) return 'low';      // High confidence -> Blue (Good)
  if (score >= 0.70) return 'medium';   // Medium confidence -> Yellow
  if (score >= 0.50) return 'high';     // Low confidence -> Orange
  return 'critical';                    // Very low confidence -> Red
}
