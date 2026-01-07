'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import styles from './FlaggedSegments.module.css';
import AudioTrimmer from './AudioTrimmer';

export default function FlaggedSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    minScore: 0,
    reviewed: 'all',
    airport: 'all'
  });
  const [airports, setAirports] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [manualTranscription, setManualTranscription] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [removeRegions, setRemoveRegions] = useState([]);

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

      let allSegments = data.segments || [];

      // Extract unique airports
      const uniqueAirports = [...new Set(allSegments.map(s => s.airport))].sort();
      setAirports(uniqueAirports);

      // Apply client-side airport filter
      if (filters.airport !== 'all') {
        allSegments = allSegments.filter(s => s.airport === filters.airport);
      }

      setSegments(allSegments);
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


    // Apply trim if needed - only if regions are valid
    if (approved && removeRegions && removeRegions.length > 0) {
      // Validate that regions have proper structure
      const validRegions = removeRegions.filter(r => r && typeof r.start === 'number' && typeof r.end === 'number');

      if (validRegions.length > 0) {
        console.log('Applying trim with regions:', validRegions);
        try {
          const trimRes = await fetch(`/api/segments/${selectedSegment.id}/trim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              removeRegions: validRegions,
              previewOnly: false
            })
          });

          if (!trimRes.ok) {
            const errorData = await trimRes.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.details || 'Trim failed');
          }
        } catch (e) {
          console.error('Trim error:', e);
          alert(`Failed to apply audio trim: ${e.message}`);
          return;
        }
      }
    }

    try {
      const response = await fetch(`/api/segments/${selectedSegment.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewed: true,
          approved,
          notes: reviewNotes,
          manualTranscription: manualTranscription.trim(),
          contextNotes: contextNotes.trim(),
          removeRegions: removeRegions.length > 0 ? removeRegions : undefined // Only send if regions exist
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        alert(`Failed to submit review: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();

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
          <label>Airport</label>
          <select
            value={filters.airport}
            onChange={(e) => setFilters({ ...filters, airport: e.target.value })}
          >
            <option value="all">All</option>
            {airports.map(airport => (
              <option key={airport} value={airport}>{airport}</option>
            ))}
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
                <h4>{segments.length} Low Confidence Segments</h4>
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
                    setRemoveRegions([]);
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
                    setRemoveRegions([]);
                  }}
                  removeRegions={removeRegions}
                  setRemoveRegions={setRemoveRegions}
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
          <span className={styles.segmentId}>ID: {segment.id}</span>
        </div>
        <div className={styles.scoreDisplay}>
          <div className={styles.score} data-severity={getSeverityLevel(segment.transcription_confidence || 0)}>
            {((segment.transcription_confidence || 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>



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
  onClose,
  removeRegions,
  setRemoveRegions
}) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [words, setWords] = useState([]);
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const [editingWord, setEditingWord] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [modelOutputs, setModelOutputs] = useState(null);
  const [wordConfidences, setWordConfidences] = useState([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioRef = useRef(null);
  const [editorMode, setEditorMode] = useState('simple'); // 'simple' or 'advanced'
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  // removeRegions state lifted to parent



  // Fetch model outputs for word-level confidence
  useEffect(() => {
    if (segment?.id) {
      fetchModelOutputs();
    }
  }, [segment?.id]);

  async function fetchModelOutputs() {
    try {
      const { data, error } = await supabase
        .from('model_outputs')
        .select('*')
        .eq('segment_id', segment.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setModelOutputs(data[0]);
        // Extract word confidences from primary variation
        if (data[0].variations && data[0].variations.length > 0) {
          const primaryWords = data[0].variations[0].words || [];
          setWordConfidences(primaryWords);
        }
      } else {
        setModelOutputs(null);
        setWordConfidences([]);
      }
    } catch (error) {
      console.error('Error fetching model outputs:', error);
      setModelOutputs(null);
      setWordConfidences([]);
    }
  }

  // Initialize words when entering review mode or when segment changes
  useEffect(() => {
    if (reviewMode && segment.transcription_text) {
      const initialWords = segment.transcription_text.split(/\s+/).filter(w => w.length > 0);
      setWords(initialWords);
      setHistory([initialWords]);
      setHistoryIndex(0);
      setSelectedWordIndex(null);
      setEditingWord('');
      onManualTranscriptionChange(initialWords.join(' '));
    }
  }, [reviewMode, segment.id, segment.transcription_text]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e) {
      if (!reviewMode) return;

      // Cmd+Z (Mac) or Ctrl+Z (Windows) for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Windows) for redo
      else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [reviewMode, historyIndex, history]);

  // Save to history after word changes
  function saveToHistory(newWords) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newWords);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  function undo() {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setWords(history[newIndex]);
      onManualTranscriptionChange(history[newIndex].join(' '));
      setSelectedWordIndex(null);
      setEditingWord('');
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setWords(history[newIndex]);
      onManualTranscriptionChange(history[newIndex].join(' '));
      setSelectedWordIndex(null);
      setEditingWord('');
    }
  }

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
        setOriginalAudioUrl(data.url);
      }
    } catch (error) {
      console.error('Error fetching audio URL:', error);
    } finally {
      setLoadingAudio(false);
    }
  }

  // Word editing functions
  function handleWordClick(index) {
    setSelectedWordIndex(index);
    setEditingWord(words[index]);
  }

  function handleWordChange(newWord) {
    const newWords = [...words];
    newWords[selectedWordIndex] = newWord;
    setWords(newWords);
    saveToHistory(newWords);
    onManualTranscriptionChange(newWords.join(' '));
    setEditingWord(newWord);
  }

  function markWordAsUnknown(index) {
    const newWords = [...words];
    newWords[index] = '[UNKNOWN]';
    setWords(newWords);
    saveToHistory(newWords);
    onManualTranscriptionChange(newWords.join(' '));
    if (selectedWordIndex === index) {
      setSelectedWordIndex(null);
      setEditingWord('');
    }
  }

  function deleteWord(index) {
    const newWords = words.filter((_, i) => i !== index);
    setWords(newWords);
    saveToHistory(newWords);
    onManualTranscriptionChange(newWords.join(' '));
    if (selectedWordIndex === index) {
      setSelectedWordIndex(null);
      setEditingWord('');
    } else if (selectedWordIndex > index) {
      setSelectedWordIndex(selectedWordIndex - 1);
    }
  }

  function addWord(afterIndex) {
    const newWords = [...words];
    newWords.splice(afterIndex + 1, 0, '[NEW]');
    setWords(newWords);
    saveToHistory(newWords);
    onManualTranscriptionChange(newWords.join(' '));
    setSelectedWordIndex(afterIndex + 1);
    setEditingWord('[NEW]');
  }

  function moveWordUp(index) {
    if (index === 0) return;
    const newWords = [...words];
    [newWords[index - 1], newWords[index]] = [newWords[index], newWords[index - 1]];
    setWords(newWords);
    saveToHistory(newWords);
    onManualTranscriptionChange(newWords.join(' '));
    if (selectedWordIndex === index) {
      setSelectedWordIndex(index - 1);
    } else if (selectedWordIndex === index - 1) {
      setSelectedWordIndex(index);
    }
  }

  function moveWordDown(index) {
    if (index === words.length - 1) return;
    const newWords = [...words];
    [newWords[index], newWords[index + 1]] = [newWords[index + 1], newWords[index]];
    setWords(newWords);
    saveToHistory(newWords);
    onManualTranscriptionChange(newWords.join(' '));
    if (selectedWordIndex === index) {
      setSelectedWordIndex(index + 1);
    } else if (selectedWordIndex === index + 1) {
      setSelectedWordIndex(index);
    }
  }

  function closeWordEditor() {
    setSelectedWordIndex(null);
    setEditingWord('');
  }

  // Helper to get confidence for a word at a specific index
  function getWordConfidence(index) {
    if (!wordConfidences || wordConfidences.length === 0) return null;
    // Try to match by index first
    if (wordConfidences[index]) {
      return wordConfidences[index].confidence;
    }
    return null;
  }

  // Get color based on confidence
  function getConfidenceColor(confidence) {
    if (confidence === null) return '#fff'; // No data
    if (confidence >= 0.90) return '#d4edda'; // High - green
    if (confidence >= 0.70) return '#fff3cd'; // Medium - yellow
    return '#f8d7da'; // Low - red
  }

  // Download audio with proper filename
  async function handleDownloadAudio() {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Create a better filename: airport_facility_timestamp.mp3
      const timestamp = new Date(segment.recorded_at).toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${segment.airport}_${segment.facility}_${timestamp}.mp3`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download audio file');
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
          <p className={styles.segmentId}>
            ID: {segment.id}
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

        {/* Attempted Transcription with Word-Level Confidence */}
        <section>
          <h5>
            {segment.transcription_confidence < 0.85 ? 'Attempted Transcription' : 'Transcription'}
            {segment.transcription_confidence < 0.85 && (
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                color: '#ff6b6b',
                fontWeight: 'normal'
              }}>
                ⚠️ Low confidence - may be inaccurate
              </span>
            )}
          </h5>
          {segment.transcription_text ? (
            <div className={styles.transcriptionBox} style={{
              backgroundColor: '#fff',
              border: '1px solid #dee2e6',
              padding: '16px'
            }}>
              {/* Word-by-word display with confidence coloring */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                marginBottom: '12px',
                lineHeight: '2'
              }}>
                {segment.transcription_text.split(/\s+/).map((word, index) => {
                  const confidence = getWordConfidence(index);
                  const bgColor = getConfidenceColor(confidence);

                  return (
                    <span
                      key={index}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: bgColor,
                        borderRadius: '3px',
                        border: confidence !== null ? '1px solid #adb5bd' : 'none',
                        fontSize: '14px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                      title={confidence !== null ? `Confidence: ${(confidence * 100).toFixed(1)}%` : word}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>

              {/* Overall confidence display */}
              {segment.transcription_confidence && (
                <div className={styles.confidence} style={{
                  color: '#666',
                  fontSize: '12px',
                  paddingTop: '8px',
                  borderTop: '1px solid #dee2e6'
                }}>
                  Overall Confidence: {(segment.transcription_confidence * 100).toFixed(1)}%
                  {wordConfidences.length > 0 && ' • Hover over words to see individual confidence scores'}
                  {!wordConfidences.length && ' • Word-level confidence not available for this segment'}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.transcriptionBox} style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              padding: '16px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>
                No transcription available yet.
              </p>
              <p style={{ color: '#999', fontSize: '13px', marginTop: '8px', marginBottom: 0 }}>
                Transcriptions are generated when segments are analyzed. This segment may not have been processed yet.
              </p>
            </div>
          )}
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
            <div>
              <audio
                ref={audioRef}
                controls
                className={styles.audioPlayer}
                key={audioUrl}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    audioRef.current.playbackRate = playbackSpeed;
                  }
                }}
              >
                <source src={audioUrl} type="audio/mpeg" />
                Your browser does not support audio playback.
              </audio>

              {/* Download button with proper styling */}
              <div style={{
                marginTop: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <button
                  onClick={handleDownloadAudio}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#2563eb',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#eff6ff';
                    e.target.style.borderColor = '#2563eb';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.borderColor = '#d1d5db';
                  }}
                >
                  ⬇ Download
                </button>
              </div>

              {/* Playback Speed Controls */}
              <div style={{
                marginTop: '12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: '#666',
                  fontWeight: '500'
                }}>
                  Speed:
                </span>
                {[1.0, 0.75, 0.5].map(speed => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      if (audioRef.current) {
                        audioRef.current.playbackRate = speed;
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: playbackSpeed === speed ? '2px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: playbackSpeed === speed ? '#eff6ff' : 'white',
                      color: playbackSpeed === speed ? '#2563eb' : '#374151',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.noAudio}>Audio not available</p>
          )}
          {segment.duration_seconds && (
            <span className={styles.duration}>{segment.duration_seconds.toFixed(1)}s</span>
          )}
        </section>

        {/* Audio Trimmer - Only show in review mode */}
        {reviewMode && audioUrl && (
          <section>
            <AudioTrimmer
              audioUrl={originalAudioUrl}
              duration={segment.duration_seconds || 0}
              segment={segment}
              onTrimSave={async (regions) => {
                // Generate trimmed audio for preview but don't update database
                try {
                  const response = await fetch(`/api/segments/${segment.id}/trim`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      removeRegions: regions,
                      previewOnly: true // Don't update segment record
                    })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to trim audio');
                  }

                  const data = await response.json();

                  // Update audio player with trimmed version
                  if (data.trimmedAudioUrl) {
                    setAudioUrl(data.trimmedAudioUrl);
                  }

                  // Store for approval
                  setRemoveRegions(regions);

                  console.log('Audio trimmed (preview only)');
                } catch (error) {
                  alert(`Error: ${error.message}`);
                }
              }}
            />
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

            {/* Manual Transcription Word Editor */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <label style={{ fontWeight: 'bold' }}>
                  Manual Transcription <span style={{ color: 'red' }}>*</span>
                </label>

                {/* Editor Mode Toggle */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => {
                      setEditorMode('simple');
                      // Sync text area with words
                      if (editorMode === 'advanced') {
                        onManualTranscriptionChange(words.join(' '));
                      }
                    }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: editorMode === 'simple' ? '2px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: editorMode === 'simple' ? '#eff6ff' : 'white',
                      color: editorMode === 'simple' ? '#2563eb' : '#666',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => {
                      setEditorMode('advanced');
                      // Sync words with text area
                      if (editorMode === 'simple' && manualTranscription) {
                        const newWords = manualTranscription.split(/\s+/).filter(w => w.length > 0);
                        setWords(newWords);
                        setHistory([newWords]);
                        setHistoryIndex(0);
                      }
                    }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: editorMode === 'advanced' ? '2px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: editorMode === 'advanced' ? '#eff6ff' : 'white',
                      color: editorMode === 'advanced' ? '#2563eb' : '#666',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Word-by-Word
                  </button>
                </div>
              </div>

              {editorMode === 'simple' ? (
                /* Simple Text Area Mode */
                <div>
                  <textarea
                    value={manualTranscription}
                    onChange={(e) => onManualTranscriptionChange(e.target.value)}
                    placeholder="Type or paste the corrected transcription here. Use [UNKNOWN] for unclear portions."
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '12px',
                      fontSize: '14px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      border: '2px solid #2563eb',
                      borderRadius: '6px',
                      resize: 'vertical',
                      lineHeight: '1.6'
                    }}
                  />
                  <div style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    💡 Tip: Use [UNKNOWN] for unclear words or phrases
                  </div>
                </div>
              ) : (
                /* Advanced Word-by-Word Mode */
                <div>
                  {/* Undo/Redo Toolbar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className={styles.startReviewButton}
                        style={{
                          padding: '4px 12px',
                          fontSize: '12px',
                          opacity: historyIndex <= 0 ? 0.5 : 1,
                          cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↶ Undo (⌘Z)
                      </button>
                      <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className={styles.startReviewButton}
                        style={{
                          padding: '4px 12px',
                          fontSize: '12px',
                          opacity: historyIndex >= history.length - 1 ? 0.5 : 1,
                          cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↷ Redo (⌘⇧Z)
                      </button>
                    </div>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {words.length} word{words.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Word Editor */}
                  <div style={{
                    border: '2px solid #007bff',
                    borderRadius: '4px',
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    minHeight: '120px',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      alignItems: 'center'
                    }}>
                      {words.map((word, index) => {
                        const confidence = getWordConfidence(index);
                        const bgColor = word === '[UNKNOWN]'
                          ? '#ffc107'
                          : selectedWordIndex === index
                            ? '#007bff'
                            : getConfidenceColor(confidence);

                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ position: 'relative' }}>
                              <span
                                onClick={() => handleWordClick(index)}
                                style={{
                                  display: 'inline-block',
                                  padding: '4px 8px',
                                  backgroundColor: bgColor,
                                  color: selectedWordIndex === index ? '#fff' : '#000',
                                  border: '1px solid ' + (word === '[UNKNOWN]' ? '#ff9800' : confidence !== null ? '#adb5bd' : '#dee2e6'),
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontFamily: 'monospace',
                                  transition: 'all 0.2s'
                                }}
                                title={confidence !== null ? `Confidence: ${(confidence * 100).toFixed(1)}%` : 'Click to edit'}
                              >
                                {word}
                              </span>

                              {/* Delete button on hover */}
                              {selectedWordIndex === index && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteWord(index);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    backgroundColor: '#dc3545',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    fontWeight: 'bold'
                                  }}
                                  title="Delete word"
                                >
                                  ×
                                </button>
                              )}

                              {/* Move up/down buttons */}
                              {selectedWordIndex === index && (
                                <div style={{
                                  position: 'absolute',
                                  left: '-24px',
                                  top: '0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}>
                                  {index > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveWordUp(index);
                                      }}
                                      style={{
                                        backgroundColor: '#6c757d',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '3px',
                                        width: '20px',
                                        height: '14px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0
                                      }}
                                      title="Move up"
                                    >
                                      ▲
                                    </button>
                                  )}
                                  {index < words.length - 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveWordDown(index);
                                      }}
                                      style={{
                                        backgroundColor: '#6c757d',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '3px',
                                        width: '20px',
                                        height: '14px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0
                                      }}
                                      title="Move down"
                                    >
                                      ▼
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Add word button after each word */}
                            <button
                              onClick={() => addWord(index)}
                              style={{
                                backgroundColor: '#28a745',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                fontWeight: 'bold'
                              }}
                              title="Add word after this"
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Word Edit Input */}
                  {selectedWordIndex !== null && words[selectedWordIndex] !== '[UNKNOWN]' && (
                    <div style={{
                      backgroundColor: '#fff',
                      border: '2px solid #007bff',
                      borderRadius: '4px',
                      padding: '12px',
                      marginBottom: '8px'
                    }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}>
                        Editing word {selectedWordIndex + 1}:
                      </label>
                      <input
                        type="text"
                        value={editingWord}
                        onChange={(e) => handleWordChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            closeWordEditor();
                          } else if (e.key === 'Escape') {
                            handleWordChange(words[selectedWordIndex]);
                            closeWordEditor();
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #dee2e6',
                          borderRadius: '3px',
                          fontSize: '14px',
                          fontFamily: 'monospace'
                        }}
                        autoFocus
                      />
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={closeWordEditor}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Done (Enter)
                        </button>
                        <button
                          onClick={() => markWordAsUnknown(selectedWordIndex)}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#ffc107',
                            color: '#000',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Mark as [UNKNOWN]
                        </button>
                        <button
                          onClick={() => {
                            handleWordChange(words[selectedWordIndex]);
                            closeWordEditor();
                          }}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel (Esc)
                        </button>
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Click any word to edit it or mark as [UNKNOWN] if inaudible. The corrected transcription will be used for training.
                  </p>
                </div>
              )}
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
