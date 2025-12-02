'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { formatFileSize } from '../../../../lib/utils/format';
import styles from './Statistics.module.css';

export default function Statistics() {
  const [stats, setStats] = useState({
    totalRecordings: 0,
    totalSegments: 0,
    storageUsed: 0,
    segmentsByAirport: {},
    labelCoverage: 0,
    qualityDistribution: {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  async function fetchStatistics() {
    setLoading(true);

    try {
      // Get total recordings
      const { count: recordingCount } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true });

      // Get total segments
      const { count: segmentCount } = await supabase
        .from('segments')
        .select('*', { count: 'exact', head: true });

      // Get all segments for detailed stats
      const { data: segments } = await supabase
        .from('segments')
        .select('file_size_bytes, audio_quality_score, label_count');

      // Get recordings by airport
      const { data: recordings } = await supabase
        .from('recordings')
        .select('airport, segment_count');

      // Calculate storage used
      const storageUsed = segments?.reduce((sum, s) => sum + (s.file_size_bytes || 0), 0) || 0;

      // Calculate segments by airport
      const segmentsByAirport = {};
      recordings?.forEach(r => {
        segmentsByAirport[r.airport] = (segmentsByAirport[r.airport] || 0) + r.segment_count;
      });

      // Calculate label coverage
      const segmentsWithLabels = segments?.filter(s => s.label_count > 0).length || 0;
      const labelCoverage = segments?.length ? (segmentsWithLabels / segments.length) * 100 : 0;

      // Calculate quality distribution
      const qualityDistribution = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      };

      segments?.forEach(s => {
        const score = s.audio_quality_score || 0;
        if (score >= 0.8) qualityDistribution.excellent++;
        else if (score >= 0.6) qualityDistribution.good++;
        else if (score >= 0.4) qualityDistribution.fair++;
        else qualityDistribution.poor++;
      });

      setStats({
        totalRecordings: recordingCount || 0,
        totalSegments: segmentCount || 0,
        storageUsed,
        segmentsByAirport,
        labelCoverage,
        qualityDistribution
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading statistics...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Statistics Dashboard</h2>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Recordings</div>
          <div className={styles.cardValue}>{stats.totalRecordings}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Segments</div>
          <div className={styles.cardValue}>{stats.totalSegments}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Storage Used</div>
          <div className={styles.cardValue}>{formatFileSize(stats.storageUsed)}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Label Coverage</div>
          <div className={styles.cardValue}>{stats.labelCoverage.toFixed(1)}%</div>
        </div>
      </div>

      <div className={styles.charts}>
        <div className={styles.chart}>
          <h3>Segments by Airport</h3>
          <div className={styles.barChart}>
            {Object.entries(stats.segmentsByAirport).map(([airport, count]) => {
              const maxCount = Math.max(...Object.values(stats.segmentsByAirport));
              const percentage = (count / maxCount) * 100;

              return (
                <div key={airport} className={styles.barRow}>
                  <div className={styles.barLabel}>{airport}</div>
                  <div className={styles.barContainer}>
                    <div
                      className={styles.bar}
                      style={{ width: `${percentage}%` }}
                    />
                    <span className={styles.barValue}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.chart}>
          <h3>Quality Distribution</h3>
          <div className={styles.barChart}>
            {Object.entries(stats.qualityDistribution).map(([quality, count]) => {
              const percentage = stats.totalSegments
                ? (count / stats.totalSegments) * 100
                : 0;

              return (
                <div key={quality} className={styles.barRow}>
                  <div className={styles.barLabel}>
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </div>
                  <div className={styles.barContainer}>
                    <div
                      className={`${styles.bar} ${styles[quality]}`}
                      style={{ width: `${percentage}%` }}
                    />
                    <span className={styles.barValue}>
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={fetchStatistics} className={styles.refreshButton}>
        Refresh Statistics
      </button>
    </div>
  );
}
