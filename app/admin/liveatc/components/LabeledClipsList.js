'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { formatDuration, formatFileSize, formatQualityScore } from '../../../../lib/utils/format';
import styles from './LabeledClipsList.module.css';

export default function LabeledClipsList() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentLabels, setSegmentLabels] = useState([]);
  const [airportFilter, setAirportFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchLabeledSegments();
  }, []);

  useEffect(() => {
    if (selectedSegment) {
      fetchSegmentLabels(selectedSegment.id);
    }
  }, [selectedSegment]);

  async function fetchLabeledSegments() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('segments')
        .select(`
          *,
          recordings (
            airport,
            facility,
            recorded_at
          )
        `)
        .gt('label_count', 0)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching labeled segments:', error);
      } else {
        setSegments(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSegmentLabels(segmentId) {
    try {
      const { data, error } = await supabase
        .from('segment_labels')
        .select('*')
        .eq('segment_id', segmentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching segment labels:', error);
      } else {
        setSegmentLabels(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  // Get unique airports for filter
  const airports = ['all', ...new Set(segments.map(s => s.recordings?.airport).filter(Boolean))];

  // Filter segments
  const filteredSegments = segments.filter(segment => {
    const matchesAirport = airportFilter === 'all' || segment.recordings?.airport === airportFilter;
    const matchesStatus = statusFilter === 'all' || segment.status === statusFilter;
    return matchesAirport && matchesStatus;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2>Labeled Clips</h2>
          <button onClick={fetchLabeledSegments} className={styles.refreshButton}>
            ↻ Refresh
          </button>
        </div>
        <div className={styles.meta}>
          <span>{filteredSegments.length} labeled clips</span>
          <span>•</span>
          <span>{segments.length} total</span>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Airport:</label>
          <select
            value={airportFilter}
            onChange={(e) => setAirportFilter(e.target.value)}
            className={styles.select}
          >
            {airports.map(airport => (
              <option key={airport} value={airport}>
                {airport === 'all' ? 'All Airports' : airport}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="reviewed">Reviewed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading labeled clips...</div>
      ) : filteredSegments.length === 0 ? (
        <div className={styles.empty}>
          {segments.length === 0
            ? 'No labeled clips found. Label some segments to see them here.'
            : 'No clips match the current filters.'}
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Recording</th>
                  <th>Segment</th>
                  <th>Duration</th>
                  <th>Quality</th>
                  <th>Labels</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSegments.map(segment => {
                  const quality = formatQualityScore(segment.audio_quality_score);
                  const recording = segment.recordings;
                  return (
                    <tr
                      key={segment.id}
                      className={selectedSegment?.id === segment.id ? styles.selected : ''}
                      onClick={() => setSelectedSegment(segment)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className={styles.recordingInfo}>
                          <span className={styles.airport}>{recording?.airport || 'N/A'}</span>
                          <span className={styles.facility}>{recording?.facility || 'N/A'}</span>
                        </div>
                      </td>
                      <td>#{segment.segment_index + 1}</td>
                      <td>{formatDuration(segment.duration_seconds)}</td>
                      <td>
                        <span className={`${styles.quality} ${styles[quality.color]}`}>
                          {quality.label}
                        </span>
                      </td>
                      <td>
                        <span className={styles.labelCount}>
                          {segment.label_count}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.status} ${styles[segment.status]}`}>
                          {segment.status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSegment(segment);
                          }}
                          className={styles.viewButton}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedSegment && (
            <div className={styles.detailsPanel}>
              <SegmentDetails
                segment={selectedSegment}
                labels={segmentLabels}
                onClose={() => setSelectedSegment(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentDetails({ segment, labels, onClose }) {
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

  const recording = segment.recordings;

  return (
    <div className={styles.details}>
      <div className={styles.detailsHeader}>
        <div>
          <h4>Labeled Clip Details</h4>
          <p className={styles.segmentMeta}>
            {recording?.airport} - {recording?.facility} • Segment #{segment.segment_index + 1}
          </p>
        </div>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      <div className={styles.detailsBody}>
        {/* Audio Playback */}
        <section>
          <h5>Audio</h5>
          {loadingAudio ? (
            <p className={styles.loadingAudio}>Loading audio...</p>
          ) : audioUrl ? (
            <audio
              controls
              className={styles.audioPlayer}
              src={audioUrl}
              style={{ display: 'block', width: '100%' }}
            />
          ) : (
            <p className={styles.noAudio}>Audio not available</p>
          )}
          {segment.duration_seconds && (
            <span className={styles.duration}>{segment.duration_seconds.toFixed(1)}s</span>
          )}
        </section>

        {/* Original Transcript (from Deepgram) */}
        {segment.transcription && (
          <section>
            <h5>Original Transcript (Deepgram)</h5>
            <div className={styles.transcriptionBox} style={{ backgroundColor: '#f5f5f5' }}>
              <p>{segment.transcription}</p>
              {segment.transcription_confidence && (
                <div className={styles.confidence}>
                  Confidence: {(segment.transcription_confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </section>
        )}

        {/* Labeled Transcripts */}
        <section>
          <h5>Human-Labeled Transcripts ({labels.length})</h5>
          {labels.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No labels yet</p>
          ) : (
            <div className={styles.labelsContainer}>
              {labels.map((label, index) => (
                <div key={label.id} className={styles.labelBox}>
                  <div className={styles.labelHeader}>
                    <span className={styles.labelNumber}>Label #{index + 1}</span>
                    <span className={styles.labelDate}>
                      {new Date(label.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.labelTranscription}>
                    <strong>Transcription:</strong>
                    <p>{label.transcription}</p>
                  </div>
                  {label.response && (
                    <div className={styles.labelContext}>
                      <strong>Context:</strong>
                      <p>{label.response}</p>
                    </div>
                  )}
                  {label.confidence && (
                    <div className={styles.labelConfidence}>
                      Confidence: <span className={styles.confidenceBadge}>{label.confidence}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
