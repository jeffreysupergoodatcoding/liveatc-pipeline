'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { formatDuration, formatFileSize, formatQualityScore } from '../../../../lib/utils/format';
import styles from './LabeledClipsList.module.css';

export default function LabeledClipsList() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingSegment, setPlayingSegment] = useState(null);
  const [airportFilter, setAirportFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const audioRef = useRef(null);

  useEffect(() => {
    fetchLabeledSegments();
  }, []);

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
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Recording</th>
                <th>Segment</th>
                <th>Duration</th>
                <th>Quality</th>
                <th>Size</th>
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
                    className={playingSegment?.id === segment.id ? styles.playing : ''}
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
                    <td>{formatFileSize(segment.file_size_bytes)}</td>
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
                      <div className={styles.actions}>
                        <button
                          onClick={() => playSegment(segment)}
                          className={styles.playButton}
                          title="Play"
                        >
                          {playingSegment?.id === segment.id ? '⏸' : '▶'}
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
