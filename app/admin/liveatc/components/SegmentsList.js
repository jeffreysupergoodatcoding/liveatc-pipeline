'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { formatDuration, formatFileSize, formatQualityScore } from '../../../../lib/utils/format';
import styles from './SegmentsList.module.css';

export default function SegmentsList({ recording, onBack }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingSegment, setPlayingSegment] = useState(null);
  const [selectedSegments, setSelectedSegments] = useState(new Set());
  const audioRef = useRef(null);

  useEffect(() => {
    fetchSegments();
  }, [recording.id]);

  async function fetchSegments() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('recording_id', recording.id)
        .order('segment_index', { ascending: true });

      if (error) {
        console.error('Error fetching segments:', error);
      } else {
        setSegments(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  function getAudioUrl(segment) {
    const { data } = supabase.storage
      .from('liveatc-segments')
      .getPublicUrl(segment.file_path);

    return data.publicUrl;
  }

  function playSegment(segment) {
    if (playingSegment?.id === segment.id) {
      // Toggle pause/play
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
    } else {
      setPlayingSegment(segment);
    }
  }

  useEffect(() => {
    if (playingSegment && audioRef.current) {
      audioRef.current.src = getAudioUrl(playingSegment);
      audioRef.current.play();
    }
  }, [playingSegment]);

  async function updateSegmentStatus(segmentIds, newStatus) {
    try {
      const { error } = await supabase
        .from('segments')
        .update({ status: newStatus })
        .in('id', segmentIds);

      if (error) {
        console.error('Error updating segment status:', error);
      } else {
        await fetchSegments();
        setSelectedSegments(new Set());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function deleteSegments(segmentIds) {
    if (!confirm(`Delete ${segmentIds.length} segment(s)?`)) {
      return;
    }

    try {
      // Delete from storage
      for (const segmentId of segmentIds) {
        const segment = segments.find(s => s.id === segmentId);
        if (segment) {
          await supabase.storage
            .from('liveatc-segments')
            .remove([segment.file_path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('segments')
        .delete()
        .in('id', segmentIds);

      if (error) {
        console.error('Error deleting segments:', error);
      } else {
        await fetchSegments();
        setSelectedSegments(new Set());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function toggleActive(segmentId, currentActive) {
    try {
      const response = await fetch(`/api/segments/${segmentId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle active status');
      }

      await fetchSegments();
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  }

  async function processForRLHF(segmentId) {
    try {
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentId })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`Error: ${result.error || 'Failed to process segment'}`);
        return;
      }

      if (result.status === 'high_confidence') {
        alert(`✅ Success!\n\nGenerated ${result.variations.length} variations\nConfidence: ${(result.confidence * 100).toFixed(2)}%\nStatus: Ready for ranking`);
      } else {
        alert(`⚠️ Low Confidence\n\nConfidence: ${(result.confidence * 100).toFixed(2)}%\nStatus: Needs human review`);
      }

      await fetchSegments();
    } catch (error) {
      console.error('Error processing for RLHF:', error);
      alert(`Error: ${error.message}`);
    }
  }

  function toggleSelectSegment(segmentId) {
    const newSelected = new Set(selectedSegments);
    if (newSelected.has(segmentId)) {
      newSelected.delete(segmentId);
    } else {
      newSelected.add(segmentId);
    }
    setSelectedSegments(newSelected);
  }

  function selectAll() {
    if (selectedSegments.size === segments.length) {
      setSelectedSegments(new Set());
    } else {
      setSelectedSegments(new Set(segments.map(s => s.id)));
    }
  }

  const quality = formatQualityScore(
    segments.reduce((sum, s) => sum + s.audio_quality_score, 0) / segments.length
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back to Recordings
        </button>
        <div className={styles.recordingInfo}>
          <h2>
            {recording.airport} {recording.facility}
          </h2>
          <div className={styles.meta}>
            <span>{segments.length} segments</span>
            <span>•</span>
            <span>Avg quality: {quality.label}</span>
          </div>
        </div>
      </div>

      {selectedSegments.size > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedSegments.size} selected</span>
          <div className={styles.bulkButtons}>
            <button
              onClick={() => updateSegmentStatus([...selectedSegments], 'active')}
              className={styles.bulkButton}
            >
              Mark as Good
            </button>
            <button
              onClick={() => updateSegmentStatus([...selectedSegments], 'rejected')}
              className={styles.bulkButton}
            >
              Mark as Bad
            </button>
            <button
              onClick={() => deleteSegments([...selectedSegments])}
              className={`${styles.bulkButton} ${styles.danger}`}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading segments...</div>
      ) : segments.length === 0 ? (
        <div className={styles.empty}>No segments found</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedSegments.size === segments.length}
                    onChange={selectAll}
                  />
                </th>
                <th>#</th>
                <th>Duration</th>
                <th>Quality</th>
                <th>Confidence %</th>
                <th>Routing</th>
                <th>Confidence</th>
                <th>Labels</th>
                <th>Status</th>
                <th>Queue for Analysis</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {segments.map(segment => {
                const quality = formatQualityScore(segment.audio_quality_score);
                const confidence = segment.transcription_confidence
                  ? (segment.transcription_confidence * 100).toFixed(0) + '%'
                  : '-';

                // Check if segment has been analyzed (has transcription confidence)
                const isAnalyzed = segment.transcription_confidence !== null;
                let routingLabel = 'Pending';
                let routingClass = styles.pending;
                if (isAnalyzed) {
                  routingLabel = 'Analyzed';
                  routingClass = styles.analyzed;
                }

                // Determine confidence level (High or Low)
                let confidenceLevel = '-';
                let confidenceLevelClass = styles.confidenceNone;
                if (segment.transcription_confidence !== null) {
                  if (segment.transcription_confidence >= 0.85) {
                    confidenceLevel = 'High';
                    confidenceLevelClass = styles.confidenceHigh;
                  } else {
                    confidenceLevel = 'Low';
                    confidenceLevelClass = styles.confidenceLow;
                  }
                }

                return (
                  <tr
                    key={segment.id}
                    className={playingSegment?.id === segment.id ? styles.playing : ''}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSegments.has(segment.id)}
                        onChange={() => toggleSelectSegment(segment.id)}
                      />
                    </td>
                    <td>{segment.segment_index + 1}</td>
                    <td>{formatDuration(segment.duration_seconds)}</td>
                    <td>
                      <span className={`${styles.quality} ${styles[quality.color]}`}>
                        {quality.label}
                      </span>
                    </td>
                    <td>{confidence}</td>
                    <td>
                      <span className={`${styles.routing} ${routingClass}`}>
                        {routingLabel}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.confidenceLevel} ${confidenceLevelClass}`}>
                        {confidenceLevel}
                      </span>
                    </td>
                    <td>{segment.label_count}</td>
                    <td>
                      <span className={`${styles.status} ${segment.active ? styles.active : styles.pending}`}>
                        {segment.active ? 'Active' : 'Ready'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive(segment.id, segment.active)}
                        className={segment.active ? styles.activeButton : styles.inactiveButton}
                        title={segment.active ? "Remove from analysis queue" : "Add to analysis queue"}
                      >
                        {segment.active ? '✓ Queued' : 'Queue'}
                      </button>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          onClick={() => playSegment(segment)}
                          className={styles.playButton}
                          title="Play"
                        >
                          {playingSegment?.id === segment.id ? '⏸' : '▶'}
                        </button>
                        <button
                          onClick={() => updateSegmentStatus([segment.id], 'active')}
                          className={styles.actionButton}
                          title="Mark as Good"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => updateSegmentStatus([segment.id], 'rejected')}
                          className={styles.actionButton}
                          title="Mark as Bad"
                        >
                          ✗
                        </button>
                        <button
                          onClick={() => deleteSegments([segment.id])}
                          className={styles.deleteButton}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setPlayingSegment(null)}
        style={{ display: 'none' }}
      />
    </div>
  );
}
