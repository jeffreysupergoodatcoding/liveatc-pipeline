'use client';

import { useState } from 'react';
import RecordingsList from './components/RecordingsList';
import SegmentsList from './components/SegmentsList';
import AllSegments from './components/AllSegments';
import LabeledClipsList from './components/LabeledClipsList';
import AudioUpload from './components/AudioUpload';
import styles from './page.module.css';

export default function LiveATCAdmin() {
  const [view, setView] = useState('segmentAnalysis');
  const [selectedRecording, setSelectedRecording] = useState(null);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>LiveATC Training Pipeline</h1>
        <nav className={styles.nav}>
          <button
            className={`${styles.navButton} ${view === 'recordings' ? styles.active : ''}`}
            onClick={() => {
              setView('recordings');
              setSelectedRecording(null);
            }}
          >
            Recordings
          </button>
          <button
            className={`${styles.navButton} ${view === 'upload' ? styles.active : ''}`}
            onClick={() => {
              setView('upload');
              setSelectedRecording(null);
            }}
          >
            Upload
          </button>
          <button
            className={`${styles.navButton} ${view === 'segmentAnalysis' ? styles.active : ''}`}
            onClick={() => {
              setView('segmentAnalysis');
              setSelectedRecording(null);
            }}
          >
            Segment Analysis
          </button>
          <button
            className={`${styles.navButton} ${view === 'labeledClips' ? styles.active : ''}`}
            onClick={() => {
              setView('labeledClips');
              setSelectedRecording(null);
            }}
          >
            Labeled Clips
          </button>
          <a
            href="/rank-outputs"
            className={styles.navButton}
            style={{ textDecoration: 'none' }}
          >
            Variant Test
          </a>
        </nav>
      </header>

      <main className={styles.main}>
        {view === 'segmentAnalysis' && <AllSegments />}

        {view === 'labeledClips' && <LabeledClipsList />}

        {view === 'recordings' && !selectedRecording && (
          <RecordingsList onSelectRecording={(recording) => {
            setSelectedRecording(recording);
            setView('segments');
          }} />
        )}

        {view === 'segments' && selectedRecording && (
          <SegmentsList
            recording={selectedRecording}
            onBack={() => {
              setSelectedRecording(null);
              setView('recordings');
            }}
          />
        )}

        {view === 'upload' && <AudioUpload />}
      </main>
    </div>
  );
}
