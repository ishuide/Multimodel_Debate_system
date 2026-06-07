'use client'
import { useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PDFDownloadPanelProps {
    idea: string
    stack: string
    team: number
    deadline: number
    projectId?: string
    consensusPlan?: Record<string, unknown>
    judgeScores?: Record<string, unknown>
    methodologyWeights?: Record<string, number>
    disabled?: boolean
}

type DownloadState = 'idle' | 'fetching_resources' | 'building_charts' | 'compiling' | 'done' | 'error'

const STEPS: { key: DownloadState; label: string; sub: string }[] = [
    { key: 'fetching_resources', label: 'Fetching resource links', sub: 'npm · PyPI · official docs' },
    { key: 'building_charts', label: 'Rendering charts', sub: 'Gantt · scores · methodology' },
    { key: 'compiling', label: 'Compiling PDF', sub: 'reportlab · A4 layout' },
    { key: 'done', label: 'Ready', sub: 'Download will start automatically' },
]

export default function PDFDownloadPanel({
    idea, stack, team, deadline, projectId = '',
    consensusPlan = {}, judgeScores = {}, methodologyWeights = {},
    disabled = false,
}: PDFDownloadPanelProps) {
    const [open, setOpen] = useState(false)
    const [dlState, setDlState] = useState<DownloadState>('idle')
    const [error, setError] = useState('')
    const [lastGenerated, setLastGenerated] = useState<string | null>(null)

    async function handleDownload() {
        if (dlState === 'fetching_resources' || dlState === 'building_charts' || dlState === 'compiling') return

        setDlState('fetching_resources')
        setError('')

        // Simulate step progression for UX feedback
        const stepTimer = (step: DownloadState, delay: number) =>
            new Promise<void>(res => setTimeout(() => { setDlState(step); res() }, delay))

        try {
            const fetchPromise = fetch(`${API_BASE}/generate-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idea, stack, team, deadline,
                    project_id: projectId,
                    consensus_plan: consensusPlan,
                    judge_scores: judgeScores,
                    methodology_weights: methodologyWeights,
                }),
            })

            // Show progress steps while waiting
            await stepTimer('building_charts', 1200)
            await stepTimer('compiling', 1000)

            const res = await fetchPromise

            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Server error ${res.status}: ${text.slice(0, 120)}`)
            }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)

            // Trigger browser download
            const a = document.createElement('a')
            const safeName = idea.slice(0, 40).replace(/[^a-z0-9\s-]/gi, '_')
            a.href = url
            a.download = `AI_Boardroom_${safeName.trim()}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setDlState('done')
            setLastGenerated(new Date().toLocaleTimeString())

            // Reset after 4s
            setTimeout(() => setDlState('idle'), 4000)

        } catch (err) {
            setDlState('error')
            setError(err instanceof Error ? err.message : 'Download failed. Check backend connection.')
        }
    }

    const isLoading = ['fetching_resources', 'building_charts', 'compiling'].includes(dlState)
    const currentStepIndex = STEPS.findIndex(s => s.key === dlState)

    return (
        <div style={{ marginTop: '1.5rem' }}>
            {/* Panel trigger button */}
            <button
                onClick={() => setOpen(v => !v)}
                disabled={disabled}
                style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: disabled ? 'var(--surface-4)' : 'var(--surface-3)',
                    border: `1px solid ${disabled ? 'var(--border)' : 'var(--gold-border)'}`,
                    borderRadius: 10,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--surface-4)' }}
                onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'var(--surface-3)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PDFIcon disabled={disabled} />
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: disabled ? 'var(--text-muted)' : 'var(--gold)' }}>
                            Download Project Plan
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {disabled
                                ? 'Complete a session to unlock'
                                : 'Full PDF with roadmap, charts & resource links'}
                        </div>
                    </div>
                </div>
                <ChevronIcon open={open} disabled={disabled} />
            </button>

            {/* Expandable panel */}
            {open && !disabled && (
                <div style={{
                    marginTop: 8,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                }}>
                    {/* What's included */}
                    <div style={{
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid var(--border)',
                    }}>
                        <div style={{
                            fontSize: 11, color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            marginBottom: '0.75rem',
                        }}>
                            What's included
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {INCLUDES.map(item => (
                                <IncludeItem key={item.label} {...item} />
                            ))}
                        </div>
                    </div>

                    {/* Progress / download */}
                    <div style={{ padding: '1.25rem 1.5rem' }}>

                        {/* Step progress */}
                        {isLoading && (
                            <div style={{ marginBottom: '1rem' }}>
                                {STEPS.slice(0, 3).map((step, i) => (
                                    <div key={step.key} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        marginBottom: 8, opacity: i <= currentStepIndex ? 1 : 0.35,
                                    }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: i < currentStepIndex ? 'var(--accent-teal)'
                                                : i === currentStepIndex ? 'var(--gold-dim)'
                                                    : 'var(--surface-4)',
                                            border: `1px solid ${i <= currentStepIndex ? 'var(--gold-border)' : 'var(--border)'}`,
                                        }}>
                                            {i < currentStepIndex ? (
                                                <span style={{ fontSize: 10, color: 'var(--surface)' }}>✓</span>
                                            ) : i === currentStepIndex ? (
                                                <SpinnerDot />
                                            ) : (
                                                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{i + 1}</span>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                                                {step.label}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{step.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Success message */}
                        {dlState === 'done' && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px',
                                background: 'rgba(58,175,169,0.1)',
                                border: '1px solid rgba(58,175,169,0.3)',
                                borderRadius: 8, marginBottom: '1rem',
                                fontSize: 13, color: 'var(--accent-teal)',
                            }}>
                                <span>✓</span>
                                PDF downloaded at {lastGenerated}
                            </div>
                        )}

                        {/* Error */}
                        {dlState === 'error' && (
                            <div style={{
                                padding: '10px 14px',
                                background: 'rgba(212,101,74,0.1)',
                                border: '1px solid rgba(212,101,74,0.3)',
                                borderRadius: 8, marginBottom: '1rem',
                                fontSize: 12, color: 'var(--accent-coral)',
                            }}>
                                {error}
                                <button onClick={() => setDlState('idle')}
                                    style={{
                                        marginLeft: 10, fontSize: 11, color: 'var(--text-muted)',
                                        background: 'none', border: 'none', cursor: 'pointer'
                                    }}>
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Download button */}
                        <button
                            onClick={handleDownload}
                            disabled={isLoading}
                            style={{
                                width: '100%', padding: '12px',
                                background: isLoading ? 'var(--surface-4)' : 'var(--gold)',
                                color: isLoading ? 'var(--text-muted)' : '#0E0E10',
                                border: 'none', borderRadius: 8,
                                fontSize: 14, fontWeight: 600,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.opacity = '0.88' }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                        >
                            <DownloadIcon loading={isLoading} />
                            {isLoading ? 'Building PDF…' : dlState === 'done' ? 'Download Again' : 'Generate & Download PDF'}
                        </button>

                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                            Resource links are fetched live from npm, PyPI, and official docs — no hallucinated URLs.
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const INCLUDES = [
    { label: 'Executive Summary', icon: '◈', desc: 'Consensus plan narrative' },
    { label: 'Gantt Roadmap', icon: '◉', desc: 'Week-by-week visual chart' },
    { label: 'Judge Scores', icon: '◇', desc: 'Bar chart across 5 dimensions' },
    { label: 'Stack Guide', icon: '◎', desc: 'How each tech fits the project' },
    { label: 'Resource Links', icon: '◆', desc: 'Live-fetched official docs' },
    { label: 'Risk Register', icon: '▲', desc: 'Identified execution risks' },
]

function IncludeItem({ label, icon, desc }: { label: string; icon: string; desc: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: 'var(--gold)', fontSize: 12, marginTop: 1, flexShrink: 0 }}>{icon}</span>
            <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
            </div>
        </div>
    )
}

function SpinnerDot() {
    return (
        <>
            <div style={{
                width: 8, height: 8, borderRadius: '50%',
                border: '1.5px solid var(--gold)',
                borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    )
}

function PDFIcon({ disabled }: { disabled: boolean }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={disabled ? 'var(--text-muted)' : 'var(--gold)'}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    )
}

function DownloadIcon({ loading }: { loading: boolean }) {
    if (loading) return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </svg>
    )
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    )
}

function ChevronIcon({ open, disabled }: { open: boolean; disabled: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke={disabled ? 'var(--text-muted)' : 'var(--gold)'}
            strokeWidth="1.5" strokeLinecap="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 5l5 5 5-5" />
        </svg>
    )
}
