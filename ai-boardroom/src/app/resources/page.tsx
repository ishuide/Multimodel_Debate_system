'use client'

export default function ResourcesPage() {
  const docs = [
    { title: 'Getting Started', desc: 'Install, configure, and run AI Boardroom locally in under 10 minutes.', tag: 'Setup' },
    { title: 'API Reference', desc: 'Full documentation for the FastAPI backend endpoints and SSE stream format.', tag: 'Backend' },
    { title: 'Agent Configuration', desc: 'How to register, customize, and extend agents in the AgentRegistry.', tag: 'Agents' },
    { title: 'RAG & Memory', desc: 'How the knowledge retrieval system and project memory work together.', tag: 'Intelligence' },
    { title: 'Judge Scoring', desc: 'Scoring dimensions explained, including alignment cap and innovation ceiling logic.', tag: 'Evaluation' },
    { title: 'Consensus Formation', desc: 'How the Chief Strategy Officer agent synthesizes competing plans.', tag: 'Output' },
  ]

  const github = [
    { label: 'Repository', href: 'https://github.com/ishuide/Multimodel_Debate_system', desc: 'Full source code' },
    { label: 'Issues', href: 'https://github.com/ishuide/Multimodel_Debate_system/issues', desc: 'Bug reports & feature requests' },
    { label: 'Releases', href: 'https://github.com/ishuide/Multimodel_Debate_system/releases', desc: 'Version history' },
  ]

  const journey = [
    { phase: 'Week 1', note: 'Initial multi-agent prototype with three Ollama models running in parallel.' },
    { phase: 'Week 2', note: 'Added critique and defense debate rounds. First working debate loop.Integrated RAG with ChromaDB. Added project memory and session persistence.' },
    { phase: 'Week 3', note: 'Judge scoring system built. Alignment cap and domain analyzer added.Consensus agent built. Full 10-phase debate pipeline operational.Frontend built. SSE streaming display, roadmap visualizer, scoring bars.' }
  ]

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem' }}>

        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            Documentation & History
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 500,
            color: 'var(--text-primary)', marginBottom: '0.75rem',
          }}>
            Resources
          </h1>
        </div>

        {/* Docs grid */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={sectionLabel}>Documentation</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
          }}>
            {docs.map(doc => (
              <div key={doc.title} style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '1.25rem 1.5rem',
                cursor: 'default',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--gold-border)'
                e.currentTarget.style.background = 'var(--surface-3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{doc.title}</div>
                  <span style={{
                    padding: '2px 10px',
                    background: 'var(--gold-dim)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: 20,
                    fontSize: 11,
                    color: 'var(--gold)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    marginLeft: 12,
                  }}>{doc.tag}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{doc.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Development journey */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={sectionLabel}>Development Journey</h2>
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            {journey.map((j, i) => (
              <div key={j.phase} style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '1.5rem',
                padding: '1.25rem 1.5rem',
                borderBottom: i < journey.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'start',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--gold)', paddingTop: 2,
                }}>
                  {j.phase}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {j.note}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* GitHub links */}
        <section>
          <h2 style={sectionLabel}>GitHub</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {github.map(g => (
              <a key={g.label} href={g.href} target="_blank" rel="noreferrer" style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '1.25rem 1.5rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--gold-border)',
                borderRadius: 12,
                minWidth: 160,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--gold)' }}>
                  {g.label} ↗
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.desc}</div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11, color: 'var(--gold)',
  letterSpacing: '0.12em', textTransform: 'uppercase',
  marginBottom: '1.25rem',
}
