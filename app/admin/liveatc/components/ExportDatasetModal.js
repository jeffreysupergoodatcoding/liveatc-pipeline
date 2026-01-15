'use client';

import { useState, useEffect } from 'react';
import styles from './ExportDatasetModal.module.css';

export default function ExportDatasetModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [preview, setPreview] = useState(null);
    const [progress, setProgress] = useState('');

    // Export options
    const [options, setOptions] = useState({
        normalize: true,
        airbandFilter: true,
        augmentation: true,
        augmentationMultiplier: 4, // 1x, 2x, 4x, 8x, 16x
        airbandOptions: {
            lowFreq: 300,
            highFreq: 3000,
            compression: true,
            noiseLevel: 0
        }
    });

    useEffect(() => {
        if (isOpen) {
            fetchPreview();
        }
    }, [isOpen]);

    async function fetchPreview() {
        setLoading(true);
        try {
            const response = await fetch('/api/export-dataset');
            if (response.ok) {
                const data = await response.json();
                setPreview(data);
            }
        } catch (error) {
            console.error('Error fetching preview:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleExport() {
        setExporting(true);
        setProgress('Preparing export...');

        try {
            setProgress('Processing audio files (this may take a few minutes)...');

            const response = await fetch('/api/export-dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || 'Export failed');
            }

            setProgress('Download starting...');

            // Get the blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `atc_training_dataset_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Show success stats from headers
            const totalSamples = response.headers.get('X-Total-Samples');
            const originalSamples = response.headers.get('X-Original-Samples');
            const augmentedSamples = response.headers.get('X-Augmented-Samples');

            setProgress(`Export complete! ${totalSamples} samples (${originalSamples} original + ${augmentedSamples} augmented)`);

            setTimeout(() => {
                onClose();
            }, 3000);

        } catch (error) {
            console.error('Export error:', error);
            setProgress(`Error: ${error.message}`);
        } finally {
            setExporting(false);
        }
    }

    // Calculate estimated output
    const estimatedOutput = preview
        ? options.augmentation
            ? preview.labeledSegments * (1 + options.augmentationMultiplier)
            : preview.labeledSegments
        : 0;

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Export Training Dataset</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    {/* Preview Section */}
                    <section className={styles.section}>
                        <h3>Dataset Preview</h3>
                        {loading ? (
                            <div className={styles.loading}>Loading preview...</div>
                        ) : preview ? (
                            <div className={styles.previewStats}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{preview.labeledSegments}</span>
                                    <span className={styles.statLabel}>Labeled Clips</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{preview.totalDurationMinutes}m</span>
                                    <span className={styles.statLabel}>Total Duration</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{estimatedOutput}</span>
                                    <span className={styles.statLabel}>Output Samples</span>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.error}>Failed to load preview</div>
                        )}
                    </section>

                    {/* Audio Processing Options */}
                    <section className={styles.section}>
                        <h3>Audio Processing</h3>

                        <div className={styles.optionRow}>
                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={options.normalize}
                                    onChange={e => setOptions(prev => ({ ...prev, normalize: e.target.checked }))}
                                />
                                <span className={styles.checkmark}></span>
                                <div className={styles.optionText}>
                                    <strong>Audio Normalization</strong>
                                    <span>Normalize loudness to EBU R128 standard (-16 LUFS)</span>
                                </div>
                            </label>
                        </div>

                        <div className={styles.optionRow}>
                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={options.airbandFilter}
                                    onChange={e => setOptions(prev => ({ ...prev, airbandFilter: e.target.checked }))}
                                />
                                <span className={styles.checkmark}></span>
                                <div className={styles.optionText}>
                                    <strong>Airband Radio Bandpass Filter</strong>
                                    <span>Apply 300-3000Hz bandpass + compression</span>
                                </div>
                            </label>
                        </div>
                    </section>

                    {/* Data Augmentation Options */}
                    <section className={styles.section}>
                        <h3>Data Augmentation</h3>

                        <div className={styles.optionRow}>
                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={options.augmentation}
                                    onChange={e => setOptions(prev => ({ ...prev, augmentation: e.target.checked }))}
                                />
                                <span className={styles.checkmark}></span>
                                <div className={styles.optionText}>
                                    <strong>Enable Data Augmentation</strong>
                                    <span>Create additional samples with tempo, pitch, volume, and noise variations</span>
                                </div>
                            </label>
                        </div>

                        {options.augmentation && (
                            <div className={styles.multiplierSection}>
                                <label className={styles.multiplierLabel}>Dataset Multiplier</label>
                                <p className={styles.multiplierDescription}>
                                    Choose how many augmented copies to create per original clip
                                </p>
                                <div className={styles.multiplierButtons}>
                                    {[1, 2, 4, 8, 16].map(mult => (
                                        <button
                                            key={mult}
                                            className={`${styles.multiplierButton} ${options.augmentationMultiplier === mult ? styles.active : ''}`}
                                            onClick={() => setOptions(prev => ({ ...prev, augmentationMultiplier: mult }))}
                                        >
                                            {mult}x
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.multiplierInfo}>
                                    {preview && (
                                        <>
                                            <span className={styles.calcLabel}>Output:</span>
                                            <span className={styles.calcValue}>
                                                {preview.labeledSegments} × {1 + options.augmentationMultiplier} = <strong>{estimatedOutput}</strong> samples
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Export Progress */}
                    {progress && (
                        <div className={`${styles.progress} ${progress.includes('Error') ? styles.progressError : ''}`}>
                            {progress}
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={onClose} disabled={exporting}>
                        Cancel
                    </button>
                    <button
                        className={styles.primaryButton}
                        onClick={handleExport}
                        disabled={exporting || loading || !preview || preview.labeledSegments === 0}
                    >
                        {exporting ? 'Exporting...' : 'Export Dataset'}
                    </button>
                </div>
            </div>
        </div>
    );
}
