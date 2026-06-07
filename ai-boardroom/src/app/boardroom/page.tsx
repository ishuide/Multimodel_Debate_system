'use client'
import { useState } from 'react'
import PDFDownloadPanel from '@/components/PDFDownloadPanel'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 16px',
  fontSize: 15,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  marginBottom: 8,
  display: 'block',
  fontWeight: 500,
  letterSpacing: '0.02em',
}

export default function BoardroomPage() {
  const [idea, setIdea] = useState('')
  const [team, setTeam] = useState(5)
  const [deadline, setDeadline] = useState(12)
  const [stack, setStack] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamOutput, setStreamOutput] = useState<string[]>([])
  const [error, setError] = useState('')

  // Session data extracted from stream for PDF generation
  const [sessionDone, setSessionDone] = useState(false)
  const [sessionData, setSessionData] = useState<{
    consensusPlan: Record<string, unknown>
    judgeScores: Record<string, unknown>
    methodologyWeights: Record<string, number>
    projectId: string
  }>({ consensusPlan: {}, judgeScores: {}, methodologyWeights: {}, projectId: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idea.trim()) return

    setLoading(true)
    setStreamOutput([])
    setError('')
    setSessionDone(false)

    const localConsensus: Record<string, unknown> = {}
    const localScores: Record<string, unknown> = {}
    let localProjectId = ''

    try {
      const params = new URLSearchParams({
        idea,
        techStack: stack,
        members: team.toString(),
        deadlineWeeks: deadline.toString(),
      })
      const res = await fetch(`${API_BASE}/debate?${params.toString()}`, {
        method: 'GET'
      })

      if (!res.ok) throw new Error(`Server responded with ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() || ''

        for (const rawLine of parts) {
          const line = rawLine.trim()
          if (!line.startsWith('data:')) continue
          const data = line.replace('data:', '').trim()
          if (!data || data === '[DONE]') continue

          setStreamOutput(prev => [...prev, data])

          // Extract structured data from stream for PDF
          try {
            const parsed = JSON.parse(data)

            if (parsed.roadmap && Array.isArray(parsed.roadmap)) {
              Object.assign(localConsensus, parsed)
            }
            if (parsed.judgeScores) {
              Object.assign(localScores, parsed.judgeScores)
            }
            if (parsed.session_id) {
              localProjectId = parsed.session_id
            }

            if (parsed.phase === 'consensus' && parsed.plan) {
              Object.assign(localConsensus, parsed.plan)
            }
            if (parsed.phase === 'judge' && parsed.agent && parsed.scores) {
              localScores[parsed.agent] = parsed.scores
            }
            if (parsed.project_id) {
              localProjectId = parsed.project_id
            }
          } catch {
            // Non-JSON payloads are rendered as plain text
          }
        }
      }

      setSessionData({
        consensusPlan: localConsensus,
        judgeScores: localScores,
        methodologyWeights: { Agile: 40, Waterfall: 25, Hybrid: 35 },
        projectId: localProjectId,
      })
      setSessionDone(true)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Make sure your backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11, color: 'var(--gold)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}>
            Session Room
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            fontWeight: 500, color: 'var(--text-primary)',
            marginBottom: '0.75rem',
          }}>
            The Boardroom
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 520 }}>
            Submit your project idea. Three AI agents debate, defend, and revise their plans — then produce a unified roadmap you can download as a PDF.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '2rem', alignItems: 'start' }} className="boardroom-grid">

          {/* ── Left column: Input + Download ─────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Input panel */}
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '1.75rem',
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                Project Brief
              </h2>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Project Idea *</label>
                  <textarea
                    value={idea}
                    onChange={e => setIdea(e.target.value)}
                    placeholder="Describe your project concept in detail..."
                    rows={5}
                    required
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--gold-border)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Tech Stack</label>
                  <input
                    type="text"
                    value={stack}
                    onChange={e => setStack(e.target.value)}
                    placeholder="e.g. Next.js, FastAPI, PostgreSQL"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--gold-border)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Team Size</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="range" min={1} max={20} value={team}
                        onChange={e => setTeam(Number(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--gold)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)', minWidth: 24 }}>{team}</span>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Deadline (weeks)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="range" min={2} max={52} value={deadline}
                        onChange={e => setDeadline(Number(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--gold)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)', minWidth: 24 }}>{deadline}</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(212,101,74,0.1)',
                    border: '1px solid rgba(212,101,74,0.3)',
                    borderRadius: 8, fontSize: 13, color: '#D4654A',
                  }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading || !idea.trim()} style={{
                  padding: '13px',
                  background: loading || !idea.trim() ? 'var(--surface-4)' : 'var(--gold)',
                  color: loading || !idea.trim() ? 'var(--text-muted)' : '#0E0E10',
                  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500,
                  cursor: loading || !idea.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}>
                  {loading ? 'Debate in progress...' : 'Start Boardroom Session →'}
                </button>
              </form>
            </div>

            {/* ── PDF Download Panel ── */}
            <div style={{
              background: 'var(--surface-2)',
              border: `1px solid ${sessionDone ? 'var(--gold-border)' : 'var(--border)'}`,
              borderRadius: 14,
              padding: '1.5rem',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-muted)', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: '0.75rem',
              }}>
                Export
              </div>
              <PDFDownloadPanel
                idea={idea}
                stack={stack}
                team={team}
                deadline={deadline}
                projectId={sessionData.projectId}
                consensusPlan={sessionData.consensusPlan}
                judgeScores={sessionData.judgeScores}
                methodologyWeights={sessionData.methodologyWeights}
                disabled={!sessionDone}
              />
            </div>
          </div>

          {/* ── Right column: Debate output ─────────────── */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '1.75rem',
            minHeight: 560,
          }}>
            {streamOutput.length === 0 && !loading ? (
              <EmptyState />
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                    Debate Arena
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {sessionDone && (
                      <span style={{
                        fontSize: 11, color: 'var(--accent-teal)',
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid rgba(58,175,169,0.3)',
                        padding: '2px 10px', borderRadius: 20,
                        background: 'rgba(58,175,169,0.08)',
                      }}>
                        Session complete
                      </span>
                    )}
                    {loading && <PulsingDot />}
                  </div>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  maxHeight: 620, overflowY: 'auto',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                }}>
                  {streamOutput.map((line, i) => (
                    <StreamLine key={i} line={line} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .boardroom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function StreamLine({ line }: { line: string }) {
  let parsed: Record<string, unknown> | null = null
  try { parsed = JSON.parse(line) } catch { }

  if (parsed) {
    const step = parsed.step as string | undefined
    const persona = parsed.persona as string | undefined
    const message = parsed.message as string | undefined
    const error = parsed.error as string | undefined
    const partial = parsed.response as string | undefined
    const defense = parsed.defense as string | undefined
    const revision = parsed.revised_plan as string | undefined
    const final = parsed.summary as string | undefined

    const display =
      error ? error :
      partial ? partial :
      defense ? defense :
      revision ? revision :
      final ? final :
      message || JSON.stringify(parsed, null, 2)

    return (
      <div style={{
        padding: '10px 14px',
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        lineHeight: 1.5,
      }}>
        {step && (
          <div style={{ color: 'var(--gold)', fontSize: 11, letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>
            {step}
          </div>
        )}
        {persona && (
          <span style={{ color: 'var(--accent-teal)', marginRight: 8 }}>[{persona}]</span>
        )}
        <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{display}</div>
      </div>
    )
  }

  return (
    <div style={{ color: 'var(--text-secondary)', padding: '4px 0', opacity: 0.7 }}>{line}</div>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 440, gap: '1rem', textAlign: 'center',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        border: '1px solid var(--gold-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--gold)', fontSize: 24,
      }}>◈</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Awaiting session</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 260 }}>
        Submit a project brief to begin the multi-agent debate. When the session completes, use the Export panel to download your PDF plan.
      </div>
    </div>
  )
}

function PulsingDot() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--gold)',
          animation: `pulse 1.2s ease-in-out infinite ${i * 0.2}s`,
        }} />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
