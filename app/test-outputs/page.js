'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function TestOutputsPage() {
    const [segmentId, setSegmentId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleProcess = async () => {
        if (!segmentId.trim()) {
            setError('Please enter a segment ID');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/process-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ segmentId: segmentId.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process audio');
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence > 0.90) return styles.confidenceHigh;
        if (confidence >= 0.70) return styles.confidenceMedium;
        return styles.confidenceLow;
    };

    const getConfidenceLabel = (confidence) => {
        if (confidence > 0.90) return 'High';
        if (confidence >= 0.70) return 'Medium';
        return 'Low';
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Test Audio Processing</h1>
                <p className={styles.subtitle}>
                    Process segments with Deepgram to get 3 alternative transcriptions
                </p>
            </div>

            <div className={styles.main}>
                {/* Input Section */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Process Segment</h2>
                    <div className={styles.inputGroup}>
                        <label htmlFor="segmentId" className={styles.label}>
                            Segment ID
                        </label>
                        <input
                            id="segmentId"
                            type="text"
                            value={segmentId}
                            onChange={(e) => setSegmentId(e.target.value)}
                            placeholder="Enter segment UUID"
                            className={styles.input}
                            disabled={loading}
                        />
                    </div>
                    <button
                        onClick={handleProcess}
                        disabled={loading}
                        className={styles.button}
                    >
                        {loading ? 'Processing...' : 'Process Audio'}
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className={styles.errorCard}>
                        <h3 className={styles.errorTitle}>Error</h3>
                        <p className={styles.errorMessage}>{error}</p>
                    </div>
                )}

                {/* Results Display */}
                {result && (
                    <div className={styles.resultsSection}>
                        {/* Status Card */}
                        <div className={styles.card}>
                            <h2 className={styles.cardTitle}>Processing Results</h2>

                            <div className={styles.statusGrid}>
                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>Status</span>
                                    <span className={`${styles.badge} ${result.status === 'high_confidence'
                                        ? styles.badgeSuccess
                                        : styles.badgeWarning
                                        }`}>
                                        {result.status === 'high_confidence' ? 'High Confidence' : 'Low Confidence'}
                                    </span>
                                </div>

                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>Confidence Score</span>
                                    <span className={`${styles.confidenceScore} ${getConfidenceColor(result.confidence)}`}>
                                        {(result.confidence * 100).toFixed(2)}%
                                    </span>
                                </div>

                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>Next Step</span>
                                    <span className={styles.nextStep}>
                                        {result.next_step === 'needs_ranking' ? '🎯 Needs Ranking' : '👤 Needs Human Review'}
                                    </span>
                                </div>
                            </div>

                            {result.message && (
                                <p className={styles.message}>{result.message}</p>
                            )}
                        </div>

                        {/* Variations Table */}
                        {result.variations && result.variations.length > 0 && (
                            <div className={styles.card}>
                                <h2 className={styles.cardTitle}>Transcription Variations</h2>
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Rank</th>
                                                <th>Model</th>
                                                <th>Transcription</th>
                                                <th>Confidence</th>
                                                <th>Quality</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.variations.map((variation, index) => (
                                                <tr key={index}>
                                                    <td className={styles.rankCell}>
                                                        <span className={styles.rankBadge}>#{variation.rank_position}</span>
                                                    </td>
                                                    <td className={styles.modelCell}>
                                                        <div className={styles.modelInfo}>
                                                            <span className={styles.modelName}>{variation.model}</span>
                                                            <span className={styles.modelDesc}>{variation.model_description}</span>
                                                        </div>
                                                    </td>
                                                    <td className={styles.textCell}>{variation.text}</td>
                                                    <td className={styles.confidenceCell}>
                                                        {(variation.confidence * 100).toFixed(2)}%
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.qualityBadge} ${getConfidenceColor(variation.confidence)}`}>
                                                            {getConfidenceLabel(variation.confidence)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Low Confidence Transcription */}
                        {result.status === 'low_confidence' && result.transcription && (
                            <div className={styles.card}>
                                <h2 className={styles.cardTitle}>Transcription</h2>
                                <p className={styles.transcriptionText}>{result.transcription}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
