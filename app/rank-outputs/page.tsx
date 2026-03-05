'use client';

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import styles from './page.module.css';

interface ScoreSet {
    accuracy: number;
    completeness: number;
    clarity: number;
}

interface Word {
    word: string;
    confidence: number;
    start: number;
    end: number;
}

interface Variation {
    text: string;
    confidence: number;
    rank_position: number;
    words?: Word[]; // Optional word-level confidence
}

interface SegmentData {
    modelOutputId: string;
    segmentId: string;
    airport: string;
    facility: string;
    duration: number;
    audioUrl: string | null;
    audioError?: string;
    variations: Variation[];
    originalTranscription: string;
}

interface Stats {
    rankedToday: number;
    totalRanked: number;
    avgMinutes: number;
}

const METRIC_DESCRIPTIONS = {
    accuracy: 'Callsigns, numbers, and critical aviation terms are correct',
    completeness: 'All information from the audio is included',
    clarity: 'Understandable without ambiguity or confusion'
};

function WordWithTooltip({ word, confidence }: { word: string; confidence: number }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const conf = confidence * 100;
    let colorClass = styles.wordLow;
    if (conf >= 90) colorClass = styles.wordHigh;
    else if (conf >= 70) colorClass = styles.wordMedium;

    return (
        <span
            className={styles.wordWrapper}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className={`${styles.word} ${colorClass}`}>
                {word}
            </span>
            {showTooltip && (
                <span className={styles.tooltip}>
                    {word}: {conf.toFixed(1)}%
                </span>
            )}
        </span>
    );
}

function StarRating({ value, onChange, disabled = false }: { value: number; onChange: (val: number) => void; disabled?: boolean }) {
    return (
        <div className={styles.starRating}>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => !disabled && onChange(star)}
                    disabled={disabled}
                    className={`${styles.star} ${star <= value ? styles.filled : ''}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

function RankingSelect({ value, onChange, disabled = false }: { value: number; onChange: (val: number) => void; disabled?: boolean }) {
    return (
        <div className={styles.rankingSelect}>
            <label className={styles.rankingLabel}>Overall Rank:</label>
            <div className={styles.rankingButtons}>
                {[1, 2, 3].map((rank) => (
                    <button
                        key={rank}
                        type="button"
                        onClick={() => !disabled && onChange(rank)}
                        disabled={disabled}
                        className={`${styles.rankButton} ${value === rank ? styles.rankButtonActive : ''}`}
                    >
                        {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
                    </button>
                ))}
            </div>
        </div>
    );
}

function OutputCard({
    variation,
    index,
    scores,
    ranking,
    notes,
    onScoreChange,
    onRankingChange,
    onNotesChange,
    disabled
}: {
    variation: Variation;
    index: number;
    scores: ScoreSet;
    ranking: number;
    notes: string;
    onScoreChange: (metric: keyof ScoreSet, value: number) => void;
    onRankingChange: (rank: number) => void;
    onNotesChange: (notes: string) => void;
    disabled: boolean;
}) {
    const avgScore = ((scores.accuracy + scores.completeness + scores.clarity) / 3).toFixed(1);

    return (
        <div className={styles.outputCard}>
            <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                    <h3 className={styles.outputTitle}>Output {index + 1}</h3>
                </div>
                <div className={styles.cardHeaderRight}>
                    <div className={styles.confidenceLabel}>Deepgram Confidence</div>
                    <div className={styles.confidenceValue}>
                        {(variation.confidence * 100).toFixed(1)}%
                    </div>
                    <div className={styles.avgScore}>Avg Score: {avgScore}/5</div>
                </div>
            </div>

            <div className={styles.transcriptionBox}>
                {variation.words && variation.words.length > 0 ? (
                    <>
                        <div className={styles.confidenceInfo}>
                            <span className={styles.overallConfidence}>
                                Overall: {(variation.confidence * 100).toFixed(1)}%
                            </span>
                            <span className={styles.confidenceLegend}>
                                <span className={styles.legendItem}>
                                    <span className={styles.legendDot} style={{ backgroundColor: '#22c55e' }}></span>
                                    High (&gt;90%)
                                </span>
                                <span className={styles.legendItem}>
                                    <span className={styles.legendDot} style={{ backgroundColor: '#eab308' }}></span>
                                    Medium (70-90%)
                                </span>
                                <span className={styles.legendItem}>
                                    <span className={styles.legendDot} style={{ backgroundColor: '#ef4444' }}></span>
                                    Low (&lt;70%)
                                </span>
                            </span>
                        </div>
                        <div className={styles.wordLevelTranscription}>
                            {variation.words.map((wordData, idx) => (
                                <WordWithTooltip
                                    key={idx}
                                    word={wordData.word}
                                    confidence={wordData.confidence}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <p className={styles.transcriptionText}>{variation.text}</p>
                        <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                            No word-level data available
                        </p>
                    </>
                )}
            </div>

            <div className={styles.metricsGrid}>
                {(Object.keys(METRIC_DESCRIPTIONS) as Array<keyof ScoreSet>).map((metric) => (
                    <div key={metric} className={styles.metricRow}>
                        <div className={styles.metricHeader}>
                            <div className={styles.metricInfo}>
                                <div className={styles.metricName}>{metric}</div>
                                <div className={styles.metricDescription}>{METRIC_DESCRIPTIONS[metric]}</div>
                            </div>
                            <StarRating
                                value={scores[metric]}
                                onChange={(val) => onScoreChange(metric, val)}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.notesSection}>
                <label className={styles.notesLabel}>Notes for this output:</label>
                <textarea
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Specific issues with this variation..."
                    className={styles.outputNotesTextarea}
                    disabled={disabled}
                />
            </div>

            <div className={styles.rankingSection}>
                <RankingSelect
                    value={ranking}
                    onChange={onRankingChange}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}

export default function RankOutputsPage() {
    const [segmentData, setSegmentData] = useState<SegmentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [scores, setScores] = useState<{ output1: ScoreSet; output2: ScoreSet; output3: ScoreSet }>({
        output1: { accuracy: 0, completeness: 0, clarity: 0 },
        output2: { accuracy: 0, completeness: 0, clarity: 0 },
        output3: { accuracy: 0, completeness: 0, clarity: 0 }
    });

    const [rankings, setRankings] = useState<{ output1: number; output2: number; output3: number }>({
        output1: 0,
        output2: 0,
        output3: 0
    });

    const [outputNotes, setOutputNotes] = useState<{ output1: string; output2: string; output3: string }>({
        output1: '',
        output2: '',
        output3: ''
    });

    const [generalNotes, setGeneralNotes] = useState('');

    const audioRef = useRef<HTMLAudioElement>(null);

    // Load segment data
    const loadNextSegment = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/rank-outputs/next');
            const result = await response.json();

            if (result.success && result.data) {
                setSegmentData(result.data);

                // Debug: Log word-level data
                console.log('Loaded segment data:', result.data);
                console.log('Variations:', result.data.variations);
                result.data.variations.forEach((v: any, i: number) => {
                    console.log(`Variation ${i + 1} (${v.model}):`, {
                        hasWords: !!v.words,
                        wordsIsArray: Array.isArray(v.words),
                        wordCount: v.words?.length || 0,
                        wordsType: typeof v.words,
                        sampleWords: v.words?.slice(0, 3),
                        allKeys: Object.keys(v)
                    });
                });

                // Reset form
                setScores({
                    output1: { accuracy: 0, completeness: 0, clarity: 0 },
                    output2: { accuracy: 0, completeness: 0, clarity: 0 },
                    output3: { accuracy: 0, completeness: 0, clarity: 0 }
                });
                setRankings({
                    output1: 0,
                    output2: 0,
                    output3: 0
                });
                setOutputNotes({
                    output1: '',
                    output2: '',
                    output3: ''
                });
                setGeneralNotes('');

                // Try to restore from localStorage
                const saved = localStorage.getItem(`ranking-${result.data.modelOutputId}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.scores) setScores(parsed.scores);
                    if (parsed.rankings) setRankings(parsed.rankings);
                    if (parsed.outputNotes) setOutputNotes(parsed.outputNotes);
                    if (parsed.generalNotes) setGeneralNotes(parsed.generalNotes);
                    toast.success('Restored draft from auto-save');
                }

                // Auto-play audio with better handling
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.load();
                        audioRef.current.play().catch(err => {
                            console.log('Auto-play blocked, waiting for user interaction');
                        });
                    }
                }, 500);
            } else {
                toast(result.message || 'No segments available for ranking');
                setSegmentData(null);
            }
        } catch (error) {
            console.error('Error loading segment:', error);
            toast.error('Failed to load segment');
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        loadNextSegment();
    }, []);

    // Auto-save to localStorage
    useEffect(() => {
        if (segmentData) {
            const draft = { scores, rankings, outputNotes, generalNotes };
            localStorage.setItem(`ranking-${segmentData.modelOutputId}`, JSON.stringify(draft));
        }
    }, [scores, rankings, outputNotes, generalNotes, segmentData]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (audioRef.current) {
                    if (audioRef.current.paused) {
                        audioRef.current.play();
                    } else {
                        audioRef.current.pause();
                    }
                }
            } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                handleSubmit();
            } else if (e.code === 'KeyN' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                loadNextSegment();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [scores, rankings, outputNotes, generalNotes, segmentData]);

    const handleScoreChange = (outputKey: string, metric: keyof ScoreSet, value: number) => {
        setScores(prev => ({
            ...prev,
            [outputKey]: {
                ...prev[outputKey as keyof typeof prev],
                [metric]: value
            }
        }));
    };

    const handleRankingChange = (outputKey: string, rank: number) => {
        setRankings(prev => ({
            ...prev,
            [outputKey]: rank
        }));
    };

    const handleOutputNotesChange = (outputKey: string, note: string) => {
        setOutputNotes(prev => ({
            ...prev,
            [outputKey]: note
        }));
    };

    const validateForm = (): string | null => {
        // Check all scores are filled
        for (const outputKey of ['output1', 'output2', 'output3'] as const) {
            const outputScores = scores[outputKey];
            if (outputScores.accuracy === 0 || outputScores.completeness === 0 || outputScores.clarity === 0) {
                return `Please rate all metrics for ${outputKey.replace('output', 'Output ')}`;
            }
        }

        // Check all rankings are filled
        for (const outputKey of ['output1', 'output2', 'output3'] as const) {
            if (rankings[outputKey] === 0) {
                return `Please set ranking for ${outputKey.replace('output', 'Output ')}`;
            }
        }

        // Check rankings are unique
        const rankValues = Object.values(rankings);
        const uniqueRanks = new Set(rankValues);
        if (uniqueRanks.size !== 3) {
            return 'Each output must have a unique ranking (1st, 2nd, 3rd)';
        }

        return null;
    };

    const handleSubmit = async () => {
        if (!segmentData) return;

        const validationError = validateForm();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setSubmitting(true);
        try {
            // Convert rankings to overall ranking array
            const overallRanking = ['output1', 'output2', 'output3'].map(output =>
                rankings[output as keyof typeof rankings]
            );

            const response = await fetch('/api/rank-outputs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelOutputId: segmentData.modelOutputId,
                    scores,
                    outputNotes,
                    generalNotes,
                    overallRanking,
                    timeSpentSeconds: 0
                })
            });

            const result = await response.json();

            if (result.success) {
                toast.success('Rankings saved successfully');
                localStorage.removeItem(`ranking-${segmentData.modelOutputId}`);
            } else {
                toast.error(result.error || 'Failed to save rankings');
            }
        } catch (error) {
            console.error('Error submitting:', error);
            toast.error('Failed to submit rankings');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingContent}>
                    <div className={styles.spinner}></div>
                    <p className={styles.loadingText}>Loading segment...</p>
                </div>
            </div>
        );
    }

    if (!segmentData) {
        return (
            <div className={styles.emptyContainer}>
                <div className={styles.emptyCard}>
                    <h2 className={styles.emptyTitle}>All Done</h2>
                    <p className={styles.emptyMessage}>No segments available for ranking right now.</p>
                    <button onClick={loadNextSegment} className={styles.checkAgainButton}>
                        Check Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Toaster position="top-right" />

            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <a href="/admin/liveatc" style={{ textDecoration: 'none', color: '#666', fontSize: '1.25rem' }}>
                            ← Back to Admin
                        </a>
                        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>VARIANT QUALITY AUDIT</h1>
                    </div>
                </div>

                {/* Segment Info */}
                <div className={styles.segmentInfo}>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <div className={styles.infoLabel}>Airport</div>
                            <div className={styles.infoValue}>{segmentData.airport}</div>
                        </div>
                        <div className={styles.infoItem}>
                            <div className={styles.infoLabel}>Facility</div>
                            <div className={styles.infoValue}>{segmentData.facility}</div>
                        </div>
                        <div className={styles.infoItem}>
                            <div className={styles.infoLabel}>Duration</div>
                            <div className={styles.infoValue}>{segmentData.duration.toFixed(1)}s</div>
                        </div>
                        <div className={styles.infoItem}>
                            <div className={styles.infoLabel}>Segment ID</div>
                            <div className={styles.infoValue}>{segmentData.segmentId.slice(0, 8)}...</div>
                        </div>
                    </div>

                    {/* Audio Player */}
                    <div className={styles.audioPlayer}>
                        {segmentData.audioUrl ? (
                            <>
                                <audio
                                    ref={audioRef}
                                    src={segmentData.audioUrl}
                                    key={segmentData.audioUrl}
                                    controls
                                    autoPlay
                                    preload="auto"
                                    onError={(e) => {
                                        console.error('Audio playback error:', e);
                                        console.error('Audio URL:', segmentData.audioUrl);
                                        console.error('Error code:', (e.target as HTMLAudioElement).error?.code);
                                        console.error('Error message:', (e.target as HTMLAudioElement).error?.message);
                                        toast.error('Error playing audio - check console for details');
                                    }}
                                    onLoadedMetadata={() => console.log('Audio metadata loaded successfully')}
                                    onCanPlay={() => console.log('Audio can play')}
                                />
                                <div className={styles.keyboardHint}>
                                    Keyboard: <kbd>Space</kbd> = Play/Pause
                                </div>
                            </>
                        ) : (
                            <div className={styles.audioError}>
                                Error: {segmentData.audioError || 'Audio unavailable'}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                {/* Ranking Section */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Rate and Rank Outputs</h2>

                    <div className={styles.outputsList}>
                        {segmentData.variations.map((variation, index) => {
                            const outputKey = `output${index + 1}` as 'output1' | 'output2' | 'output3';
                            return (
                                <OutputCard
                                    key={outputKey}
                                    variation={variation}
                                    index={index}
                                    scores={scores?.[outputKey] || { accuracy: 0, completeness: 0, clarity: 0 }}
                                    ranking={rankings?.[outputKey] || 0}
                                    notes={outputNotes?.[outputKey] || ''}
                                    onScoreChange={(metric, value) => handleScoreChange(outputKey, metric, value)}
                                    onRankingChange={(rank) => handleRankingChange(outputKey, rank)}
                                    onNotesChange={(note) => handleOutputNotesChange(outputKey, note)}
                                    disabled={submitting}
                                />
                            );
                        })}
                    </div>
                </section>

                {/* General Notes */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>General Notes (Optional)</h2>
                    <textarea
                        value={generalNotes}
                        onChange={(e) => setGeneralNotes(e.target.value)}
                        placeholder="Add any general observations, edge cases, or context about this segment..."
                        className={styles.notesTextarea}
                        disabled={submitting}
                    />
                </section>

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`${styles.button} ${styles.submitButton}`}
                    >
                        {submitting ? 'Saving...' : 'Submit Rankings (S)'}
                    </button>
                    <button
                        onClick={loadNextSegment}
                        disabled={submitting}
                        className={`${styles.button} ${styles.nextButton}`}
                    >
                        Next Segment (N)
                    </button>
                </div>

                {/* Helper Text */}
                <div className={styles.helperBox}>
                    <h3 className={styles.helperTitle}>Quick Guide:</h3>
                    <ul className={styles.helperList}>
                        <li>• Rate each output on all 3 metrics (1-5 stars)</li>
                        <li>• Select overall ranking for each output (1st, 2nd, or 3rd)</li>
                        <li>• Add notes about edge cases or interesting observations</li>
                        <li>• Submit saves your rankings and stays on this page</li>
                        <li>• Click "Next Segment" to manually load the next one</li>
                        <li>• Keyboard shortcuts: Space (play/pause), S (submit), N (next)</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
