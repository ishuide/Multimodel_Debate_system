'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/boardroom', label: 'Boardroom' },
  { href: '/methodologies', label: 'Methodologies' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/resources', label: 'Resources' },
]

const githubLinks = [
  { label: 'Repository', href: 'https://github.com/ishuide/isheyme' },
  { label: 'Source Code', href: 'https://github.com/ishuide/isheyme' },
  { label: 'Issues', href: 'https://github.com/ishuide/isheyme/issues' },
  { label: 'Releases', href: 'https://github.com/ishuide/isheyme/releases' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [githubOpen, setGithubOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setGithubOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(14,14,16,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 2rem',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, color: '#0E0E10', fontWeight: 700 }}>B</span>
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
          }}>
            AI Boardroom
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 400,
              color: pathname === link.href ? 'var(--gold)' : 'var(--text-secondary)',
              background: pathname === link.href ? 'var(--gold-dim)' : 'transparent',
              border: pathname === link.href ? '1px solid var(--gold-border)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}>
              {link.label}
            </Link>
          ))}

          {/* GitHub dropdown */}
          <div ref={dropRef} style={{ position: 'relative', marginLeft: 8 }}>
            <button
              onClick={() => setGithubOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 400,
                color: 'var(--gold)',
                background: 'var(--gold-dim)',
                border: '1px solid var(--gold-border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <GithubIcon />
              GitHub
              <ChevronIcon open={githubOpen} />
            </button>

            {githubOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--surface-3)',
                border: '1px solid var(--border-gold)',
                borderRadius: 10,
                minWidth: 160,
                overflow: 'hidden',
                boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              }}>
                {githubLinks.map(g => (
                  <a key={g.label} href={g.href} target="_blank" rel="noreferrer" style={{
                    display: 'block',
                    padding: '10px 16px',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border)',
                    transition: 'color 0.1s, background 0.1s',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.color = 'var(--gold)'
                    ;(e.target as HTMLElement).style.background = 'var(--gold-dim)'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.color = 'var(--text-secondary)'
                    ;(e.target as HTMLElement).style.background = 'transparent'
                  }}>
                    {g.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileOpen(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)', padding: 8,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            {mobileOpen ? (
              <>
                <line x1="4" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="18" y1="4" x2="4" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
          padding: '1rem 2rem 1.5rem',
        }}>
          {navLinks.map(link => (
            <Link key={link.href} href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'block',
                padding: '12px 0',
                fontSize: 15,
                color: pathname === link.href ? 'var(--gold)' : 'var(--text-secondary)',
                borderBottom: '1px solid var(--border)',
              }}>
              {link.label}
            </Link>
          ))}
          <a href="https://github.com/ishuide/isheyme" target="_blank" rel="noreferrer"
            style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--gold)' }}>
            GitHub ↗
          </a>
        </div>
      )}

      <style>{`
        .desktop-nav { display: flex; }
        .mobile-nav-toggle { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none; }
          .mobile-nav-toggle { display: block; }
        }
      `}</style>
    </nav>
  )
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58l-.01-2.04c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
