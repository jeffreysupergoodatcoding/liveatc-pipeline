'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ maxWidth: '800px', margin: '100px auto' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 600, marginBottom: '24px' }}>
        Audio engineering.
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '48px', maxWidth: '600px' }}>
        A system for classifying, labeling, and fine-tuning air traffic control communications. Minimal by design. Focus on the data.
      </p>

      <div style={{ display: 'flex', gap: '24px' }}>
        <Link href="/admin/liveatc">
          <button className="primary" style={{ padding: '12px 32px' }}>Enter System</button>
        </Link>
      </div>

      <div style={{ marginTop: '120px', borderTop: '1px solid var(--border-subtle)', paddingTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collect</h3>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Automated recording from live airport feeds.</span>
        </div>
        <div>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Curate</h3>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Multi-model audit and ground-truth labeling.</span>
        </div>
        <div>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Train</h3>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Export high-quality datasets for Whisper ML.</span>
        </div>
      </div>
    </div>
  );
}
