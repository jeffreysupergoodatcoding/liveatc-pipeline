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

  const navItems = [
    { id: 'segmentAnalysis', label: 'Segments' },
    { id: 'recordings', label: 'Recordings' },
    { id: 'labeledClips', label: 'Ground Truth' },
    { id: 'upload', label: 'Upload' },
  ];

  return (
    <div className={styles.dashboardLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.navGroup}>
          <span className={styles.navHeader}>OPERATIONS</span>
          <nav className={styles.sideNav}>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`${styles.sideButton} ${view === item.id ? styles.sideActive : ''}`}
                onClick={() => {
                  setView(item.id);
                  setSelectedRecording(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className={styles.navGroup} style={{ marginTop: '24px' }}>
          <span className={styles.navHeader}>RESOURCES</span>
          <nav className={styles.sideNav}>
            <a href="/rank-outputs" className={styles.sideButton}>
              VARIANTS
            </a>
          </nav>
        </div>
      </aside>

      <main className={styles.contentArea}>
        <header className={styles.contentHeader}>
          <div className={styles.breadcrumb}>
            <span>OPERATIONS</span>
            <span className={styles.separator}>/</span>
            <span className={styles.currentView}>{navItems.find(n => n.id === view)?.label || 'DETAILS'}</span>
          </div>
        </header>

        <div className={styles.scrollContainer}>
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
        </div>
      </main>
    </div>
  );
}
