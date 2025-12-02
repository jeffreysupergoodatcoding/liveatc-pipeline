'use client';

import { useState, useEffect } from 'react';
import styles from './EdgeCasesDashboard.module.css';
import TaxonomyViewer from './TaxonomyViewer';
import FlaggedSegments from './FlaggedSegments';
import AnalyzedSegments from './AnalyzedSegments';
import CustomRules from './CustomRules';
import AudioUpload from './AudioUpload';
import { supabase } from '../../../../lib/supabase';

export default function EdgeCasesDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const { data: segments, error } = await supabase
        .from('segments')
        .select('audio_analysis_score, detected_patterns');

      if (error) throw error;

      // Calculate audio analysis statistics
      const analyzedSegments = segments.filter(s => s.audio_analysis_score !== null);
      const totalSegments = segments.length;
      const analyzedCount = analyzedSegments.length;

      // Calculate average audio score
      const avgAudioScore = analyzedCount > 0
        ? analyzedSegments.reduce((sum, s) => sum + s.audio_analysis_score, 0) / analyzedCount
        : null;

      // Count high interest segments (≥65%)
      const highInterestCount = analyzedSegments.filter(s => s.audio_analysis_score >= 0.65).length;

      // Count unique patterns detected
      const allPatterns = analyzedSegments
        .filter(s => s.detected_patterns && s.detected_patterns.length > 0)
        .flatMap(s => s.detected_patterns);
      const uniquePatterns = new Set(allPatterns);

      // Pattern distribution
      const patternCounts = {};
      allPatterns.forEach(pattern => {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      });

      // Convert to array for display
      const patternsByType = Object.entries(patternCounts)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count);

      // Audio score distribution
      const scoreDistribution = {
        high: analyzedSegments.filter(s => s.audio_analysis_score >= 0.65).length,
        medium: analyzedSegments.filter(s => s.audio_analysis_score >= 0.35 && s.audio_analysis_score < 0.65).length,
        low: analyzedSegments.filter(s => s.audio_analysis_score >= 0.1 && s.audio_analysis_score < 0.35).length,
        routine: analyzedSegments.filter(s => s.audio_analysis_score < 0.1).length
      };

      const overall = {
        total_segments: totalSegments,
        analyzed_segments: analyzedCount,
        high_interest_segments: highInterestCount,
        avg_audio_score: avgAudioScore,
        unique_patterns_detected: uniquePatterns.size
      };

      setStats({
        overall,
        byPattern: patternsByType,
        scoreDistribution
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Edge Case Detection System</h2>
        <p className={styles.subtitle}>Intelligent aviation communication analysis powered by AI</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'analyzed' ? styles.active : ''}`}
          onClick={() => setActiveTab('analyzed')}
        >
          Analyzed
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'flagged' ? styles.active : ''}`}
          onClick={() => setActiveTab('flagged')}
        >
          Flagged (Edge Cases)
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'taxonomy' ? styles.active : ''}`}
          onClick={() => setActiveTab('taxonomy')}
        >
          Taxonomy (57 Cases)
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'rules' ? styles.active : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Custom Rules
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload & Analyze
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'overview' && (
          <OverviewPanel stats={stats} loading={loading} onRefresh={fetchStats} />
        )}
        {activeTab === 'analyzed' && <AnalyzedSegments />}
        {activeTab === 'flagged' && <FlaggedSegments />}
        {activeTab === 'taxonomy' && <TaxonomyViewer />}
        {activeTab === 'rules' && <CustomRules />}
        {activeTab === 'upload' && <AudioUpload />}
      </div>
    </div>
  );
}

function OverviewPanel({ stats, loading, onRefresh }) {
  const [activeSegments, setActiveSegments] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchActiveSegments();
  }, []);

  async function fetchActiveSegments() {
    setLoadingActive(true);
    try {
      const { data, error } = await supabase
        .from('segments')
        .select(`
          *,
          recordings!inner(airport, facility, recorded_at)
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to flat structure
      const flatSegments = data.map(segment => ({
        ...segment,
        airport: segment.recordings.airport,
        facility: segment.recordings.facility,
        recorded_at: segment.recordings.recorded_at
      }));

      setActiveSegments(flatSegments);
    } catch (error) {
      console.error('Error fetching active segments:', error);
      setActiveSegments([]);
    } finally {
      setLoadingActive(false);
    }
  }

  async function runAnalysis() {
    if (activeSegments.length === 0) {
      alert('No segments queued for analysis');
      return;
    }

    const segmentCount = activeSegments.length;
    if (!confirm(`Run audio analysis on ${segmentCount} segment(s)?\n\nThis will take approximately ${segmentCount * 30} seconds.`)) {
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch('/api/segments/analyze', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }

      const data = await response.json();

      // Show progress message
      alert(`Analysis started for ${data.count} segment(s).\n\nProcessing in background...\nCheck the Analyzed tab in about ${data.count * 30} seconds.`);

      // Poll for completion every 5 seconds
      let pollCount = 0;
      const maxPolls = segmentCount * 8; // ~40 seconds per segment max

      const pollInterval = setInterval(async () => {
        pollCount++;

        // Refresh active segments and stats
        await fetchActiveSegments();
        await onRefresh();

        // Check if there are still active segments
        const { data: currentActive } = await supabase
          .from('segments')
          .select('id')
          .eq('active', true);

        if (!currentActive || currentActive.length === 0 || pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setAnalyzing(false);

          // Final refresh
          await fetchActiveSegments();
          await onRefresh();

          if (pollCount < maxPolls) {
            alert('Analysis complete! Check the Analyzed tab for results.');
          }
        }
      }, 5000);
    } catch (error) {
      console.error('Error running analysis:', error);
      alert('Failed to start analysis');
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading statistics...</div>;
  }

  if (!stats) {
    return <div className={styles.error}>Failed to load statistics</div>;
  }

  const { overall, byPattern, scoreDistribution } = stats;

  return (
    <div className={styles.overview}>
      <div className={styles.refreshBar}>
        <button onClick={onRefresh} className={styles.refreshButton}>
          Refresh
        </button>
      </div>

      {/* Active Segments Queue */}
      <div className={styles.section}>
        <h3>Analysis Queue</h3>
        {loadingActive ? (
          <p>Loading...</p>
        ) : activeSegments.length === 0 ? (
          <div className={styles.emptyQueue}>
            <p>No segments queued for analysis</p>
            <span>Go to Recordings → select segments → click "Queue" to add them here</span>
          </div>
        ) : (
          <div className={styles.queueSection}>
            <div className={styles.queueHeader}>
              <span className={styles.queueCount}>{activeSegments.length} segment(s) ready</span>
              <button
                onClick={runAnalysis}
                className={styles.runAnalysisButton}
                disabled={analyzing}
              >
                {analyzing ? 'Running Analysis...' : '▶ Run Analysis'}
              </button>
            </div>
            <div className={styles.queueList}>
              {activeSegments.slice(0, 5).map(seg => (
                <div key={seg.id} className={styles.queueItem}>
                  <span className={styles.queueItemAirport}>{seg.airport} - {seg.facility}</span>
                  <span className={styles.queueItemDuration}>{seg.duration_seconds?.toFixed(1)}s</span>
                </div>
              ))}
              {activeSegments.length > 5 && (
                <div className={styles.queueMore}>
                  + {activeSegments.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overall Stats Cards */}
      <div className={styles.statsGrid}>
        <StatCard
          title="Total Segments"
          value={overall.total_segments}
        />
        <StatCard
          title="Analyzed"
          value={overall.analyzed_segments}
          subtitle={overall.total_segments > 0 ? `${((overall.analyzed_segments / overall.total_segments) * 100).toFixed(0)}% of total` : ''}
        />
        <StatCard
          title="High Interest"
          value={overall.high_interest_segments}
          subtitle={overall.analyzed_segments > 0 ? `${((overall.high_interest_segments / overall.analyzed_segments) * 100).toFixed(0)}% of analyzed` : ''}
          highlight="warning"
        />
        <StatCard
          title="Unique Patterns"
          value={overall.unique_patterns_detected}
          subtitle="Different types detected"
          highlight="success"
        />
      </div>

      {/* Quality Metrics */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="Average Audio Score"
          value={overall.avg_audio_score !== null ? `${(overall.avg_audio_score * 100).toFixed(1)}%` : 'N/A'}
          range="Interest level (0-100%)"
        />
        <MetricCard
          title="High Interest Threshold"
          value="≥65%"
          range="Segments worth reviewing"
        />
      </div>

      {/* Score Distribution */}
      <div className={styles.section}>
        <h3>Audio Interest Distribution</h3>
        <div className={styles.severityChart}>
          <SeverityBar
            label="High (≥65%)"
            count={scoreDistribution.high}
            color="red"
          />
          <SeverityBar
            label="Medium (35-64%)"
            count={scoreDistribution.medium}
            color="orange"
          />
          <SeverityBar
            label="Low (10-34%)"
            count={scoreDistribution.low}
            color="yellow"
          />
          <SeverityBar
            label="Routine (<10%)"
            count={scoreDistribution.routine}
            color="blue"
          />
        </div>
      </div>

      {/* Pattern Breakdown */}
      {byPattern && byPattern.length > 0 && (
        <div className={styles.section}>
          <h3>Detected Patterns</h3>
          <div className={styles.categoryTable}>
            <table>
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {byPattern.map((p) => (
                  <tr key={p.pattern}>
                    <td className={styles.categoryName}>{formatPatternName(p.pattern)}</td>
                    <td><strong>{p.count}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, highlight }) {
  return (
    <div className={`${styles.statCard} ${highlight ? styles[highlight] : ''}`}>
      <div className={styles.statContent}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statTitle}>{title}</div>
        {subtitle && <div className={styles.statSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}

function MetricCard({ title, value, range }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricContent}>
        <div className={styles.metricTitle}>{title}</div>
        <div className={styles.metricValue}>{value}</div>
        <div className={styles.metricRange}>{range}</div>
      </div>
    </div>
  );
}

function SeverityBar({ label, count, color }) {
  return (
    <div className={styles.severityRow}>
      <div className={styles.severityLabel}>{label}</div>
      <div className={styles.severityBarContainer}>
        <div
          className={styles.severityBarFill}
          style={{ width: count > 0 ? `${Math.min(count * 2, 100)}%` : '0%', backgroundColor: `var(--color-${color})` }}
        />
      </div>
      <div className={styles.severityCount}>{count}</div>
    </div>
  );
}

function formatPatternName(pattern) {
  return pattern
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
