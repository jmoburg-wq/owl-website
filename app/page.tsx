'use client'

import { useState, useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════
   OWL v3 — Intelligence-grade. PE-ready. Product-forward.
   Inspired by owl.co visual language + OWL intelligence depth.
   ═══════════════════════════════════════════════════════════ */

// ── Typing animation ──
function TypeWriter({ words }: { words: string[] }) {
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const word = words[i]
    const speed = deleting ? 25 : 50
    if (!deleting && text === word) {
      const t = setTimeout(() => setDeleting(true), 2200)
      return () => clearTimeout(t)
    }
    if (deleting && text === '') {
      setDeleting(false)
      setI((i + 1) % words.length)
      return
    }
    const t = setTimeout(() => {
      setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1))
    }, speed)
    return () => clearTimeout(t)
  }, [text, deleting, i, words])
  return <>{text}<span style={{ color: 'var(--copper)', animation: 'blink 1s step-end infinite' }}>|</span></>
}

// ── Animated counter ──
function Counter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        let c = 0
        const step = Math.max(1, Math.floor(end / 40))
        const interval = setInterval(() => {
          c = Math.min(c + step, end)
          setCount(c)
          if (c >= end) clearInterval(interval)
        }, 30)
      }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [end])
  return <span ref={ref}>{prefix}{count}{suffix}</span>
}

// ── Simulated App Screenshot — Command Center ──
function CommandCenterMock() {
  const [feedIndex, setFeedIndex] = useState(0)
  const feed = [
    { time: '06:00', agent: 'GRIND', msg: '14 qualified leads identified', color: 'var(--signal)' },
    { time: '06:30', agent: 'RADAR', msg: 'Competitor pricing change detected', color: 'var(--copper)' },
    { time: '07:00', agent: 'SENTINEL', msg: 'All systems nominal — threat level GREEN', color: 'var(--signal)' },
    { time: '07:15', agent: 'FORGE', msg: 'Retention risk flagged: VP Eng, score 87/100', color: '#e74c3c' },
    { time: '07:30', agent: 'ORACLE', msg: '3 actionable market signals synthesized', color: 'var(--gold)' },
    { time: '08:00', agent: 'DEMING', msg: 'Quality gate: avg 36/40 across 4 outputs', color: 'var(--signal)' },
  ]
  useEffect(() => {
    if (feedIndex < feed.length) {
      const t = setTimeout(() => setFeedIndex(f => f + 1), 700)
      return () => clearTimeout(t)
    }
  }, [feedIndex, feed.length])

  return (
    <div className="app-frame" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="app-frame-bar">
        <div className="app-frame-dot" style={{ background: '#ff5f57' }} />
        <div className="app-frame-dot" style={{ background: '#febc2e' }} />
        <div className="app-frame-dot" style={{ background: '#28c840' }} />
        <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--bone-muted)' }}>
          owl-os.app/command-center
        </span>
      </div>
      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'AGENTS', value: '47', sub: 'active', color: 'var(--signal)' },
          { label: 'PIPELINE', value: '$2.4M', sub: '+$180K', color: 'var(--gold)' },
          { label: 'SIGNALS', value: '128', sub: 'today', color: 'var(--copper)' },
          { label: 'QUALITY', value: '37/40', sub: 'avg score', color: 'var(--signal)' },
        ].map(m => (
          <div key={m.label} style={{ padding: '16px 12px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--bone-muted)', letterSpacing: '0.15em' }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: m.color, fontWeight: 700, margin: '4px 0' }}>{m.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--signal)' }}>{m.sub}</div>
          </div>
        ))}
      </div>
      {/* Feed */}
      <div style={{ padding: '12px 16px', minHeight: '200px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--bone-muted)', letterSpacing: '0.15em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal)', animation: 'pulse 2s infinite', display: 'inline-block' }} />
          LIVE INTELLIGENCE FEED
        </div>
        {feed.slice(0, feedIndex).map((f, idx) => (
          <div key={idx} style={{
            padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            animation: 'slideInLeft 0.3s ease', display: 'flex', gap: '10px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: 'var(--bone-muted)', flexShrink: 0 }}>{f.time}</span>
            <span style={{ color: f.color, fontWeight: 700, flexShrink: 0 }}>{f.agent}</span>
            <span style={{ color: 'var(--bone-mid)' }}>{f.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── EBITDA Dashboard Mock ──
function EbitdaMock() {
  return (
    <div className="app-frame">
      <div className="app-frame-bar">
        <div className="app-frame-dot" style={{ background: '#ff5f57' }} />
        <div className="app-frame-dot" style={{ background: '#febc2e' }} />
        <div className="app-frame-dot" style={{ background: '#28c840' }} />
        <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--bone-muted)' }}>
          owl-os.app/ebitda-ledger
        </span>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--bone-muted)', letterSpacing: '0.15em' }}>Q1 2026 ATTRIBUTED IMPACT</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontWeight: 700, marginTop: '4px' }}>
              <span style={{ color: 'var(--gold)' }}>$452K</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--bone-muted)', letterSpacing: '0.15em' }}>ANNUALIZED</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--signal)', fontWeight: 700 }}>$1.8M</div>
          </div>
        </div>
        {[
          { label: 'Pipeline Acceleration', val: 167, pct: 83, amt: '$167K' },
          { label: 'Revenue Intelligence', val: 142, pct: 71, amt: '$142K' },
          { label: 'FORGE Retention Saves', val: 89, pct: 44, amt: '$89K' },
          { label: 'FinOps Cost Reduction', val: 54, pct: 27, amt: '$54K' },
        ].map(b => (
          <div key={b.label} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--bone-mid)' }}>{b.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gold)' }}>{b.amt}</span>
            </div>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${b.pct}%`, borderRadius: '3px',
                background: 'linear-gradient(90deg, var(--copper), var(--gold))',
                animation: 'growWidth 1.5s ease forwards',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── FORGE Mock ──
function ForgeMock() {
  return (
    <div className="app-frame">
      <div className="app-frame-bar">
        <div className="app-frame-dot" style={{ background: '#ff5f57' }} />
        <div className="app-frame-dot" style={{ background: '#febc2e' }} />
        <div className="app-frame-dot" style={{ background: '#28c840' }} />
        <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--bone-muted)' }}>
          owl-os.app/forge
        </span>
      </div>
      <div style={{ padding: '16px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--bone-muted)', letterSpacing: '0.15em', marginBottom: '12px' }}>
          RETENTION RADAR — EXECUTIVE TEAM
        </div>
        {[
          { role: 'VP Engineering', risk: 'HIGH', score: 87, signal: 'LinkedIn activity spike, 3 recruiter connections' },
          { role: 'Head of Sales', risk: 'LOW', score: 23, signal: 'Stable, promoted 2 team members this quarter' },
          { role: 'CFO', risk: 'MED', score: 54, signal: 'Glassdoor sentiment shift detected' },
          { role: 'CTO', risk: 'LOW', score: 18, signal: 'Patent filed, speaking at conference next month' },
        ].map(p => (
          <div key={p.role} style={{
            display: 'grid', gridTemplateColumns: '120px 50px 1fr',
            gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem', alignItems: 'center',
          }}>
            <span style={{ color: 'var(--bone-mid)', fontWeight: 600 }}>{p.role}</span>
            <span style={{
              textAlign: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
              color: p.risk === 'HIGH' ? '#ff5f57' : p.risk === 'MED' ? 'var(--gold)' : 'var(--signal)',
              background: p.risk === 'HIGH' ? 'rgba(255,95,87,0.1)' : p.risk === 'MED' ? 'rgba(212,168,83,0.1)' : 'rgba(78,205,196,0.1)',
            }}>{p.risk}</span>
            <span style={{ color: 'var(--bone-muted)', fontSize: '0.68rem' }}>{p.signal}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState(0)
  const audiences = [
    {
      tab: 'PE Portfolio Companies',
      hero: 'Your competitors are getting AI playbooks at exit.',
      accent: 'Yours already has one.',
      brief: 'Deploy a repeatable AI operating layer across your portfolio. 90-day deployment per portco. Quarterly EBITDA impact report. Scales without adding headcount.',
      stats: [
        { val: '$200K–$400K', desc: 'Annual EBITDA recovery per 100-person portco' },
        { val: '90 days', desc: 'From kickoff to measurable impact' },
        { val: '$3,500/mo', desc: 'Per portco — vs. $50K+ per Big 4 engagement' },
      ],
    },
    {
      tab: 'Growth Companies ($5M–$50M)',
      hero: "Your competitors are still managing.",
      accent: "You're operating.",
      brief: 'The intelligence infrastructure Fortune 500 companies pay half a million a year for — deployed to your business in 90 days. No rip-and-replace. Works on your existing stack.',
      stats: [
        { val: '8–12 hrs', desc: 'Recovered per team member per week' },
        { val: '180+', desc: 'Specialized agents deployed to your business' },
        { val: '$2,500/mo', desc: 'vs. $120K/yr for one junior hire' },
      ],
    },
    {
      tab: 'Solo Operators',
      hero: 'Your competitors hire.',
      accent: 'You compound.',
      brief: '180+ agents working in shifts — revenue intelligence, competitive analysis, outreach — all running before you open your laptop. The leverage of a 20-person team.',
      stats: [
        { val: '24/7', desc: 'Autonomous operation while you focus' },
        { val: '7 days', desc: 'To first intelligence output' },
        { val: '$997/mo', desc: 'Half the cost of one intern' },
      ],
    },
  ]
  const aud = audiences[tab]

  return (
    <>
      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(8,9,12,0.8)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--copper), var(--gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink)',
            }}>O</div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.08em' }}>OWL</span>
          </div>
          <div className="hide-mobile" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            {[
              { label: 'Platform', href: '#platform' },
              { label: 'Solutions', href: '#solutions' },
              { label: 'Results', href: '#results' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: '0.85rem', color: 'var(--bone-mid)', fontWeight: 500 }}>{l.label}</a>
            ))}
            <a href="#contact" style={{
              padding: '9px 22px', borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--copper), var(--gold))',
              color: 'var(--ink)', fontWeight: 700, fontSize: '0.82rem',
            }}>Book a Briefing</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', textAlign: 'center',
        padding: '160px 24px 100px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage: 'linear-gradient(var(--bone-muted) 1px, transparent 1px), linear-gradient(90deg, var(--bone-muted) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(200,98,42,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(78,205,196,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '850px' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '100px',
            background: 'var(--copper-glow)', border: '1px solid rgba(200,98,42,0.2)',
            marginBottom: '32px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--copper)', fontWeight: 600, letterSpacing: '0.08em' }}>
              AI OPERATING SYSTEM — 47 AGENTS ACTIVE
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-sans)', fontSize: 'clamp(2.8rem, 6.5vw, 4.8rem)',
            fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em',
          }}>
            The intelligence layer{' '}
            <span style={{
              background: 'linear-gradient(135deg, var(--copper), var(--gold), var(--signal))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              <TypeWriter words={[
                'your portfolio needs.',
                'your business is missing.',
                'that runs while you sleep.',
                'with auditable EBITDA proof.',
              ]} />
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--bone-mid)',
            maxWidth: '600px', margin: '28px auto 0', lineHeight: 1.7,
          }}>
            OWL deploys 180+ specialized AI agents across your business — revenue intelligence,
            org decomposition, and competitive analysis. Fully managed. Deployed in 90 days.
            Auditable EBITDA attribution from day one.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '40px', flexWrap: 'wrap' }}>
            <a href="#contact" style={{
              padding: '14px 32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--copper), var(--gold))',
              color: 'var(--ink)', fontWeight: 700, fontSize: '0.9rem',
              boxShadow: '0 0 30px rgba(200,98,42,0.2)',
            }}>Book an Intelligence Briefing</a>
            <a href="#platform" style={{
              padding: '14px 32px', borderRadius: '10px',
              border: '1px solid var(--border2)', color: 'var(--bone-mid)',
              fontWeight: 600, fontSize: '0.9rem',
            }}>See the Platform</a>
          </div>
        </div>
      </section>

      {/* ── Social Proof Bar ── */}
      <section style={{ padding: '40px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '48px', flexWrap: 'wrap' }}>
          {[
            { val: '$85M', desc: 'PE portco in deployment' },
            { val: '180+', desc: 'Autonomous agents' },
            { val: '3', desc: 'Patents pending' },
            { val: '90 day', desc: 'Deployment guarantee' },
          ].map(s => (
            <div key={s.desc} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--bone)' }}>{s.val}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--bone-muted)', letterSpacing: '0.08em', marginTop: '4px' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform Showcase ── */}
      <section id="platform" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--copper)',
              fontWeight: 600, letterSpacing: '0.12em',
            }}>THE PLATFORM</span>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
              fontWeight: 800, marginTop: '12px', lineHeight: 1.1,
            }}>
              See what your board sees{' '}
              <span style={{ background: 'linear-gradient(135deg, var(--copper), var(--gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                before they ask.
              </span>
            </h2>
          </div>

          {/* Command Center */}
          <div style={{ marginBottom: '80px', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: '-40px', borderRadius: '24px',
              background: 'radial-gradient(ellipse at center, rgba(200,98,42,0.06) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <CommandCenterMock />
            </div>
          </div>

          {/* Two column: EBITDA + FORGE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            <div>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.12em', fontWeight: 700 }}>EBITDA ATTRIBUTION</span>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.4rem', fontWeight: 700, marginTop: '8px' }}>
                  Patent-pending methodology that traces every agent output to measurable business impact.
                </h3>
              </div>
              <EbitdaMock />
            </div>
            <div>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--signal)', letterSpacing: '0.12em', fontWeight: 700 }}>FORGE — ORG INTELLIGENCE</span>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.4rem', fontWeight: 700, marginTop: '8px' }}>
                  Continuous workforce intelligence. No competitor offers this in managed form.
                </h3>
              </div>
              <ForgeMock />
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Different ── */}
      <section style={{ padding: '120px 24px', background: 'var(--ink2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--copper)', fontWeight: 600, letterSpacing: '0.12em' }}>WHY OWL</span>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 800, marginTop: '12px', marginBottom: '56px', lineHeight: 1.1 }}>
            Not another AI tool you have to manage.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              { title: 'Managed, not DIY', desc: 'Lindy gives you a toolkit. We show up with a running system configured to your business. You don\'t hire someone to manage OWL — OWL manages itself.', accent: 'var(--copper)' },
              { title: 'EBITDA proof, not promises', desc: 'Patent-pending attribution ledger traces agent output to business impact. Your board doesn\'t want "we use AI." They want a number.', accent: 'var(--gold)' },
              { title: 'Org intelligence no one has', desc: 'FORGE decomposes your organization continuously — retention radar, living job descriptions, performance signals. This does not exist anywhere else.', accent: 'var(--signal)' },
              { title: 'Governed, not reckless', desc: '4-tier permission architecture. Quality gate on every output. Values-governed pipeline. Nothing touches your clients without oversight.', accent: 'var(--bone-mid)' },
              { title: 'Compounds over time', desc: 'Every engagement makes the system smarter. The 10th client benefits from the learning of the first 9. A true network effect in intelligence.', accent: 'var(--copper)' },
              { title: 'PE portfolio-ready', desc: 'Deploy once, replicate across portcos. Unified reporting. Quarterly EBITDA impact. Built for hold periods, not demo days.', accent: 'var(--gold)' },
            ].map(c => (
              <div key={c.title} className="glow-card" style={{ padding: '32px 24px' }}>
                <div style={{ width: '3px', height: '24px', background: c.accent, borderRadius: '2px', marginBottom: '16px' }} />
                <h3 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '10px' }}>{c.title}</h3>
                <p style={{ color: 'var(--bone-mid)', fontSize: '0.9rem', lineHeight: 1.7 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solutions / Audience ── */}
      <section id="solutions" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--copper)', fontWeight: 600, letterSpacing: '0.12em' }}>SOLUTIONS</span>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 800, marginTop: '12px', lineHeight: 1.1 }}>
              Built for operators who{' '}
              <span style={{ background: 'linear-gradient(135deg, var(--copper), var(--gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                mean business.
              </span>
            </h2>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '56px', flexWrap: 'wrap' }}>
            {audiences.map((a, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                fontFamily: 'var(--font-sans)', fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: i === tab ? 'linear-gradient(135deg, var(--copper), var(--gold))' : 'var(--ink2)',
                color: i === tab ? 'var(--ink)' : 'var(--bone-mid)',
              }}>{a.tab}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'start' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, lineHeight: 1.12, marginBottom: '8px' }}>
                {aud.hero}
              </h3>
              <h3 style={{
                fontFamily: 'var(--font-sans)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                fontWeight: 800, lineHeight: 1.12, marginBottom: '28px',
                background: 'linear-gradient(135deg, var(--copper), var(--gold))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{aud.accent}</h3>
              <p style={{ color: 'var(--bone-mid)', fontSize: '1.05rem', lineHeight: 1.8 }}>{aud.brief}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {aud.stats.map(s => (
                <div key={s.desc} className="glow-card" style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold)', flexShrink: 0, minWidth: '110px' }}>{s.val}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--bone-mid)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Results / Timeline ── */}
      <section id="results" style={{ padding: '120px 24px', background: 'var(--ink2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--copper)', fontWeight: 600, letterSpacing: '0.12em' }}>90-DAY DEPLOYMENT</span>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 800, marginTop: '12px', lineHeight: 1.1 }}>
              From conversation to{' '}
              <span style={{ background: 'linear-gradient(135deg, var(--copper), var(--gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                measurable impact.
              </span>
            </h2>
            <p style={{ color: 'var(--bone-mid)', marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              90-day deployment or we don't invoice month four.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            {[
              { phase: '01', time: 'Week 1–2', name: 'Decomposition', desc: 'Map every function, workflow, decision point. Build your Canon — the AI equivalent of institutional memory.' },
              { phase: '02', time: 'Week 3–4', name: 'Configuration', desc: 'Agents configured to your specific business. First test outputs appear. Integration with your existing stack.' },
              { phase: '03', time: 'Month 2', name: 'Activation', desc: 'System goes live. Intelligence deliverables within 48 hours. Weekly progress reports begin flowing.' },
              { phase: '04', time: 'Month 3', name: 'Proof', desc: 'EBITDA impact becomes measurable. First quarterly report delivered. Board-ready numbers in hand.' },
            ].map(s => (
              <div key={s.phase} className="glow-card" style={{ padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: '16px', right: '16px',
                  fontFamily: 'var(--font-sans)', fontSize: '3rem', fontWeight: 900,
                  color: 'rgba(200,98,42,0.06)',
                }}>{s.phase}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--copper)', letterSpacing: '0.12em', marginBottom: '4px' }}>{s.time}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '10px' }}>{s.name}</h3>
                <p style={{ color: 'var(--bone-mid)', fontSize: '0.9rem', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="contact" style={{ padding: '140px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(200,98,42,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '650px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px' }}>
            30-minute intelligence briefing.{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--copper), var(--gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              No pitch deck.
            </span>
          </h2>
          <p style={{ color: 'var(--bone-mid)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '36px' }}>
            You'll leave knowing your highest-leverage activation point. If OWL isn't the right fit, we'll tell you.
          </p>
          <a href="mailto:james@moburg.com" style={{
            display: 'inline-block', padding: '16px 48px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--copper), var(--gold))',
            color: 'var(--ink)', fontWeight: 700, fontSize: '1rem',
            boxShadow: '0 0 40px rgba(200,98,42,0.2)',
          }}>Book a Briefing</a>
          <p style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--bone-muted)' }}>
            james@moburg.com
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 20, height: 20, borderRadius: '6px', background: 'linear-gradient(135deg, var(--copper), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: 'var(--ink)' }}>O</div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>OWL</span>
            <span style={{ color: 'var(--bone-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>OvermatchLabs / Mi12 LLC</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--bone-muted)' }}>3 Patents Pending</span>
        </div>
      </footer>
    </>
  )
}
