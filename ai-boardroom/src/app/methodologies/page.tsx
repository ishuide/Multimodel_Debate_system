'use client'

const methods = [
  {
    name: 'Agile',
    color: 'var(--accent-teal)',
    colorDim: 'rgba(58,175,169,0.08)',
    colorBorder: 'rgba(58,175,169,0.25)',
    tagline: 'Iterative. Adaptive. Fast.',
    flow: ['Plan', 'Build', 'Feedback', 'Improve'],
    pros: ['Responds quickly to change', 'Delivers value early via MVP', 'Close collaboration with stakeholders', 'Continuous improvement culture'],
    cons: ['Harder to predict total scope/cost', 'Requires active user involvement', 'Documentation often lighter'],
    bestFor: ['SaaS products', 'Startups with evolving requirements', 'Teams with direct customer access'],
  },
  {
    name: 'Waterfall',
    color: 'var(--accent-blue)',
    colorDim: 'rgba(74,143,212,0.08)',
    colorBorder: 'rgba(74,143,212,0.25)',
    tagline: 'Sequential. Documented. Predictable.',
    flow: ['Requirements', 'Design', 'Development', 'Testing', 'Deployment'],
    pros: ['Clear milestones and deliverables', 'Strong documentation trail', 'Predictable budget and timeline', 'Works well with fixed contracts'],
    cons: ['Inflexible to late-stage changes', 'User feedback arrives too late', 'Long time-to-value'],
    bestFor: ['Government or compliance projects', 'Fixed-scope contracts', 'Hardware-dependent systems'],
  },
  {
    name: 'Hybrid',
    color: 'var(--gold)',
    colorDim: 'var(--gold-dim)',
    colorBorder: 'var(--gold-border)',
    tagline: 'Planned. Iterative. Balanced.',
    flow: ['Define Scope', 'Design Phase', 'Sprint 1', 'Sprint 2', 'Release'],
    pros: ['Waterfall structure + Agile flexibility', 'Predictable high-level milestones', 'Iterative delivery within phases', 'Best of both methodologies'],
    cons: ['Complex to coordinate', 'Requires experienced PM', 'Team must understand both worlds'],
    bestFor: ['Enterprise software', 'Large teams with mixed disciplines', 'Projects with regulatory and feature needs'],
  },
]

const comparisonData = [
  { feature: 'Flexibility', agile: 'High', waterfall: 'Low', hybrid: 'Medium' },
  { feature: 'Documentation', agile: 'Light', waterfall: 'Heavy', hybrid: 'Moderate' },
  { feature: 'Delivery Speed', agile: 'Fast', waterfall: 'Slow', hybrid: 'Medium' },
  { feature: 'Risk Control', agile: 'Medium', waterfall: 'High', hybrid: 'High' },
  { feature: 'Change Tolerance', agile: 'High', waterfall: 'Low', hybrid: 'Medium' },
  { feature: 'Predictability', agile: 'Low', waterfall: 'High', hybrid: 'High' },
]

const cellColor = (val: string) => {
  if (['High', 'Fast', 'Heavy'].includes(val)) return 'var(--accent-teal)'
  if (['Low', 'Slow', 'Light'].includes(val)) return 'var(--accent-coral)'
  return 'var(--gold)'
}

export default function MethodologiesPage() {
  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem' }}>

        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            Educational Reference
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 500,
            color: 'var(--text-primary)', marginBottom: '0.75rem',
          }}>
            The Three Methodologies
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 520 }}>
            AI Boardroom deploys one agent per methodology. Understanding their differences explains why their debate outputs diverge.
          </p>
        </div>

        {/* Methodology cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '4rem' }}>
          {methods.map(m => (
            <div key={m.name} style={{
              background: 'var(--surface-2)',
              border: `1px solid ${m.colorBorder}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              {/* Header strip */}
              <div style={{
                padding: '1.5rem 2rem',
                borderBottom: `1px solid ${m.colorBorder}`,
                background: m.colorDim,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22, fontWeight: 500, color: m.color, marginBottom: 4,
                  }}>
                    {m.name}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.tagline}</div>
                </div>

                {/* Flow visual */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {m.flow.map((step, i) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        padding: '4px 12px',
                        background: 'var(--surface-3)',
                        border: `1px solid ${m.colorBorder}`,
                        borderRadius: 6,
                        fontSize: 12,
                        color: m.color,
                      }}>
                        {step}
                      </div>
                      {i < m.flow.length - 1 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
                      )}
                    </div>
                  ))}
                  {m.name === 'Agile' && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>↺</span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1px', background: 'var(--border)',
              }} className="method-body">
                <InfoColumn title="Advantages" items={m.pros} iconColor={m.color} sign="+" />
                <InfoColumn title="Trade-offs" items={m.cons} iconColor="var(--accent-coral)" sign="−" />
                <InfoColumn title="Best suited for" items={m.bestFor} iconColor="var(--text-muted)" sign="▸" />
              </div>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            Quick Reference
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500,
            color: 'var(--text-primary)', marginBottom: '1.5rem',
          }}>
            Side-by-side comparison
          </h2>

          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Feature</th>
                  <th style={{ ...thStyle, color: 'var(--accent-teal)' }}>Agile</th>
                  <th style={{ ...thStyle, color: 'var(--accent-blue)' }}>Waterfall</th>
                  <th style={{ ...thStyle, color: 'var(--gold)' }}>Hybrid</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={row.feature} style={{
                    borderBottom: i < comparisonData.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontWeight: 500 }}>{row.feature}</td>
                    <td style={{ ...tdStyle, color: cellColor(row.agile), textAlign: 'center' }}>{row.agile}</td>
                    <td style={{ ...tdStyle, color: cellColor(row.waterfall), textAlign: 'center' }}>{row.waterfall}</td>
                    <td style={{ ...tdStyle, color: cellColor(row.hybrid), textAlign: 'center' }}>{row.hybrid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .method-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function InfoColumn({ title, items, iconColor, sign }: {
  title: string; items: string[]; iconColor: string; sign: string
}) {
  return (
    <div style={{ background: 'var(--surface-2)', padding: '1.25rem 1.5rem' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <li key={item} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8, lineHeight: 1.5 }}>
            <span style={{ color: iconColor, flexShrink: 0 }}>{sign}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '14px 20px',
  fontSize: 13, fontWeight: 500,
  color: 'var(--text-secondary)',
  textAlign: 'center',
  background: 'var(--surface-3)',
}

const tdStyle: React.CSSProperties = {
  padding: '13px 20px',
  fontSize: 14,
  color: 'var(--text-primary)',
}
