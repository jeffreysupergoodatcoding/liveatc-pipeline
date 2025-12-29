'use client';

import { useState, useEffect } from 'react';
import styles from './EdgeCasesDashboard.module.css';
import FlaggedSegments from './FlaggedSegments';
import AnalyzedSegments from './AnalyzedSegments';
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
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [analysisResults, setAnalysisResults] = useState('');

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
        .eq('status', 'pending')
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
    if (activeSegments.length === 0) {
      alert('No segments queued for analysis');
      return;
    }

    setShowConfirmModal(true);
  }

  async function runAnalysis() {
    setShowConfirmModal(false);

    setAnalyzing(true);
    const segmentsToProcess = [...activeSegments]; // Clone the array to prevent mutation issues
    const processedSegmentIds = segmentsToProcess.map(s => s.id);

    try {
      // Process each segment through the confidence pipeline
      let processedCount = 0;
      let errorCount = 0;
      const successfulSegmentIds = [];

      for (const segment of segmentsToProcess) {
        try {
          console.log(`Processing segment ${segment.id}...`);
          const response = await fetch('/api/process-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segmentId: segment.id })
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`✓ Segment ${segment.id} processed successfully:`, result.status);
            processedCount++;
            successfulSegmentIds.push(segment.id);
          } else {
            const errorData = await response.json();
            console.error(`✗ Segment ${segment.id} failed:`, errorData);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error processing segment ${segment.id}:`, error);
          errorCount++;
        }
      }

      // Update all successfully processed segments to 'active' status (removes from queue)
      if (successfulSegmentIds.length > 0) {
        console.log(`Updating ${successfulSegmentIds.length} successfully processed segments...`);
        const { error: deactivateError } = await supabase
          .from('segments')
          .update({ status: 'active' })
          .in('id', successfulSegmentIds);

        if (deactivateError) {
          console.error('Error deactivating segments:', deactivateError);
        } else {
          console.log(`✓ Successfully deactivated ${successfulSegmentIds.length} segments`);
        }
      }

      // Final refresh
      await fetchActiveSegments();
      await onRefresh();

      // Fetch the processed segments to show routing results
      const { data: processedSegments, error: processedError } = await supabase
        .from('segments')
        .select('id, transcription_confidence, rlhf_candidate, needs_human_review')
        .in('id', processedSegmentIds);

      if (processedError) {
        console.error('Error fetching processed segments:', processedError);
        alert(`Analysis complete! Processed ${processedCount} segments. Check the tabs for results.`);
        setAnalyzing(false);
        return;
      }

      if (processedSegments && processedSegments.length > 0) {
        const highConfidence = processedSegments.filter(s => s.rlhf_candidate === true);
        const lowConfidence = processedSegments.filter(s => s.needs_human_review === true);

        let message = '✓ Analysis Complete\n\n';
        message += `Processed: ${processedCount} segments\n`;
        if (errorCount > 0) {
          message += `Errors: ${errorCount} segments\n`;
        }
        message += `\nRouting Results:\n`;
        message += `  • ${highConfidence.length} → High Confidence (RLHF)\n`;
        message += `  • ${lowConfidence.length} → Low Confidence (Human Review)\n\n`;

        if (highConfidence.length > 0) {
          message += `High Confidence segments are ready for RLHF processing in the "High Confidence" tab.\n\n`;
        }
        if (lowConfidence.length > 0) {
          message += `Low Confidence segments need human review in the "Low Confidence" tab.`;
        }

        setAnalysisResults(message);
        setShowResultsModal(true);
      } else {
        alert(`Analysis complete! Processed ${processedCount} segments. Check the tabs for results.`);
      }

      setAnalyzing(false);
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
            total={overall.transcribed_segments}
            color="blue"
          />
          <SeverityBar
            label="Medium (70-89%) - Human Review"
            count={confidenceDistribution.medium}
            total={overall.transcribed_segments}
            color="yellow"
          />
          <SeverityBar
            label="Low (<70%) - Human Review"
            count={confidenceDistribution.low}
            total={overall.transcribed_segments}
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

      {/* Results Modal */}
      {showResultsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowResultsModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>✓ Analysis Complete</h3>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: '16px 0',
              textAlign: 'left'
            }}>
              {analysisResults}
            </pre>
            <div className={styles.modalButtons}>
              <button
                onClick={() => setShowResultsModal(false)}
                className={styles.modalConfirmButton}
              >
                OK
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

function SeverityBar({ label, count, color, total }) {
  // Calculate percentage of total, with minimum width for visibility
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const width = count > 0 ? Math.max(percentage, 5) : 0; // Minimum 5% width when count > 0

  // Map color names to hex values
  const colorMap = {
    blue: '#3b82f6',
    yellow: '#f59e0b',
    red: '#ef4444',
    green: '#10b981'
  };

  return (
    <div className={styles.severityRow}>
      <div className={styles.severityLabel}>{label}</div>
      <div className={styles.severityBarContainer}>
        <div
          className={styles.severityBarFill}
          style={{
            width: `${width}%`,
            backgroundColor: colorMap[color] || '#6b7280'
          }}
        />
      </div>
      <div className={styles.severityCount}>{count}</div>
    </div>
  );
}

