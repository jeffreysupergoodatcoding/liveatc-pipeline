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
        .select('transcription_confidence, rlhf_candidate, needs_human_review, status');

      if (error) throw error;

      // Calculate confidence routing statistics
      const totalSegments = segments.length;
      const transcribedSegments = segments.filter(s => s.transcription_confidence !== null);
      const transcribedCount = transcribedSegments.length;

      // High Confidence (RLHF) - confidence >= 90%
      const rlhfCandidates = segments.filter(s => s.rlhf_candidate === true);
      const rlhfCount = rlhfCandidates.length;

      // Processed for RLHF (needs_ranking status)
      const processedForRLHF = segments.filter(s => s.status === 'needs_ranking');
      const processedCount = processedForRLHF.length;

      // Low Confidence (Human Review) - confidence < 90%
      const humanReviewSegments = segments.filter(s => s.needs_human_review === true);
      const humanReviewCount = humanReviewSegments.length;

      // Average confidence for transcribed segments
      const avgConfidence = transcribedCount > 0
        ? transcribedSegments.reduce((sum, s) => sum + (s.transcription_confidence || 0), 0) / transcribedCount
        : null;

      // Confidence distribution
      const confidenceDistribution = {
        high: transcribedSegments.filter(s => s.transcription_confidence >= 0.90).length,
        medium: transcribedSegments.filter(s => s.transcription_confidence >= 0.70 && s.transcription_confidence < 0.90).length,
        low: transcribedSegments.filter(s => s.transcription_confidence < 0.70).length
      };

      const overall = {
        total_segments: totalSegments,
        transcribed_segments: transcribedCount,
        rlhf_candidates: rlhfCount,
        processed_for_rlhf: processedCount,
        needs_human_review: humanReviewCount,
        avg_confidence: avgConfidence
      };

      setStats({
        overall,
        confidenceDistribution
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
        <h2>Transcription Confidence Pipeline</h2>
        <p className={styles.subtitle}>Intelligent transcription routing based on confidence scores</p>
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
          High Confidence
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'flagged' ? styles.active : ''}`}
          onClick={() => setActiveTab('flagged')}
        >
          Low Confidence
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
        {activeTab === 'upload' && <AudioUpload />}
      </div>
    </div>
  );
}

function OverviewPanel({ stats, loading, onRefresh }) {
  const [activeSegments, setActiveSegments] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  function handleRunAnalysisClick() {
    console.log('handleRunAnalysisClick called, activeSegments:', activeSegments);

    if (activeSegments.length === 0) {
      alert('No segments queued for analysis');
      return;
    }

    console.log('Showing confirmation modal');
    setShowConfirmModal(true);
  }

  async function runAnalysis() {
    console.log('runAnalysis confirmed, starting analysis');
    setShowConfirmModal(false);

    setAnalyzing(true);
    const processedSegmentIds = activeSegments.map(s => s.id);

    try {
      const response = await fetch('/api/segments/analyze', {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start analysis');
      }

      const data = await response.json();
      console.log('Analysis started:', data);

      // Poll for completion every 5 seconds
      let pollCount = 0;
      const maxPolls = segmentCount * 8; // ~40 seconds per segment max

      const pollInterval = setInterval(async () => {
        pollCount++;

        try {
          // Refresh active segments and stats
          await fetchActiveSegments();
          await onRefresh();

          // Check if there are still active segments
          const { data: currentActive, error: activeError } = await supabase
            .from('segments')
            .select('id')
            .eq('active', true);

          if (activeError) {
            console.error('Error checking active segments:', activeError);
            clearInterval(pollInterval);
            setAnalyzing(false);
            alert('Error checking analysis status. Please refresh the page.');
            return;
          }

          if (!currentActive || currentActive.length === 0 || pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setAnalyzing(false);

            // Final refresh
            await fetchActiveSegments();
            await onRefresh();

            if (pollCount < maxPolls) {
              // Fetch the processed segments to show routing results
              const { data: processedSegments, error: processedError } = await supabase
                .from('segments')
                .select('id, transcription_confidence, rlhf_candidate, needs_human_review')
                .in('id', processedSegmentIds);

              if (processedError) {
                console.error('Error fetching processed segments:', processedError);
                alert('Analysis complete! Check the tabs for results.');
                return;
              }

              if (processedSegments && processedSegments.length > 0) {
                const highConfidence = processedSegments.filter(s => s.rlhf_candidate === true);
                const lowConfidence = processedSegments.filter(s => s.needs_human_review === true);

                let message = '✓ Analysis Complete\n\n';
                message += `Routing Results:\n`;
                message += `  • ${highConfidence.length} → High Confidence (RLHF)\n`;
                message += `  • ${lowConfidence.length} → Low Confidence (Human Review)\n\n`;

                if (highConfidence.length > 0) {
                  message += `High Confidence segments are ready for RLHF processing in the "High Confidence" tab.\n\n`;
                }
                if (lowConfidence.length > 0) {
                  message += `Low Confidence segments need human review in the "Low Confidence" tab.`;
                }

                alert(message);
              } else {
                alert('Analysis complete! Check the tabs for results.');
              }
            } else {
              alert('Analysis timed out. Some segments may still be processing. Please check the tabs and refresh.');
            }
          }
        } catch (pollError) {
          console.error('Error during polling:', pollError);
          clearInterval(pollInterval);
          setAnalyzing(false);
          alert('Error during analysis. Please check the console and try again.');
        }
      }, 5000);
    } catch (error) {
      console.error('Error running analysis:', error);
      alert(`Failed to start analysis: ${error.message}`);
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading statistics...</div>;
  }

  if (!stats) {
    return <div className={styles.error}>Failed to load statistics</div>;
  }

  const { overall, confidenceDistribution } = stats;

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
                onClick={handleRunAnalysisClick}
                className={styles.runAnalysisButton}
                disabled={analyzing}
              >
                {analyzing ? 'Running Analysis...' : '▶ Run Analysis'}
              </button>
            </div>
            <div className={styles.queueList}>
              {activeSegments.slice(0, 5).map(seg => (
                <div key={seg.id} className={styles.queueItem}>
                  <div className={styles.queueItemInfo}>
                    <span className={styles.queueItemAirport}>{seg.airport} - {seg.facility}</span>
                    <span className={styles.queueItemId}>ID: {seg.id}</span>
                  </div>
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
          title="Transcribed"
          value={overall.transcribed_segments}
          subtitle={overall.total_segments > 0 ? `${((overall.transcribed_segments / overall.total_segments) * 100).toFixed(0)}% of total` : ''}
        />
        <StatCard
          title="High Confidence (RLHF)"
          value={overall.rlhf_candidates}
          subtitle={overall.transcribed_segments > 0 ? `${((overall.rlhf_candidates / overall.transcribed_segments) * 100).toFixed(0)}% of transcribed` : ''}
          highlight="success"
        />
        <StatCard
          title="Processed for RLHF"
          value={overall.processed_for_rlhf}
          subtitle={overall.rlhf_candidates > 0 ? `${((overall.processed_for_rlhf / overall.rlhf_candidates) * 100).toFixed(0)}% of candidates` : ''}
          highlight="warning"
        />
      </div>

      {/* Quality Metrics */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="Average Confidence"
          value={overall.avg_confidence !== null ? `${(overall.avg_confidence * 100).toFixed(1)}%` : 'N/A'}
          range="Transcription confidence (0-100%)"
        />
        <MetricCard
          title="RLHF Threshold"
          value="≥90%"
          range="High confidence segments"
        />
      </div>

      {/* Confidence Distribution */}
      <div className={styles.section}>
        <h3>Confidence Distribution</h3>
        <div className={styles.severityChart}>
          <SeverityBar
            label="High (≥90%) - RLHF"
            count={confidenceDistribution.high}
            color="blue"
          />
          <SeverityBar
            label="Medium (70-89%) - Human Review"
            count={confidenceDistribution.medium}
            color="yellow"
          />
          <SeverityBar
            label="Low (<70%) - Human Review"
            count={confidenceDistribution.low}
            color="red"
          />
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className={styles.section}>
        <h3>Pipeline Summary</h3>
        <div className={styles.categoryTable}>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.categoryName}>High Confidence</td>
                <td><strong>{overall.rlhf_candidates}</strong></td>
                <td>RLHF Training Data</td>
              </tr>
              <tr>
                <td className={styles.categoryName}>Needs Human Review</td>
                <td><strong>{overall.needs_human_review}</strong></td>
                <td>SFT Training Data</td>
              </tr>
              <tr>
                <td className={styles.categoryName}>Ready for Ranking</td>
                <td><strong>{overall.processed_for_rlhf}</strong></td>
                <td>Human Preference Pairs</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Analysis</h3>
            <p>
              Run audio analysis on {activeSegments.length} segment(s)?
            </p>
            <p className={styles.modalSubtext}>
              This will take approximately {activeSegments.length * 30} seconds.
            </p>
            <div className={styles.modalButtons}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className={styles.modalCancelButton}
              >
                Cancel
              </button>
              <button
                onClick={runAnalysis}
                className={styles.modalConfirmButton}
              >
                Confirm
              </button>
            </div>
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

