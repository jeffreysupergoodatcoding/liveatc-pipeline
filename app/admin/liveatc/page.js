'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatDate, formatDuration, formatFileSize } from '../../../lib/utils/format';
import RecordingsList from './components/RecordingsList';
import SegmentsList from './components/SegmentsList';
import LabeledClipsList from './components/LabeledClipsList';
import EdgeCasesDashboard from './components/EdgeCasesDashboard';
import styles from './page.module.css';

export default function LiveATCAdmin() {
  const [view, setView] = useState('recordings'); // 'recordings', 'segments', 'labeledClips', 'edgeCases'
  const [selectedRecording, setSelectedRecording] = useState(null);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>LiveATC Admin</h1>
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
            className={`${styles.navButton} ${view === 'labeledClips' ? styles.active : ''}`}
            onClick={() => {
              setView('labeledClips');
              setSelectedRecording(null);
            }}
          >
            Labeled Clips
          </button>
          <button
            className={`${styles.navButton} ${view === 'edgeCases' ? styles.active : ''}`}
            onClick={() => {
              setView('edgeCases');
              setSelectedRecording(null);
            }}
          >
            Confidence Pipeline
          </button>
        </nav>
      </header>

      <main className={styles.main}>
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

        {view === 'labeledClips' && <LabeledClipsList />}

        {view === 'edgeCases' && <EdgeCasesDashboard />}
      </main>
    </div>
  );
}
