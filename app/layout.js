import './globals.css'

export const metadata = {
  title: 'ATC Pipeline',
  description: 'Minimalist ATC audio analysis platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
            ATC / PIPELINE
          </div>
        </header>
        <main className="app-main">
          {children}
        </main>
      </body>
    </html>
  )
}
