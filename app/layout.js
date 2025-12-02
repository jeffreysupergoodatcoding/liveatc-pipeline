import './globals.css'

export const metadata = {
  title: 'LiveATC Pipeline Admin',
  description: 'Admin interface for LiveATC audio collection system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
