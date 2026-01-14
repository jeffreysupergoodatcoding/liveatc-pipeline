import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>LiveATC Pipeline</h1>
      <p style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        End-to-end data curation platform for ATC audio machine learning
      </p>

      <nav>
        <Link
          href="/admin/liveatc"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: 'white',
            borderRadius: '0.5rem',
            fontWeight: 'bold'
          }}
        >
          Go to Admin Interface
        </Link>
      </nav>
    </main>
  );
}
