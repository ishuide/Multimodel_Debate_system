'use client'

export default function ArchitecturePage() {
  const layers = [
    {
      label: 'UI Layer',
      color: 'var(--gold)',
      colorDim: 'var(--gold-dim)',
      colorBorder: 'var(--gold-border)',
      items: ['Next.js 14 (App Router)', 'Tailwind CSS', 'Framer Motion', 'SSE Stream Rendering'],
    },
    {
      label: 'Backend Layer',
      color: 'var(--accent-blue)',
      colorDim: 'rgba(74,143,212,0.08)',
      colorBorder: 'rgba(74,143,212,0.25)',
      items: ['FastAPI', 'Server-Sent Events (SSE)', 'Pydantic Schemas', 'Ollama Integration'],
    },
    {
      label: 'AI Agent Layer',
      color: 'var(--accent-teal)',
      colorDim: 'rgba(58,175,169,0.08)',
      colorBorder: 'rgba(58,175,169,0.25)',
      items: ['Agile Agent (phi3:mini)', 'Waterfall Agent (qwen2:1.5b)', 'Hybrid Agent (smollm2:1.7b)', 'Judge Agent (qwen2:1.5b)', 'Consensus Agent (phi3:mini)'],
    },
    {
      label: 'Intelligence Layer',
      color: '#A78BFA',
      colorDim: 'rgba(167,139,250,0.08)',
      colorBorder: 'rgba(167,139,250,0.25)',
      items: ['RAG (Knowledge Retrieval)', 'Project Memory', 'Domain Analyzer', 'Validation Engine'],
    },
    {
      label: 'Consensus Layer',
      color: 'var(--accent-coral)',
      colorDim: 'rgba(212,101,74,0.08)',
      colorBorder: 'rgba(212,101,74,0.25)',
      items: ['Weighted Scoring', 'Plan Ranking', 'Conflict Resolution', 'Roadmap Synthesis'],
    },
  ]

  const flow = [
    { step: '01', label: 'User Prompt', desc: 'Idea, stack, team, deadline' },
    { step: '02', label: 'Knowledge Retrieval', desc: 'RAG + memory recall' },
    { step: '03', label: 'Proposal Generation', desc: 'Three parallel plans' },
    { step: '04', label: 'Critique Round', desc: 'Cross-agent analysis' },
    { step: '05', label: 'Defense Round', desc: 'Each agent defends' },
    { step: '06', label: 'Revision Round', desc: 'Plans updated' },
    { step: '07', label: 'Validation', desc: 'Domain contamination check' },
    { step: '08', label: 'Judge Evaluation', desc: 'Five-dimension scoring' },
    { step: '09', label: 'Consensus Formation', desc: 'Best ideas merged' },
    { step: '10', label: 'Execution Roadmap', desc: 'Week-by-week output' },
  ]

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem' }}>

        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            System Design
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 500,
            color: 'var(--text-primary)', marginBottom: '0.75rem',
          }}>
            Architecture
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 520 }}>
            A five-layer system where each layer handles a discrete responsibility — from raw user input to the final roadmap output.
          </p>
        </div>

        {/* System layers */}
        <div style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            System Layers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {layers.map(layer => (
              <div key={layer.label} style={{
                background: 'var(--surface-2)',
                border: `1px solid ${layer.colorBorder}`,
                borderRadius: 12,
                padding: '1.25rem 1.5rem',
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                gap: '1.5rem',
                alignItems: 'center',
              }} className="arch-row">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: layer.color, marginBottom: 4 }}>
                    {layer.label}
                  </div>
                  <div style={{
                    width: 40, height: 2,
                    background: `linear-gradient(90deg, ${layer.color}, transparent)`,
                    borderRadius: 1,
                  }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {layer.items.map(item => (
                    <span key={item} style={{
                      padding: '4px 12px',
                      background: layer.colorDim,
                      border: `1px solid ${layer.colorBorder}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: layer.color,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution flow */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Execution Flow
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1px',
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            {flow.map((f) => (
              <div key={f.step} style={{
                background: 'var(--surface-2)',
                padding: '1.25rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--gold)', marginBottom: 8,
                }}>
                  Phase {f.step}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .arch-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
