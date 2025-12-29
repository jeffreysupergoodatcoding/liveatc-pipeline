'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { formatDuration, formatFileSize, formatQualityScore } from '../../../../lib/utils/format';
import AudioTrimmer from './AudioTrimmer';
import styles from './LabeledClipsList.module.css';

// Helper functions for status display
function getStatusLabel(segment) {
  // If segment has labels, it's been reviewed/labeled
  if (segment.label_count > 0) {
    if (segment.rlhf_candidate && segment.status === 'needs_ranking') {
      return 'READY_FOR_RANKING';
    }
    if (segment.rlhf_candidate) {
      return 'LABELED_RLHF';
    }
    return 'LABELED_SFT';
  }

  // Fallback to segment flags
  if (segment.needs_human_review) return 'NEEDS_REVIEW';
  if (segment.status === 'needs_ranking') return 'PENDING_RANKING';
  return segment.status?.toUpperCase() || 'PENDING';
}

function getStatusColor(segment) {
  if (segment.label_count > 0) {
    return segment.rlhf_candidate ? 'rlhf' : 'sft';
  }
  if (segment.needs_human_review) return 'review';
  return segment.status || 'pending';
}

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
                        <span className={`${styles.status} ${styles[getStatusColor(segment)]}`}>
                          {getStatusLabel(segment)}
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
                onRefreshLabels={() => fetchSegmentLabels(selectedSegment.id)}
                onSegmentUpdate={async () => {
                  // Refresh the list and update the selected segment with new data
                  await fetchLabeledSegments();
                  // We need to fetch the specific segment again to get the updated fields for the detailed view
                  const { data } = await supabase
                    .from('segments')
                    .select('*, recordings(airport, facility, recorded_at)')
                    .eq('id', selectedSegment.id)
                    .single();
                  if (data) {
                    setSelectedSegment(data);
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentDetails({ segment, labels, onClose, onRefreshLabels, onSegmentUpdate }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editedTranscription, setEditedTranscription] = useState('');
  const [editedContext, setEditedContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTrimEditor, setShowTrimEditor] = useState(false);
  const [trimSaving, setTrimSaving] = useState(false);

  useEffect(() => {
    if (segment?.id) {
      fetchAudioUrl();
    }
  }, [segment?.id]);

  async function fetchAudioUrl() {
    console.log(`%c🔄 Fetching audio for segment ${segment.id}`, 'color: blue; font-weight: bold');
    console.log('   Segment data:', {
      id: segment.id,
      file_path: segment.file_path,
      trimmed_file_path: segment.trimmed_file_path,
      duration: segment.duration_seconds
    });

    setLoadingAudio(true);
    try {
      // DIRECT DATABASE READ - Bypass API to eliminate caching
      console.log('   Reading directly from database...');
      const { data: freshSegment, error: dbError } = await supabase
        .from('segments')
        .select('file_path, trimmed_file_path')
        .eq('id', segment.id)
        .maybeSingle();

      if (dbError) {
        console.error('   Database error:', dbError);
        throw dbError;
      }

      console.log('   Fresh DB data:', freshSegment);

      // Use trimmed if available, otherwise original
      const filePath = freshSegment.trimmed_file_path || freshSegment.file_path;
      console.log('   Selected file path:', filePath);

      // Create signed URL directly
      const { data: urlData, error: urlError } = await supabase.storage
        .from('liveatc-segments')
        .createSignedUrl(filePath, 3600);

      if (urlError) {
        console.error('   Storage URL error:', urlError);
        throw urlError;
      }

      if (urlData?.signedUrl) {
        setAudioUrl(urlData.signedUrl);
        console.log(`%c✅ Audio URL set: ${urlData.signedUrl.substring(0, 80)}...`, 'color: green');
        console.log(`   Is using trimmed file: ${!!freshSegment.trimmed_file_path}`);
      } else {
        console.warn('⚠️ No signed URL generated');
      }

      // Also store the original audio URL for the trimmer
      // We need to fetch original file_path from segment directly
      if (segment.file_path) {
        console.log('Fetching original audio URL for:', segment.file_path);
        const { data: urlData, error: urlError } = await supabase.storage
          .from('liveatc-segments')
          .createSignedUrl(segment.file_path, 3600);

        if (urlError) {
          console.error('Error creating signed URL for original audio:', urlError);
        } else if (urlData?.signedUrl) {
          console.log('Original audio URL created successfully');
          setOriginalAudioUrl(urlData.signedUrl);
        } else {
          console.warn('No signed URL returned for original audio');
        }
      } else {
        console.warn('No file_path available on segment');
      }
    } catch (error) {
      console.error('Error fetching audio URL:', error);
    } finally {
      setLoadingAudio(false);
    }
  }

  async function handleTrimSave(regions) {
    console.log('Saving trim with regions:', regions);
    setTrimSaving(true);
    try {
      const response = await fetch(`/api/segments/${segment.id}/trim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removeRegions: regions,
          previewOnly: false
        })
      });

      console.log('Trim response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Trim save error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to save trim');
      }

      const data = await response.json();
      console.log('Trim save successful:', data);

      // Update audio URL to new trimmed version
      if (data.trimmedAudioUrl) {
        setAudioUrl(data.trimmedAudioUrl);
      } else {
        // Fallback if API didn't return URL
        await fetchAudioUrl();
      }

      setShowTrimEditor(false);

      // Notify parent to refresh segment data (duration, etc)
      if (onSegmentUpdate) {
        onSegmentUpdate();
      }

      alert('Audio trim saved successfully!');
    } catch (error) {
      console.error('Error saving trim:', error);
      alert(`Failed to save trim: ${error.message}`);
    } finally {
      setTrimSaving(false);
    }
  }

  function startEditing(label) {
    setEditingLabelId(label.id);
    setEditedTranscription(label.transcription);
    setEditedContext(label.response || '');
  }

  function cancelEditing() {
    setEditingLabelId(null);
    setEditedTranscription('');
    setEditedContext('');
  }

  async function saveLabel(labelId) {
    setSaving(true);
    try {
      const response = await fetch(`/api/labels/${labelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: editedTranscription,
          response: editedContext
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update label');
      }

      // Refresh the labels data
      if (onRefreshLabels) {
        await onRefreshLabels();
      }

      // Exit edit mode
      cancelEditing();
    } catch (error) {
      console.error('Error saving label:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
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

          {/* Edit Trim Button */}
          <button
            onClick={() => setShowTrimEditor(!showTrimEditor)}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: showTrimEditor ? '#dc3545' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {showTrimEditor ? '✕ Cancel Trim Edit' : 'Edit Audio Trim'}
          </button>
        </section>

        {/* Audio Trimmer (when editing) */}
        {showTrimEditor && (
          <section style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <h5 style={{ marginBottom: '12px' }}>Edit Audio Trim</h5>
            {!originalAudioUrl ? (
              <div style={{ padding: '16px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px' }}>
                <p style={{ margin: 0, color: '#856404' }}>
                  ⚠️ Unable to load original audio file. Please close and reopen this segment to try again.
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                  Mark regions to remove from the <strong>original</strong> audio. The trimmer shows the full original clip.
                </p>
                <AudioTrimmer
                  audioUrl={originalAudioUrl}
                  duration={segment.duration_seconds || 0}
                  segment={segment}
                  onTrimSave={handleTrimSave}
                />
                {trimSaving && (
                  <p style={{ marginTop: '12px', color: '#0070f3', fontWeight: '500' }}>Saving trim...</p>
                )}
              </>
            )}
          </section>
        )}

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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={styles.labelDate}>
                        {new Date(label.created_at).toLocaleString()}
                      </span>
                      {editingLabelId !== label.id && (
                        <button
                          onClick={() => startEditing(label)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#0070f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {editingLabelId === label.id ? (
                    /* Edit Mode */
                    <div>
                      <div className={styles.labelTranscription}>
                        <strong>Transcription:</strong>
                        <textarea
                          value={editedTranscription}
                          onChange={(e) => setEditedTranscription(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '8px',
                            marginTop: '8px',
                            fontSize: '14px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                      <div className={styles.labelContext} style={{ marginTop: '12px' }}>
                        <strong>Context (Optional):</strong>
                        <textarea
                          value={editedContext}
                          onChange={(e) => setEditedContext(e.target.value)}
                          placeholder="Add context notes..."
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '8px',
                            marginTop: '8px',
                            fontSize: '14px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontFamily: 'inherit',
                            backgroundColor: '#fff3cd'
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => saveLabel(label.id)}
                          disabled={saving}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            backgroundColor: saving ? '#ccc' : '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={saving}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>
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
