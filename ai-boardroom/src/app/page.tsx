'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const FLOW_STEPS = [
  { label: 'Your Idea', sub: 'Prompt + context', color: 'var(--gold)', delay: 0 },
  { label: 'RAG + Memory', sub: 'Knowledge retrieval', color: 'var(--accent-blue)', delay: 150 },
  { label: 'Agile', sub: 'Sprint planning', color: 'var(--accent-teal)', delay: 300 },
  { label: 'Waterfall', sub: 'Sequential phases', color: 'var(--accent-teal)', delay: 450 },
  { label: 'Hybrid', sub: 'Combined approach', color: 'var(--accent-teal)', delay: 600 },
  { label: 'Debate', sub: 'Critique & defend', color: 'var(--accent-coral)', delay: 750 },
  { label: 'Judge', sub: 'Score & evaluate', color: '#A78BFA', delay: 900 },
  { label: 'Consensus', sub: 'Final roadmap', color: 'var(--gold)', delay: 1050 },
]



const USE_CASES = [
  { title: 'Startup Planning', items: ['Validate your idea', 'Build execution roadmaps', 'Estimate realistic timelines'], icon: '◈' },
  { title: 'Research Projects', items: ['Structure your research plan', 'Identify gaps and risks', 'Compare methodologies'], icon: '◉' },
  { title: 'Software Architecture', items: ['System design planning', 'Tech stack decisions', 'API & schema planning'], icon: '◇' },
  { title: 'Decision Making', items: ['Compare alternatives', 'Evaluate trade-offs', 'Stress-test assumptions'], icon: '◎' },
]

const PHASES = [
  { n: '01', title: 'Multi-Model Planning', desc: 'Three specialized agents generate independent project plans from your idea.' },
  { n: '02', title: 'Memory + RAG', desc: 'Relevant past projects and domain knowledge are retrieved and injected.' },
  { n: '03', title: 'Debate Engine', desc: 'Agents critique each other\'s plans and defend their recommendations.' },
  { n: '04', title: 'Judge Scoring', desc: 'An independent AI judge scores each plan across five dimensions.' },
  { n: '05', title: 'Consensus Builder', desc: 'The strongest elements from all plans are merged into one roadmap.' },
  { n: '06', title: 'Execution Roadmap', desc: 'Week-by-week deliverables, artifacts, and success criteria.' },
]

export default function HomePage() {
  const [visible, setVisible] = useState<boolean[]>(Array(FLOW_STEPS.length).fill(false))

  useEffect(() => {
    FLOW_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setVisible(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, step.delay + 400)
    })
  }, [])



  return (
    <div style={{ paddingTop: 64 }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '5rem 2rem 4rem',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background radial glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 820 }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 16px', marginBottom: '1.5rem',
            border: '1px solid var(--gold-border)',
            borderRadius: 20,
            fontSize: 12,
            color: 'var(--gold)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            background: 'var(--gold-dim)',
          }}>
            Multi-Agent Decision Intelligence
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.8rem, 6vw, 5rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
          }}>
            Not one AI opinion.
            <br />
            <span style={{ color: 'var(--gold)' }}>A boardroom of experts.</span>
          </h1>

          <p style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            maxWidth: 560,
            margin: '0 auto 2.5rem',
            lineHeight: 1.7,
          }}>
            Specialized AI agents debate, critique, and revise each other's
            recommendations before producing a single consensus roadmap for your project.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/boardroom" style={{
              padding: '13px 32px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '0.01em',
              transition: 'border-color 0.15s, color 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--gold-border)'
                e.currentTarget.style.color = 'var(--gold)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}>
              Enter the Boardroom →
            </Link>
            <a href="https://github.com/ishuide/Multimodel_Debate_system" target="_blank" rel="noreferrer" style={{
              padding: '13px 32px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 20,
              transition: 'border-color 0.15s, color 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--gold-border)'
                e.currentTarget.style.color = 'var(--gold)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}>
              View Source
            </a>
          </div>
        </div>

        {/* Animated flow diagram */}
        <div style={{ marginTop: '5rem', width: '100%', maxWidth: 900, position: 'relative' }}>
          <FlowDiagram steps={FLOW_STEPS} visible={visible} />
        </div>
      </section>

      {/* ── How It Was Developed ─────────────────────────── */}
      <section style={{ padding: '6rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Development Timeline</SectionLabel>
        <h2 style={{ ...sectionHeading, marginBottom: '3rem' }}>Built in six phases</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {PHASES.map((p) => (
            <div key={p.n} style={{
              background: 'var(--surface-2)',
              padding: '2rem',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--gold)',
                letterSpacing: '0.1em',
                marginBottom: '0.75rem',
              }}>Phase {p.n}</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {p.title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Judge Evaluation removed per request */}

      {/* ── Use Cases ────────────────────────────────────── */}
      <section style={{ padding: '6rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Applications</SectionLabel>
        <h2 style={{ ...sectionHeading, marginBottom: '3rem' }}>Where it works</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
        }}>
          {USE_CASES.map(uc => (
            <div key={uc.title} style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '1.75rem',
              transition: 'border-color 0.2s, background 0.2s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--gold-border)'
                e.currentTarget.style.background = 'var(--surface-3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}>
              <div style={{ fontSize: 22, marginBottom: '1rem', color: 'var(--gold)' }}>{uc.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                {uc.title}
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {uc.items.map(item => (
                  <li key={item} style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ color: 'var(--gold)', fontSize: 10 }}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{
        padding: '6rem 2rem',
        textAlign: 'center',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 3rem)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
        }}>
          Ready to stress-test your idea?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: 16 }}>
          Submit your project concept and let three AI agents debate its best execution path.
        </p>
        <Link href="/boardroom" style={{
          padding: '14px 40px',
          background: 'var(--gold)',
          color: '#0E0E10',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 500,
          display: 'inline-block',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          Open the Boardroom
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--text-muted)',
      }}>
        AI Boardroom — built by{' '}
        <a href="https://github.com/ishuide/Multimodel_Debate_system" target="_blank" rel="noreferrer"
          style={{ color: 'var(--text-secondary)' }}>
          ishuide
        </a>
      </footer>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function FlowDiagram({ steps, visible }: { steps: typeof FLOW_STEPS, visible: boolean[] }) {
  const agents = steps.filter((_, i) => i >= 2 && i <= 4)
  const others = steps.filter((_, i) => i < 2 || i > 4)
  const agentIndices = [2, 3, 4]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* Row: Idea → RAG */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <FlowNode step={steps[i]} visible={visible[i]} />
            {i < 1 && <Arrow />}
          </div>
        ))}
        <Arrow />
        {/* Fork label */}
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          marginLeft: 4,
        }}>FORK</div>
      </div>

      {/* Three agents in parallel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
        {agentIndices.map(i => (
          <FlowNode key={i} step={steps[i]} visible={visible[i]} />
        ))}
      </div>

      {/* Merge → Debate → Judge → Consensus */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          marginRight: 4,
        }}>MERGE</div>
        {[5, 6, 7].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <Arrow />
            <FlowNode step={steps[i]} visible={visible[i]} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowNode({ step, visible }: { step: typeof FLOW_STEPS[0], visible: boolean }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
      padding: '10px 18px',
      background: 'var(--surface-3)',
      border: `1px solid ${step.color === 'var(--gold)' ? 'var(--gold-border)' : 'var(--border)'}`,
      borderRadius: 10,
      textAlign: 'center',
      minWidth: 110,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: step.color }}>{step.label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{step.sub}</div>
    </div>
  )
}

function Arrow() {
  return (
    <div style={{ color: 'var(--text-muted)', padding: '0 6px', fontSize: 16 }}>→</div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--gold)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      marginBottom: '0.75rem',
    }}>
      {children}
    </div>
  )
}

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
  fontWeight: 500,
  color: 'var(--text-primary)',
  letterSpacing: '-0.01em',
}
