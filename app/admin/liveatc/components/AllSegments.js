'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import styles from './AllSegments.module.css';
import AudioTrimmer from './AudioTrimmer';

export default function AllSegments() {
    const [segments, setSegments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        airport: 'all',
        hasLabel: 'all',
        hasVariants: 'all',
        confidence: 'all',
        queue: 'all',
        classification: 'all'
    });
    const [airports, setAirports] = useState([]);
    const [selectedSegment, setSelectedSegment] = useState(null);

    // Analysis queue state
    const [queuedSegments, setQueuedSegments] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [showQueue, setShowQueue] = useState(false);

    useEffect(() => {
        fetchSegments();
    }, [filters]);

    async function fetchSegments() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('segments')
                .select(`
          *,
          recordings!inner(airport, facility, recorded_at)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform to flat structure
            let allSegments = data.map(segment => ({
                ...segment,
                airport: segment.recordings.airport,
                facility: segment.recordings.facility,
                recorded_at: segment.recordings.recorded_at
            }));

            // Extract unique airports
            const uniqueAirports = [...new Set(allSegments.map(s => s.airport))].sort();
            setAirports(uniqueAirports);

            // Identify queued segments (status === 'pending')
            const queued = allSegments.filter(s => s.status === 'pending');
            setQueuedSegments(queued);

            // Apply client-side filters
            if (filters.airport !== 'all') {
                allSegments = allSegments.filter(s => s.airport === filters.airport);
            }

            if (filters.hasLabel === 'yes') {
                allSegments = allSegments.filter(s => s.label_count > 0);
            } else if (filters.hasLabel === 'no') {
                allSegments = allSegments.filter(s => s.label_count === 0);
            }

            if (filters.confidence === 'high') {
                allSegments = allSegments.filter(s => s.transcription_confidence >= 0.85);
            } else if (filters.confidence === 'medium') {
                allSegments = allSegments.filter(s => s.transcription_confidence >= 0.70 && s.transcription_confidence < 0.85);
            } else if (filters.confidence === 'low') {
                allSegments = allSegments.filter(s => s.transcription_confidence !== null && s.transcription_confidence < 0.70);
            } else if (filters.confidence === 'unanalyzed') {
                allSegments = allSegments.filter(s => s.transcription_confidence === null);
            }

            if (filters.queue === 'queued') {
                allSegments = allSegments.filter(s => s.status === 'pending');
            }

            // Classification filter
            if (filters.classification === 'unanalyzed') {
                // Unanalyzed = truly untouched clips (never run through analysis)
                allSegments = allSegments.filter(s => s.transcription_confidence === null);
            } else if (filters.classification === 'unlabeled') {
                // Unlabeled = analyzed but no human labels (variants are okay)
                allSegments = allSegments.filter(s =>
                    s.transcription_confidence !== null &&
                    s.label_count === 0
                );
            } else if (filters.classification === 'labeled') {
                // Labeled = has human labels (SFT ready)
                allSegments = allSegments.filter(s => s.label_count > 0);
            } else if (filters.classification === 'rlhf') {
                // RLHF = has variants generated (rlhf_candidate is set when variants are created)
                allSegments = allSegments.filter(s => s.rlhf_candidate === true);
            }

            setSegments(allSegments);
        } catch (error) {
            console.error('Error fetching segments:', error);
            setSegments([]);
        } finally {
            setLoading(false);
        }
    }

    async function toggleQueue(segmentId, currentStatus) {
        try {
            const inQueue = currentStatus !== 'pending';
            const response = await fetch(`/api/segments/${segmentId}/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inQueue })
            });

            if (!response.ok) {
                throw new Error('Failed to toggle queue status');
            }

            await fetchSegments();
        } catch (error) {
            console.error('Error toggling queue status:', error);
            alert('Failed to update queue status');
        }
    }

    async function runAnalysis() {
        if (queuedSegments.length === 0) {
            alert('No segments queued for analysis. Add segments to the queue first.');
            return;
        }

        if (!confirm(`Run analysis on ${queuedSegments.length} segment(s)? This will take approximately ${queuedSegments.length * 30} seconds.`)) {
            return;
        }

        setAnalyzing(true);
        let processedCount = 0;
        let errorCount = 0;
        const successfulSegmentIds = [];

        try {
            for (const segment of queuedSegments) {
                try {
                    console.log(`Processing segment ${segment.id}...`);
                    const response = await fetch('/api/process-audio', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ segmentId: segment.id })
                    });

                    if (response.ok) {
                        processedCount++;
                        successfulSegmentIds.push(segment.id);
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error processing segment ${segment.id}:`, error);
                    errorCount++;
                }
            }

            // Update all successfully processed segments to 'active' status
            if (successfulSegmentIds.length > 0) {
                const { error: deactivateError } = await supabase
                    .from('segments')
                    .update({ status: 'active' })
                    .in('id', successfulSegmentIds);

                if (deactivateError) {
                    console.error('Error deactivating segments:', deactivateError);
                }
            }

            await fetchSegments();

            alert(`Analysis complete!\n\nProcessed: ${processedCount} segments\n${errorCount > 0 ? `Errors: ${errorCount} segments` : ''}`);
        } catch (error) {
            console.error('Error running analysis:', error);
            alert(`Failed to run analysis: ${error.message}`);
        } finally {
            setAnalyzing(false);
        }
    }

    // Stats calculations
    const totalSegments = segments.length;
    const labeledCount = segments.filter(s => s.label_count > 0).length;
    const analyzedCount = segments.filter(s => s.transcription_confidence !== null).length;

    if (loading) {
        return <div className={styles.loading}>Loading segments...</div>;
    }

    return (
        <div className={styles.container}>
            {/* Analysis Queue Bar */}
            <div className={styles.queueBar}>
                <div className={styles.queueInfo}>
                    <span className={styles.queueCount}>
                        <strong>{queuedSegments.length}</strong> segment{queuedSegments.length !== 1 ? 's' : ''} queued for analysis
                    </span>
                    {queuedSegments.length > 0 && (
                        <button
                            onClick={() => setShowQueue(!showQueue)}
                            className={styles.queueToggle}
                        >
                            {showQueue ? 'Hide Queue' : 'View Queue'}
                        </button>
                    )}
                </div>
                <button
                    onClick={runAnalysis}
                    disabled={analyzing || queuedSegments.length === 0}
                    className={styles.runAnalysisButton}
                >
                    {analyzing ? 'Running Analysis...' : 'Run Analysis'}
                </button>
            </div>

            {/* Queue Preview */}
            {showQueue && queuedSegments.length > 0 && (
                <div className={styles.queuePreview}>
                    <h4>Queued Segments</h4>
                    <div className={styles.queueList}>
                        {queuedSegments.slice(0, 10).map(seg => (
                            <div key={seg.id} className={styles.queueItem}>
                                <span>{seg.airport} - {seg.facility}</span>
                                <span>{seg.duration_seconds?.toFixed(1)}s</span>
                                <button
                                    onClick={() => toggleQueue(seg.id, seg.status)}
                                    className={styles.removeFromQueue}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        {queuedSegments.length > 10 && (
                            <div className={styles.queueMore}>+ {queuedSegments.length - 10} more</div>
                        )}
                    </div>
                </div>
            )}

            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{totalSegments}</span>
                    <span className={styles.statLabel}>Total</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{labeledCount}</span>
                    <span className={styles.statLabel}>Labeled</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{analyzedCount}</span>
                    <span className={styles.statLabel}>Analyzed</span>
                </div>
            </div>

            {/* Filters */}
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
                    <label>Confidence</label>
                    <select
                        value={filters.confidence}
                        onChange={(e) => setFilters({ ...filters, confidence: e.target.value })}
                    >
                        <option value="all">All</option>
                        <option value="high">High (≥85%)</option>
                        <option value="medium">Medium (70-84%)</option>
                        <option value="low">Low (&lt;70%)</option>
                        <option value="unanalyzed">Not Analyzed</option>
                    </select>
                </div>

                <div className={styles.filterGroup}>
                    <label>Classification</label>
                    <select
                        value={filters.classification}
                        onChange={(e) => setFilters({ ...filters, classification: e.target.value })}
                    >
                        <option value="all">All</option>
                        <option value="unanalyzed">Unanalyzed</option>
                        <option value="unlabeled">Unlabeled</option>
                        <option value="labeled">Labeled (SFT)</option>
                        <option value="rlhf">RLHF (Has Variants)</option>
                    </select>
                </div>

                <div className={styles.filterGroup}>
                    <label>Queue</label>
                    <select
                        value={filters.queue}
                        onChange={(e) => setFilters({ ...filters, queue: e.target.value })}
                    >
                        <option value="all">All</option>
                        <option value="queued">Queued Only</option>
                    </select>
                </div>

                <button className={styles.refreshButton} onClick={fetchSegments}>
                    Refresh
                </button>
            </div>

            {/* Content */}
            {segments.length === 0 ? (
                <div className={styles.empty}>
                    <p>No segments found</p>
                    <span>Try adjusting your filters or upload new audio</span>
                </div>
            ) : (
                <div className={styles.content}>
                    <div className={styles.segmentList}>
                        <div className={styles.listHeader}>
                            <h4>{segments.length} Segments</h4>
                        </div>
                        <div className={styles.segmentListScroll}>
                            {segments.map((segment) => (
                                <SegmentCard
                                    key={segment.id}
                                    segment={segment}
                                    selected={selectedSegment?.id === segment.id}
                                    onClick={() => setSelectedSegment(segment)}
                                    onToggleQueue={() => toggleQueue(segment.id, segment.status)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className={styles.detailsPanel}>
                        {selectedSegment ? (
                            <SegmentDetails
                                segment={selectedSegment}
                                onClose={() => setSelectedSegment(null)}
                                onRefresh={fetchSegments}
                                onToggleQueue={() => toggleQueue(selectedSegment.id, selectedSegment.status)}
                            />
                        ) : (
                            <div className={styles.noSelection}>
                                <p>Select a segment to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function SegmentCard({ segment, selected, onClick, onToggleQueue }) {
    const hasLabels = segment.label_count > 0;
    const confidence = segment.transcription_confidence;
    const isAnalyzed = confidence !== null;
    const isQueued = segment.status === 'pending';

    return (
        <div
            className={`${styles.segmentCard} ${selected ? styles.selected : ''} ${hasLabels ? styles.labeled : ''} ${isQueued ? styles.queued : ''}`}
            onClick={onClick}
        >
            <div className={styles.cardHeader}>
                <div className={styles.cardInfo}>
                    <span className={styles.airport}>{segment.airport} - {segment.facility}</span>
                    <span className={styles.date}>{new Date(segment.recorded_at).toLocaleString()}</span>
                </div>
                <div className={styles.badges}>
                    {isQueued && (
                        <span className={styles.queuedBadge}>Queued</span>
                    )}
                    {hasLabels && (
                        <span className={styles.labelBadge}>
                            {segment.label_count} label{segment.label_count > 1 ? 's' : ''}
                        </span>
                    )}
                    {isAnalyzed && (
                        <span className={`${styles.confidenceBadge} ${getConfidenceClass(confidence)}`}>
                            {(confidence * 100).toFixed(0)}%
                        </span>
                    )}
                </div>
            </div>

            {segment.transcription_text && (
                <div className={styles.transcriptionPreview}>
                    {segment.transcription_text.substring(0, 100)}...
                </div>
            )}

            <div className={styles.cardFooter}>
                <span className={styles.duration}>{segment.duration_seconds?.toFixed(1)}s</span>
                {!isAnalyzed && <span className={styles.notAnalyzed}>Not analyzed</span>}
                {isAnalyzed && <span className={styles.analyzedBadge}>Analyzed</span>}
                {/* Only show queue button for non-analyzed segments */}
                {!isAnalyzed && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleQueue();
                        }}
                        className={isQueued ? styles.removeQueueBtn : styles.addQueueBtn}
                    >
                        {isQueued ? '− Remove' : '+ Queue'}
                    </button>
                )}
            </div>
        </div>
    );
}

function getConfidenceClass(confidence) {
    if (confidence >= 0.85) return styles.highConfidence;
    if (confidence >= 0.70) return styles.mediumConfidence;
    return styles.lowConfidence;
}

function SegmentDetails({ segment, onClose, onRefresh, onToggleQueue }) {
    const [audioUrl, setAudioUrl] = useState(null);
    const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
    const [loadingAudio, setLoadingAudio] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const audioRef = useRef(null);

    // Labeling state
    const [isLabeling, setIsLabeling] = useState(false);
    const [manualTranscription, setManualTranscription] = useState('');
    const [contextNotes, setContextNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Variant generation state
    const [generatingVariants, setGeneratingVariants] = useState(false);
    const [existingVariants, setExistingVariants] = useState(null);

    // Trim state
    const [showTrimmer, setShowTrimmer] = useState(false);
    const [removeRegions, setRemoveRegions] = useState([]);

    // Word confidence state
    const [wordConfidences, setWordConfidences] = useState([]);

    const isQueued = segment.status === 'pending';
    const isAnalyzed = segment.transcription_confidence !== null;

    useEffect(() => {
        if (segment?.id) {
            fetchAudioUrl();
            fetchModelOutputs();
            setManualTranscription(segment.transcription_text || '');
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
                setExistingVariants(data[0]);
                if (data[0].variations && data[0].variations.length > 0) {
                    const primaryWords = data[0].variations[0].words || [];
                    setWordConfidences(primaryWords);
                }
            } else {
                setExistingVariants(null);
                setWordConfidences([]);
            }
        } catch (error) {
            console.error('Error fetching model outputs:', error);
        }
    }

    function getWordConfidence(index) {
        if (!wordConfidences || wordConfidences.length === 0) return null;
        if (wordConfidences[index]) {
            return wordConfidences[index].confidence;
        }
        return null;
    }

    function getConfidenceColor(confidence) {
        if (confidence === null) return '#fff';
        if (confidence >= 0.90) return '#d4edda';
        if (confidence >= 0.70) return '#fff3cd';
        return '#f8d7da';
    }

    async function handleSaveLabel() {
        if (!manualTranscription.trim()) {
            alert('Please provide a transcription.');
            return;
        }

        setSaving(true);
        try {
            if (removeRegions && removeRegions.length > 0) {
                const validRegions = removeRegions.filter(r => r && typeof r.start === 'number' && typeof r.end === 'number');
                if (validRegions.length > 0) {
                    const trimRes = await fetch(`/api/segments/${segment.id}/trim`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            removeRegions: validRegions,
                            previewOnly: false
                        })
                    });

                    if (!trimRes.ok) {
                        const errorData = await trimRes.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Trim failed');
                    }
                }
            }

            const response = await fetch(`/api/segments/${segment.id}/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewed: true,
                    approved: true,
                    manualTranscription: manualTranscription.trim(),
                    contextNotes: contextNotes.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save label');
            }

            alert('Label saved successfully!');
            setIsLabeling(false);
            setRemoveRegions([]);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error saving label:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleGenerateVariants() {
        setGeneratingVariants(true);
        try {
            const response = await fetch('/api/process-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ segmentId: segment.id })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to generate variants');
            }

            alert(`Generated ${result.variations?.length || 0} variants! You can now view them in the Variant Test.`);
            await fetchModelOutputs();
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error generating variants:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setGeneratingVariants(false);
        }
    }

    async function handleDownloadAudio() {
        try {
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
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
                {/* Queue Toggle - Only show for non-analyzed segments */}
                {!isAnalyzed && (
                    <section className={styles.queueSection}>
                        <button
                            onClick={onToggleQueue}
                            className={isQueued ? styles.removeQueueBtnLarge : styles.addQueueBtnLarge}
                        >
                            {isQueued ? '− Remove from Analysis Queue' : '+ Add to Analysis Queue'}
                        </button>
                    </section>
                )}

                {/* Analyzed indicator */}
                {isAnalyzed && (
                    <section className={styles.analyzedSection}>
                        <span className={styles.analyzedIndicator}>This segment has been analyzed</span>
                    </section>
                )}

                {/* Status Overview */}
                <section className={styles.statusSection}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Labels:</span>
                        <span className={segment.label_count > 0 ? styles.statusYes : styles.statusNo}>
                            {segment.label_count > 0 ? `${segment.label_count} label(s)` : 'None'}
                        </span>
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Confidence:</span>
                        {segment.transcription_confidence !== null ? (
                            <span className={`${styles.confidenceValue} ${getConfidenceClass(segment.transcription_confidence)}`}>
                                {(segment.transcription_confidence * 100).toFixed(1)}%
                            </span>
                        ) : (
                            <span className={styles.statusNo}>Not analyzed</span>
                        )}
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Variants:</span>
                        <span className={existingVariants ? styles.statusYes : styles.statusNo}>
                            {existingVariants ? `${existingVariants.variations?.length || 0} variant(s)` : 'None'}
                        </span>
                    </div>
                </section>

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

                            <div className={styles.audioControls}>
                                <button onClick={handleDownloadAudio} className={styles.downloadButton}>
                                    ⬇ Download
                                </button>
                                <div className={styles.speedControls}>
                                    <span>Speed:</span>
                                    {[1.0, 0.75, 0.5].map(speed => (
                                        <button
                                            key={speed}
                                            onClick={() => {
                                                setPlaybackSpeed(speed);
                                                if (audioRef.current) {
                                                    audioRef.current.playbackRate = speed;
                                                }
                                            }}
                                            className={playbackSpeed === speed ? styles.speedActive : styles.speedButton}
                                        >
                                            {speed}×
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className={styles.noAudio}>Audio not available</p>
                    )}
                    {segment.duration_seconds && (
                        <span className={styles.duration}>{segment.duration_seconds.toFixed(1)}s</span>
                    )}
                </section>

                {/* Transcription Display */}
                {segment.transcription_text && !isLabeling && (
                    <section>
                        <h5>Transcription</h5>
                        <div className={styles.transcriptionBox}>
                            <div className={styles.wordDisplay}>
                                {segment.transcription_text.split(/\s+/).map((word, index) => {
                                    const confidence = getWordConfidence(index);
                                    const confidenceClass = confidence !== null ?
                                        (confidence < 0.7 ? styles.lowConfWord :
                                            confidence < 0.9 ? styles.medConfWord : '') : '';
                                    return (
                                        <span
                                            key={index}
                                            className={`${styles.word} ${confidenceClass}`}
                                            title={confidence !== null ? `Confidence: ${(confidence * 100).toFixed(1)}%` : word}
                                        >
                                            {word}
                                        </span>
                                    );
                                })}
                            </div>
                            {segment.transcription_confidence && (
                                <div className={styles.overallConfidence}>
                                    <span className="data-label">Net Confidence:</span>
                                    <span className={styles.monoValue}> {(segment.transcription_confidence * 100).toFixed(1)}%</span>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Existing Variants */}
                {existingVariants && existingVariants.variations && !isLabeling && (
                    <section>
                        <h5>Generated Variants ({existingVariants.variations.length})</h5>
                        <div className={styles.variantsContainer}>
                            {existingVariants.variations.map((variation, index) => (
                                <div key={index} className={styles.variantCard}>
                                    <div className={styles.variantHeader}>
                                        <span className={styles.variantModel}>{variation.model}</span>
                                        <span className={styles.variantConfidence}>
                                            {(variation.confidence * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className={styles.variantText}>{variation.text}</div>
                                </div>
                            ))}
                        </div>
                        <a href="/rank-outputs" className={styles.variantTestLink}>
                            → Go to Variant Test to rank these
                        </a>
                    </section>
                )}

                {/* Action Buttons */}
                {!isLabeling && (
                    <section className={styles.actionSection}>
                        <div className={styles.actionButtons}>
                            <button
                                onClick={() => setIsLabeling(true)}
                                className={styles.primaryButton}
                            >
                                Add Label
                            </button>
                            <button
                                onClick={handleGenerateVariants}
                                disabled={generatingVariants}
                                className={styles.secondaryButton}
                            >
                                {generatingVariants ? 'Generating...' : 'Generate Variants'}
                            </button>
                        </div>
                    </section>
                )}

                {/* Labeling Form */}
                {isLabeling && (
                    <section className={styles.labelingSection}>
                        <h5>Add Label</h5>

                        {audioUrl && (
                            <div className={styles.trimmerSection}>
                                <button
                                    onClick={() => setShowTrimmer(!showTrimmer)}
                                    className={styles.trimToggle}
                                >
                                    {showTrimmer ? '✕ Hide Trimmer' : 'Trim Audio'}
                                </button>
                                {showTrimmer && (
                                    <AudioTrimmer
                                        audioUrl={originalAudioUrl}
                                        duration={segment.duration_seconds || 0}
                                        segment={segment}
                                        onTrimSave={(regions) => {
                                            setRemoveRegions(regions);
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        <div className={styles.inputGroup}>
                            <label>
                                Transcription <span className={styles.required}>*</span>
                            </label>
                            <textarea
                                value={manualTranscription}
                                onChange={(e) => setManualTranscription(e.target.value)}
                                placeholder="Type or paste the correct transcription here. Use [UNKNOWN] for unclear portions."
                                className={styles.transcriptionInput}
                            />
                            <p className={styles.inputHelp}>Use [UNKNOWN] for unclear words</p>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Context Notes (Optional)</label>
                            <textarea
                                value={contextNotes}
                                onChange={(e) => setContextNotes(e.target.value)}
                                placeholder="Add context (e.g., 'emergency situation', 'multiple speakers')..."
                                className={styles.contextInput}
                            />
                        </div>

                        <div className={styles.labelingActions}>
                            <button
                                onClick={handleSaveLabel}
                                disabled={saving || !manualTranscription.trim()}
                                className={styles.saveButton}
                            >
                                {saving ? 'Saving...' : 'Save Label'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsLabeling(false);
                                    setManualTranscription(segment.transcription_text || '');
                                    setContextNotes('');
                                    setRemoveRegions([]);
                                    setShowTrimmer(false);
                                }}
                                disabled={saving}
                                className={styles.cancelButton}
                            >
                                Cancel
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
