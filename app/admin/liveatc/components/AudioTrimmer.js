'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './AudioTrimmer.module.css';

export default function AudioTrimmer({ audioUrl, duration: providedDuration, segment, onTrimSave }) {
    const audioRef = useRef(null);
    const [duration, setDuration] = useState(providedDuration || 0);
    const [removeRegions, setRemoveRegions] = useState([]); // Regions to remove
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!providedDuration || providedDuration === 0);
    const [errorMessage, setErrorMessage] = useState(null);

    // Load duration from audio element if not provided or 0
    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        const handleMetadata = () => {
            const audioDuration = audio.duration;
            console.log('Loaded audio duration:', audioDuration);
            if (audioDuration && audioDuration > 0) {
                setDuration(audioDuration);
                setLoading(false);
            }
        };

        audio.addEventListener('loadedmetadata', handleMetadata);
        // Don't log errors - they're usually just cleanup noise when unmounting

        // Force load if metadata is already loaded
        if (audio.readyState >= 1) {
            handleMetadata();
        }

        return () => {
            audio.pause();
            audio.src = '';
            audio.removeEventListener('loadedmetadata', handleMetadata);
        };
    }, [audioUrl]);

    // Update when provided duration changes
    useEffect(() => {
        if (providedDuration && providedDuration > 0) {
            setDuration(providedDuration);
            setLoading(false);
        }
    }, [providedDuration]);

    // Reset regions when audio URL changes (e.g. after trim save or new segment)
    useEffect(() => {
        setRemoveRegions([]);
        setErrorMessage(null);
    }, [audioUrl]);

    const playRegion = (region) => {
        const audio = audioRef.current || new Audio(audioUrl);

        // Set to start of region
        if (Number.isFinite(region.start)) {
            audio.currentTime = region.start;
        }

        audio.play().catch(e => console.error("Play error:", e));

        // Stop at end of region
        const checkTime = () => {
            if (audio.currentTime >= region.end) {
                audio.pause();
                audio.removeEventListener('timeupdate', checkTime);
            }
        };

        audio.addEventListener('timeupdate', checkTime);
    };

    const addRemoveRegion = () => {
        setErrorMessage(null);

        if (!duration || duration <= 0) {
            setErrorMessage('Audio duration invalid or not loaded');
            return;
        }

        // Sort existing regions
        const sorted = [...removeRegions].sort((a, b) => a.start - b.start);

        // Try to find the first available gap of at least 0.1s
        let foundGap = false;
        let start = 0;
        let end = 0;
        let currentPos = 0;

        // Scan gaps between regions
        for (const region of sorted) {
            if (region.start - currentPos >= 0.1) {
                // Found a gap before this region
                start = currentPos;
                end = Math.min(start + 5.0, region.start); // Default to 5s or up to next region
                foundGap = true;
                break;
            }
            currentPos = Math.max(currentPos, region.end);
        }

        // If no gap found in between, check after the last region
        if (!foundGap) {
            if (duration - currentPos >= 0.1) {
                start = currentPos;
                end = Math.min(start + 5.0, duration);
                foundGap = true;
            }
        }

        if (foundGap) {
            setRemoveRegions([...removeRegions, { start, end }]);
        } else {
            console.log('No gap found. Duration:', duration, 'Regions:', removeRegions);
            setErrorMessage('No space available to add a new region (audio is fully marked for removal)');
        }
    };

    const removeRegion = (index) => {
        setRemoveRegions(removeRegions.filter((_, i) => i !== index));
        setErrorMessage(null);
    };

    const updateRegionStart = (index, newStart) => {
        setRemoveRegions(prev => {
            const updated = [...prev];
            updated[index].start = Math.max(0, Math.min(newStart, updated[index].end - 0.1));
            return updated;
        });
    };

    const updateRegionEnd = (index, newEnd) => {
        setRemoveRegions(prev => {
            const updated = [...prev];
            updated[index].end = Math.min(duration, Math.max(newEnd, updated[index].start + 0.1));
            return updated;
        });
    };

    const getKeptDuration = () => {
        const removed = removeRegions.reduce((sum, r) => sum + (r.end - r.start), 0);
        return Math.max(0, duration - removed);
    };

    async function handleSaveTrim() {
        setSaving(true);
        setErrorMessage(null);
        try {
            await onTrimSave(removeRegions);
            console.log('Trim saved successfully');
        } catch (error) {
            setErrorMessage(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '16px', background: '#eff6ff', color: '#1e40af', borderRadius: '8px' }}>
                Loading audio duration...
            </div>
        );
    }

    if (!duration || duration === 0) {
        return (
            <div style={{ padding: '16px', background: '#fee', color: 'red', borderRadius: '8px' }}>
                Error: Audio duration is 0 or could not be loaded. Please refresh.
            </div>
        );
    }

    return (
        <div className={styles.trimmer}>
            {errorMessage && (
                <div className={styles.errorBox}>
                    <span>ERR: {errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)}>×</button>
                </div>
            )}

            <div className={styles.header}>
                <h4 className={styles.title}>AUDIO_TRIM_OPERATIONS</h4>
                <button onClick={addRemoveRegion} className={styles.addBtn}>
                    + ADD_REMOVE_REGION
                </button>
            </div>

            {removeRegions.length === 0 ? (
                <div className={styles.emptyState}>
                    NO_REGIONS_MARKED_FOR_REMOVAL. CLICK_ABOVE_TO_START.
                </div>
            ) : (
                removeRegions.map((region, index) => (
                    <div key={index} className={styles.regionCard}>
                        <div className={styles.regionHeader}>
                            <span className={styles.regionLabel}>
                                REMOVE_MODULE_{index + 1}
                            </span>
                            <button onClick={() => removeRegion(index)} className={styles.removeBtn}>
                                [ TERMINATE ]
                            </button>
                        </div>

                        <div className={styles.slider}>
                            <div className={styles.sliderLabel}>
                                <span>START_OFFSET</span>
                                <span>{region.start.toFixed(2)}s</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="0.01"
                                value={region.start}
                                onChange={(e) => updateRegionStart(index, parseFloat(e.target.value))}
                                className={styles.rangeInput}
                            />
                        </div>

                        <div className={styles.slider}>
                            <div className={styles.sliderLabel}>
                                <span>END_OFFSET</span>
                                <span>{region.end.toFixed(2)}s</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="0.01"
                                value={region.end}
                                onChange={(e) => updateRegionEnd(index, parseFloat(e.target.value))}
                                className={styles.rangeInput}
                            />
                        </div>

                        <button onClick={() => playRegion(region)} className={styles.previewBtn}>
                            [ AUDIT_REGION_AUDIO ]
                        </button>
                    </div>
                ))
            )}

            {removeRegions.length > 0 && (
                <>
                    <div className={styles.resultBox}>
                        NET_FLIGHT_DATA: {getKeptDuration().toFixed(2)}s
                        <br />
                        REDACTED: {(duration - getKeptDuration()).toFixed(2)}s
                    </div>

                    <button
                        onClick={handleSaveTrim}
                        disabled={saving}
                        className={styles.saveBtn}
                    >
                        {saving ? 'EXECUTING_REDACTION...' : 'COMMIT_TRIM_CHANGES'}
                    </button>
                </>
            )}
        </div>
    );
}
