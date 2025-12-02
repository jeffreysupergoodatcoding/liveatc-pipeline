'use client';

import { useState } from 'react';
import styles from './AudioUpload.module.css';

export default function AudioUpload() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isAudioFile(droppedFile)) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a valid audio file (MP3, WAV, M4A, FLAC)');
    }
  }

  function handleFileInput(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile && isAudioFile(selectedFile)) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please upload a valid audio file (MP3, WAV, M4A, FLAC)');
    }
  }

  function isAudioFile(file) {
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/flac'];
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.flac'];

    return audioTypes.includes(file.type) ||
           audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  async function analyzeAudio() {
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch('/api/segments/detect', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Upload & Analyze Audio</h3>
        <p className={styles.subtitle}>
          Upload aviation radio communication audio to detect edge cases in real-time
        </p>
      </div>

      {!file ? (
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <div className={styles.dropzoneContent}>
            <h4>Drag & Drop Audio File</h4>
            <p>or click to browse</p>
            <span className={styles.supportedFormats}>Supports MP3, WAV, M4A, FLAC</span>
          </div>
          <input
            id="fileInput"
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.flac"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className={styles.fileInfo}>
          <div className={styles.fileCard}>
            <div className={styles.fileDetails}>
              <h5>{file.name}</h5>
              <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button onClick={reset} className={styles.removeButton}>×</button>
          </div>

          {!result && !analyzing && (
            <button onClick={analyzeAudio} className={styles.analyzeButton}>
              Analyze Audio
            </button>
          )}
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {analyzing && (
        <div className={styles.analyzing}>
          <div className={styles.spinner}></div>
          <p>Analyzing audio...</p>
          <span>This may take 30-60 seconds</span>
        </div>
      )}

      {result && (
        <AnalysisResult result={result} onReset={reset} />
      )}
    </div>
  );
}

function AnalysisResult({ result, onReset }) {
  const severity = getSeverityLevel(result.edgeCaseScore);

  return (
    <div className={styles.result}>
      <div className={styles.resultHeader}>
        <h4>Analysis Complete</h4>
        <button onClick={onReset} className={styles.analyzeAnotherButton}>
          Analyze Another
        </button>
      </div>

      {/* Overall Score */}
      <div className={styles.scoreSection}>
        <h5>Edge Case Score</h5>
        <div className={styles.scoreDisplay}>
          <div className={styles.scoreCircle} data-severity={severity}>
            <span className={styles.scoreValue}>
              {(result.edgeCaseScore * 100).toFixed(0)}
            </span>
            <span className={styles.scoreLabel}>/ 100</span>
          </div>
          <div className={styles.scoreInfo}>
            <div className={styles.severityBadge} data-severity={severity}>
              {severity.toUpperCase()}
            </div>
            {result.flagged && (
              <div className={styles.flaggedBadge}>Flagged for Review</div>
            )}
          </div>
        </div>
      </div>

      {/* Transcription */}
      {result.transcription && (
        <div className={styles.section}>
          <h5>Transcription</h5>
          <div className={styles.transcriptionBox}>
            <p>{result.transcription.text}</p>
            {result.transcription.confidence && (
              <div className={styles.confidence}>
                Confidence: {(result.transcription.confidence * 100).toFixed(1)}%
                {result.transcription.speaker_count > 1 && (
                  <span> • {result.transcription.speaker_count} speakers detected</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detected Edge Cases */}
      {result.detectedEdgeCases && result.detectedEdgeCases.length > 0 && (
        <div className={styles.section}>
          <h5>Detected Edge Cases ({result.detectedEdgeCases.length})</h5>
          <div className={styles.edgeCases}>
            {result.detectedEdgeCases.map((edgeCase, i) => (
              <div key={i} className={styles.edgeCase}>
                <div className={styles.edgeCaseHeader}>
                  <span className={styles.edgeCaseName}>{edgeCase.name}</span>
                  <span
                    className={styles.edgeCaseSeverity}
                    data-severity={getSeverityLevel(edgeCase.severity)}
                  >
                    {(edgeCase.severity * 100).toFixed(0)}
                  </span>
                </div>
                <div className={styles.edgeCaseCategory}>
                  {formatCategory(edgeCase.category)}
                </div>
                <div className={styles.edgeCaseMeta}>
                  <span>Match: {edgeCase.match_type}</span>
                  <span>Confidence: {(edgeCase.confidence * 100).toFixed(0)}%</span>
                </div>
                {edgeCase.evidence && (
                  <details className={styles.evidence}>
                    <summary>View Evidence</summary>
                    <pre>{JSON.stringify(edgeCase.evidence, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio Analysis */}
      {result.audioAnalysis && (
        <div className={styles.section}>
          <h5>Audio Analysis</h5>
          <div className={styles.audioStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Duration</span>
              <span className={styles.statValue}>
                {result.audioAnalysis.duration?.toFixed(1)}s
              </span>
            </div>
            {result.audioAnalysis.volume && (
              <>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Mean Volume</span>
                  <span className={styles.statValue}>
                    {result.audioAnalysis.volume.mean_volume?.toFixed(1)} dB
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Max Volume</span>
                  <span className={styles.statValue}>
                    {result.audioAnalysis.volume.max_volume?.toFixed(1)} dB
                  </span>
                </div>
              </>
            )}
            {result.audioAnalysis.speechDensity !== undefined && (
              <div className={styles.stat}>
                <span className={styles.statLabel}>Speech Density</span>
                <span className={styles.statValue}>
                  {(result.audioAnalysis.speechDensity * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {result.detectedEdgeCases?.length === 0 && (
        <div className={styles.noIssues}>
          <h5>No Edge Cases Detected</h5>
          <p>The audio appears to contain standard aviation communications</p>
        </div>
      )}
    </div>
  );
}

function formatCategory(category) {
  return category.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getSeverityLevel(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.70) return 'high';
  if (score >= 0.50) return 'medium';
  return 'low';
}
