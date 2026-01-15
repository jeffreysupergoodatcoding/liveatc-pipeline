'use client';

import { useState, useEffect } from 'react';
import styles from './RecordingSession.module.css';

export default function RecordingSession({ onRecordingComplete }) {
    const [airports, setAirports] = useState([]);
    const [activeRecordings, setActiveRecordings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState('');

    // Recording settings
    const [selectedFeed, setSelectedFeed] = useState('');
    const [duration, setDuration] = useState(300); // 5 minutes default

    // Preset durations (in seconds)
    const durationPresets = [
        { label: '1 min', value: 60 },
        { label: '5 min', value: 300 },
        { label: '10 min', value: 600 },
        { label: '15 min', value: 900 },
        { label: '30 min', value: 1800 },
        { label: '1 hour', value: 3600 }
    ];

    useEffect(() => {
        fetchFeeds();
        // Poll for active recordings
        const interval = setInterval(fetchFeeds, 5000);
        return () => clearInterval(interval);
    }, []);

    async function fetchFeeds() {
        try {
            const response = await fetch('/api/record');
            if (response.ok) {
                const data = await response.json();
                setAirports(data.airports || []);
                setActiveRecordings(data.activeRecordings || []);
            }
        } catch (err) {
            console.error('Error fetching feeds:', err);
        } finally {
            setLoading(false);
        }
    }

    async function startRecording() {
        if (!selectedFeed) {
            setError('Please select a feed');
            return;
        }

        setStarting(true);
        setError('');

        try {
            const response = await fetch('/api/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedId: selectedFeed,
                    duration
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start recording');
            }

            // Refresh to show active recording
            await fetchFeeds();
            setSelectedFeed('');

        } catch (err) {
            setError(err.message);
        } finally {
            setStarting(false);
        }
    }

    async function stopRecording(recordingId) {
        try {
            const response = await fetch(`/api/record?id=${recordingId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchFeeds();
            }
        } catch (err) {
            console.error('Error stopping recording:', err);
        }
    }

    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }

    function formatTimeElapsed(startedAt) {
        const started = new Date(startedAt);
        const now = new Date();
        const elapsed = Math.floor((now - started) / 1000);
        return formatDuration(elapsed);
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading available feeds...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Start Recording</h3>
                <p className={styles.description}>
                    Record live ATC audio from available feeds. Recordings are automatically processed and segmented.
                </p>
            </div>

            {/* Active Recordings */}
            {activeRecordings.length > 0 && (
                <div className={styles.activeRecordings}>
                    <h4>Active Recordings</h4>
                    {activeRecordings.map(recording => (
                        <div key={recording.id} className={styles.activeRecording}>
                            <div className={styles.recordingInfo}>
                                <span className={styles.recordingIndicator}></span>
                                <div>
                                    <strong>{recording.airport}</strong> - {recording.facility}
                                    <span className={styles.recordingMeta}>
                                        {formatTimeElapsed(recording.startedAt)} / {formatDuration(recording.duration)}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.progressContainer}>
                                <div
                                    className={styles.progressBar}
                                    style={{ width: `${recording.progress}%` }}
                                ></div>
                            </div>
                            <button
                                className={styles.stopButton}
                                onClick={() => stopRecording(recording.id)}
                            >
                                Stop
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* New Recording Form */}
            <div className={styles.formSection}>
                <div className={styles.formGroup}>
                    <label>Select Feed</label>
                    <select
                        value={selectedFeed}
                        onChange={(e) => setSelectedFeed(e.target.value)}
                        className={styles.select}
                    >
                        <option value="">Choose an airport feed...</option>
                        {airports.map(airport => (
                            <optgroup key={airport.code} label={airport.code}>
                                {airport.feeds.map(feed => (
                                    <option key={feed.id} value={feed.id}>
                                        {feed.facility.replace(/_/g, ' ').toUpperCase()}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label>Duration</label>
                    <div className={styles.durationButtons}>
                        {durationPresets.map(preset => (
                            <button
                                key={preset.value}
                                className={`${styles.durationButton} ${duration === preset.value ? styles.active : ''}`}
                                onClick={() => setDuration(preset.value)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.customDuration}>
                        <span>Or custom:</span>
                        <input
                            type="number"
                            min="30"
                            max="3600"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value) || 300)}
                            className={styles.durationInput}
                        />
                        <span>seconds</span>
                    </div>
                </div>

                {error && (
                    <div className={styles.error}>{error}</div>
                )}

                <button
                    className={styles.startButton}
                    onClick={startRecording}
                    disabled={starting || !selectedFeed}
                >
                    {starting ? 'Starting...' : 'Start Recording'}
                </button>
            </div>

            {/* Available Airports Summary */}
            <div className={styles.airportsSummary}>
                <h4>Available Airports</h4>
                <div className={styles.airportGrid}>
                    {airports.map(airport => (
                        <div key={airport.code} className={styles.airportCard}>
                            <span className={styles.airportCode}>{airport.code}</span>
                            <span className={styles.feedCount}>{airport.feeds.length} feeds</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
