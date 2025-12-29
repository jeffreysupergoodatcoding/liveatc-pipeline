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
                <div style={{
                    padding: '8px 12px',
                    background: '#fee2e2',
                    color: '#991b1b',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    border: '1px solid #fecaca',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>{errorMessage}</span>
                    <button
                        onClick={() => setErrorMessage(null)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: '#991b1b', padding: '0 4px' }}
                    >
                        ×
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Trim Audio</h4>
                <button
                    onClick={addRemoveRegion}
                    style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    + Add Region to Remove
                </button>
            </div>

            {removeRegions.length === 0 ? (
                <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '6px', fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                    Click "Add Region to Remove" to mark parts of audio to cut out
                </div>
            ) : (
                removeRegions.map((region, index) => (
                    <div key={index} style={{ marginBottom: '16px', padding: '12px', background: '#fff5f7', borderRadius: '6px', border: '1px solid #fecaca' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>
                                Remove Region {index + 1}
                            </span>
                            <button
                                onClick={() => removeRegion(index)}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Remove
                            </button>
                        </div>

                        <div className={styles.slider}>
                            <label>Start: {region.start.toFixed(1)}s</label>
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="0.1"
                                value={region.start}
                                onChange={(e) => updateRegionStart(index, parseFloat(e.target.value))}
                            />
                        </div>

                        <div className={styles.slider}>
                            <label>End: {region.end.toFixed(1)}s</label>
                            <input
                                type="range"
                                min="0"
                                max={duration}
                                step="0.1"
                                value={region.end}
                                onChange={(e) => updateRegionEnd(index, parseFloat(e.target.value))}
                            />
                        </div>

                        <button
                            onClick={() => playRegion(region)}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginTop: '8px',
                                width: '100%'
                            }}
                        >
                            Preview This Region
                        </button>

                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            Removing: {(region.end - region.start).toFixed(1)}s
                        </div>
                    </div>
                ))
            )}

            {removeRegions.length > 0 && (
                <>
                    <div style={{ marginTop: '12px', padding: '8px', background: '#f0fdf4', borderRadius: '6px', fontSize: '13px' }}>
                        <strong>Result:</strong> {getKeptDuration().toFixed(1)}s of continuous audio (removed {(duration - getKeptDuration()).toFixed(1)}s)
                    </div>

                    <button
                        onClick={handleSaveTrim}
                        disabled={saving}
                        className={styles.saveBtn}
                        style={{ marginTop: '12px' }}
                    >
                        {saving ? 'Saving...' : 'Save Trim'}
                    </button>
                </>
            )}
        </div>
    );
}
