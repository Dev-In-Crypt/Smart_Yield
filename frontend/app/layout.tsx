import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title:       'Smart Yield Vaults | Initia',
  description: 'AI-powered yield aggregator on Initia EVM.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 32px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-card)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}>
            <Link href="/" style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', textDecoration: 'none' }}>
              ⚡ Smart Yield
            </Link>
            <div style={{ display: 'flex', gap: 8 }}>
              <NavLink href="/">Home</NavLink>
              <NavLink href="/vault">Vault</NavLink>
              <NavLink href="/dashboard">Dashboard</NavLink>
            </div>
          </nav>
          <main style={{ minHeight: 'calc(100vh - 57px)' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="nav-link">
      {children}
    </Link>
  );
}
