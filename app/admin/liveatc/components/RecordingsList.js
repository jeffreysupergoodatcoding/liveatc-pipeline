'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { formatDate, formatDuration } from '../../../../lib/utils/format';
import styles from './RecordingsList.module.css';

export default function RecordingsList({ onSelectRecording }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    airport: '',
    facility: '',
    status: ''
  });

  useEffect(() => {
    fetchRecordings();
  }, [filters]);

  async function fetchRecordings() {
    setLoading(true);

    try {
      let query = supabase
        .from('recordings')
        .select('*')
        .order('recorded_at', { ascending: false });

      if (filters.airport) {
        query = query.eq('airport', filters.airport);
      }
      if (filters.facility) {
        query = query.eq('facility', filters.facility);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recordings:', error);
      } else {
        setRecordings(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const airports = [...new Set(recordings.map(r => r.airport))];
  const facilities = [...new Set(recordings.map(r => r.facility))];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Recordings</h2>
        <button onClick={fetchRecordings} className={styles.refreshButton}>
          Refresh
        </button>
      </div>

      <div className={styles.filters}>
        <select
          value={filters.airport}
          onChange={(e) => setFilters({ ...filters, airport: e.target.value })}
          className={styles.select}
        >
          <option value="">All Airports</option>
          {airports.map(airport => (
            <option key={airport} value={airport}>{airport}</option>
          ))}
        </select>

        <select
          value={filters.facility}
          onChange={(e) => setFilters({ ...filters, facility: e.target.value })}
          className={styles.select}
        >
          <option value="">All Facilities</option>
          {facilities.map(facility => (
            <option key={facility} value={facility}>{facility}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className={styles.select}
        >
          <option value="">All Statuses</option>
          <option value="processing">Processing</option>
          <option value="segmented">Segmented</option>
          <option value="error">Error</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : recordings.length === 0 ? (
        <div className={styles.empty}>No recordings found</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Airport</th>
              <th>Facility</th>
              <th>Recorded At</th>
              <th>Duration</th>
              <th>Segments</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recordings.map(recording => (
              <tr key={recording.id}>
                <td>{recording.airport}</td>
                <td>{recording.facility}</td>
                <td>{formatDate(recording.recorded_at)}</td>
                <td>{formatDuration(recording.duration_seconds)}</td>
                <td>{recording.segment_count}</td>
                <td>
                  <span className={`${styles.status} ${styles[recording.status]}`}>
                    {recording.status}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => onSelectRecording(recording)}
                    className={styles.viewButton}
                  >
                    View Segments
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
