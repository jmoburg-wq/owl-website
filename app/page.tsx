'use client'

import { useState, useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════
   OWL — The AI Operating System for Business
   Intelligence-grade. PE-ready. Fully managed.
   ═══════════════════════════════════════════════════ */

// ── Simulated live agent data ──
const LIVE_AGENTS = [
  { name: 'ORACLE', status: 'active', task: 'Synthesizing Sunday brief', system: 'Intelligence' },
  { name: 'SENTINEL', status: 'active', task: 'Scanning threat vectors', system: 'Security' },
  { name: 'FORGE-01', status: 'active', task: 'Decomposing org chart', system: 'Operations' },
  { name: 'GRIND', status: 'active', task: 'Prospecting pipeline', system: 'Revenue' },
  { name: 'RADAR', status: 'idle', task: 'Awaiting next scan cycle', system: 'Intelligence' },
  { name: 'DEMING', status: 'active', task: 'Quality gate review', system: 'Quality' },
  { name: 'BLITZ', status: 'active', task: 'Outreach sequence 14', system: 'Revenue' },
  { name: 'CIPHER', status: 'active', task: 'Calibrating message tone', system: 'Comms' },
]

const INTEL_FEED = [
  { time: '06:00', agent: 'GRIND', msg: 'Pipeline built: 14 qualified leads identified' },
  { time: '06:30', agent: 'RADAR', msg: 'Competitor alert: Lindy AI announced enterprise tier' },
  { time: '07:00', agent: 'SENTINEL', msg: 'All systems nominal. Threat level: GREEN' },
  { time: '07:15', agent: 'ORACLE', msg: 'Market synthesis complete. 3 actionable signals.' },
  { time: '07:30', agent: 'FORGE-01', msg: 'Retention risk flagged: Engineering lead, 87% score' },
  { time: '08:00', agent: 'DEMING', msg: 'Quality gate: 4 outputs scored, avg 36/40' },
  { time: '08:15', agent: 'BLITZ', msg: 'Sequence 14 complete. 3 replies, 1 meeting booked' },
  { time: '08:30', agent: 'VERA', msg: 'Morning brief delivered to James via Telegram' },
]

function TypingText({ texts, className = '' }: { texts: string[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [typing, setTyping] = useState(true)

  useEffect(() => {
    const text = texts[index]
    if (typing) {
      if (displayed.length < text.length) {
        const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), 40)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => setTyping(false), 2000)
        return () => clearTimeout(t)
      }
    } else {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 20)
        return () => clearTimeout(t)
      } else {
        setIndex((i) => (i + 1) % texts.length)
        setTyping(true)
      }
    }
  }, [displayed, typing, index, texts])

  return (
    <span className={className}>
      {displayed}
      <span style={{ opacity: 0.6, animation: 'blink 1s step-end infinite' }}>_</span>
    </span>
  )
}

function AgentStatusRow({ agent, delay }: { agent: typeof LIVE_AGENTS[0]; delay: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  if (!show) return null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '100px 70px 1fr 90px',
      gap: '12px', padding: '10px 16px', fontSize: '0.8rem',
      borderBottom: '1px solid rgba(78,205,196,0.06)',
      fontFamily: "'Courier New', monospace", alignItems: 'center',
      animation: 'fadeRow 0.4s ease',
    }}>
      <span style={{ color: '#4ECDC4', fontWeight: 700 }}>{agent.name}</span>
      <span style={{
        color: agent.status === 'active' ? '#4ECDC4' : '#D4A853',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: agent.status === 'active' ? '#4ECDC4' : '#D4A853',
          animation: agent.status === 'active' ? 'pulse 2s infinite' : 'none',
          display: 'inline-block',
        }} />
        {agent.status.toUpperCase()}
      </span>
      <span style={{ color: 'rgba(242,237,228,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.task}</span>
      <span style={{ color: 'rgba(242,237,228,0.3)', textAlign: 'right', fontSize: '0.7rem' }}>{agent.system}</span>
    </div>
  )
}

function IntelFeed() {
  const [visibleCount, setVisibleCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (visibleCount < INTEL_FEED.length) {
      const t = setTimeout(() => setVisibleCount(c => c + 1), 800)
      return () => clearTimeout(t)
    }
  }, [visibleCount])
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [visibleCount])
  return (
    <div ref={containerRef} style={{
      maxHeight: '320px', overflow: 'hidden',
      fontFamily: "'Courier New', monospace", fontSize: '0.78rem',
    }}>
      {INTEL_FEED.slice(0, visibleCount).map((item, i) => (
        <div key={i} style={{
          padding: '8px 0', borderBottom: '1px solid rgba(78,205,196,0.06)',
          animation: 'fadeRow 0.5s ease',
        }}>
          <span style={{ color: 'rgba(242,237,228,0.25)', marginRight: '12px' }}>{item.time}</span>
          <span style={{ color: '#C8622A', fontWeight: 700, marginRight: '12px' }}>[{item.agent}]</span>
          <span style={{ color: 'rgba(242,237,228,0.6)' }}>{item.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ── Simulated Dashboard Cards ──
function DashboardMock() {
  return (
    <div style={{
      background: '#0a0b0e', border: '1px solid rgba(78,205,196,0.15)',
      borderRadius: '12px', overflow: 'hidden', position: 'relative',
    }}>
      {/* Title bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', borderBottom: '1px solid rgba(78,205,196,0.1)',
        background: 'rgba(78,205,196,0.03)',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ECDC4', animation: 'pulse 2s infinite' }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: '#4ECDC4', fontWeight: 700, letterSpacing: '0.1em' }}>
            OWL COMMAND CENTER
          </span>
        </div>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.65rem', color: 'rgba(242,237,228,0.25)' }}>
          LIVE // ALL SYSTEMS OPERATIONAL
        </span>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(78,205,196,0.08)' }}>
        {[
          { label: 'AGENTS ACTIVE', value: '47', change: '+3', color: '#4ECDC4' },
          { label: 'SIGNALS TODAY', value: '128', change: '+14', color: '#C8622A' },
          { label: 'PIPELINE VALUE', value: '$2.4M', change: '+$180K', color: '#D4A853' },
          { label: 'QUALITY SCORE', value: '37/40', change: '', color: '#4ECDC4' },
        ].map((m) => (
          <div key={m.label} style={{
            padding: '20px', borderRight: '1px solid rgba(78,205,196,0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.6rem', color: 'rgba(242,237,228,0.3)', letterSpacing: '0.15em', marginBottom: '8px' }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: m.color, fontWeight: 700 }}>{m.value}</div>
            {m.change && <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.65rem', color: '#4ECDC4', marginTop: '4px' }}>{m.change} this week</div>}
          </div>
        ))}
      </div>

      {/* Two column: Agent roster + Intel feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ borderRight: '1px solid rgba(78,205,196,0.06)' }}>
          <div style={{
            padding: '10px 16px', fontSize: '0.65rem', letterSpacing: '0.15em',
            color: 'rgba(242,237,228,0.3)', fontFamily: "'Courier New', monospace",
            borderBottom: '1px solid rgba(78,205,196,0.06)',
            fontWeight: 700,
          }}>AGENT ROSTER — LIVE STATUS</div>
          {LIVE_AGENTS.map((a, i) => <AgentStatusRow key={a.name} agent={a} delay={i * 200} />)}
        </div>
        <div>
          <div style={{
            padding: '10px 16px', fontSize: '0.65rem', letterSpacing: '0.15em',
            color: 'rgba(242,237,228,0.3)', fontFamily: "'Courier New', monospace",
            borderBottom: '1px solid rgba(78,205,196,0.06)',
            fontWeight: 700,
          }}>INTELLIGENCE FEED — TODAY</div>
          <div style={{ padding: '8px 16px' }}>
            <IntelFeed />
          </div>
        </div>
      </div>
    </div>
  )
}

function EbitdaDashboard() {
  return (
    <div style={{
      background: '#0a0b0e', border: '1px solid rgba(200,98,42,0.2)',
      borderRadius: '12px', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid rgba(200,98,42,0.1)',
        background: 'rgba(200,98,42,0.03)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: '#C8622A', fontWeight: 700, letterSpacing: '0.1em' }}>
          EBITDA ATTRIBUTION LEDGER
        </span>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.65rem', color: 'rgba(242,237,228,0.25)' }}>Q1 2026 // CONFIDENTIAL</span>
      </div>
      <div style={{ padding: '24px 20px' }}>
        {/* Bar chart simulation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { label: 'Revenue Intelligence', value: 142, max: 200, pct: '71%' },
            { label: 'FORGE Retention Saves', value: 89, max: 200, pct: '44%' },
            { label: 'Pipeline Acceleration', value: 167, max: 200, pct: '83%' },
            { label: 'Cost Reduction (FinOps)', value: 54, max: 200, pct: '27%' },
          ].map((bar) => (
            <div key={bar.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.7rem', color: 'rgba(242,237,228,0.5)' }}>{bar.label}</span>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.7rem', color: '#D4A853' }}>${bar.value}K</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(242,237,228,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: bar.pct, borderRadius: '2px',
                  background: 'linear-gradient(90deg, #C8622A, #D4A853)',
                  animation: 'growBar 1.5s ease forwards',
                }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '20px', padding: '16px', background: 'rgba(200,98,42,0.05)',
          border: '1px solid rgba(200,98,42,0.1)', borderRadius: '8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.6rem', color: 'rgba(242,237,228,0.3)', letterSpacing: '0.15em' }}>TOTAL ATTRIBUTED EBITDA IMPACT</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', color: '#D4A853', fontWeight: 700, marginTop: '4px' }}>$452K</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.6rem', color: 'rgba(242,237,228,0.3)', letterSpacing: '0.15em' }}>ANNUALIZED</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: '#4ECDC4', fontWeight: 700 }}>$1.8M</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ForgePanel() {
  return (
    <div style={{
      background: '#0a0b0e', border: '1px solid rgba(78,205,196,0.15)',
      borderRadius: '12px', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid rgba(78,205,196,0.1)',
        background: 'rgba(78,205,196,0.03)',
      }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: '#4ECDC4', fontWeight: 700, letterSpacing: '0.1em' }}>
          FORGE // ORG INTELLIGENCE ENGINE
        </span>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {[
          { role: 'VP Engineering', risk: 'HIGH', score: 87, signal: 'LinkedIn activity spike, 3 recruiter connections added' },
          { role: 'Head of Sales', risk: 'LOW', score: 23, signal: 'Stable engagement, promoted 2 team members' },
          { role: 'CFO', risk: 'MEDIUM', score: 54, signal: 'Glassdoor review sentiment shift detected' },
        ].map((person) => (
          <div key={person.role} style={{
            padding: '12px 0', borderBottom: '1px solid rgba(78,205,196,0.06)',
            display: 'grid', gridTemplateColumns: '140px 70px 1fr', gap: '12px', alignItems: 'start',
          }}>
            <div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'rgba(242,237,228,0.8)', fontWeight: 600 }}>{person.role}</div>
            </div>
            <div style={{
              fontFamily: "'Courier New', monospace", fontSize: '0.65rem', fontWeight: 700,
              color: person.risk === 'HIGH' ? '#e74c3c' : person.risk === 'MEDIUM' ? '#D4A853' : '#4ECDC4',
              padding: '2px 8px', borderRadius: '4px',
              background: person.risk === 'HIGH' ? 'rgba(231,76,60,0.1)' : person.risk === 'MEDIUM' ? 'rgba(212,168,83,0.1)' : 'rgba(78,205,196,0.1)',
              textAlign: 'center',
            }}>
              {person.risk}
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.7rem', color: 'rgba(242,237,228,0.4)', lineHeight: 1.5 }}>
              {person.signal}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{ padding: '120px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>{children}</div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Courier New', monospace", fontSize: '0.65rem',
      fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
      color: '#4ECDC4', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <span style={{ width: '20px', height: '1px', background: '#4ECDC4', display: 'inline-block' }} />
      {children}
    </div>
  )
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0)

  const audiences = [
    {
      id: 'pe',
      tab: 'PE PORTFOLIO',
      headline: 'Your competitors are getting AI playbooks at exit.',
      subhead: 'Yours already has one.',
      brief: 'Deploy a repeatable AI operating layer across your entire portfolio. 90-day deployment per portco. Quarterly EBITDA report. Scales without headcount.',
      stats: [
        { value: '$200K–$400K', label: 'Annual EBITDA recovery per 100-person portco' },
        { value: '90 days', label: 'Full deployment timeline' },
        { value: '3 patents', label: 'Pending IP protection' },
      ],
      objection: 'Big 4 engagement: $50K–$500K for a deck. OWL: $3,500/portco/month for a running system that stays.',
    },
    {
      id: 'smb',
      tab: '$5M–$50M',
      headline: 'Your competitors are still managing.',
      subhead: "You're operating.",
      brief: 'The intelligence layer Fortune 500 companies pay $500K/year for — deployed to your business in 90 days. No rip-and-replace. Works on what you have.',
      stats: [
        { value: '8–12 hrs', label: 'Recovered per team member per week' },
        { value: '180+', label: 'Specialized agents deployed' },
        { value: '$2,500/mo', label: 'vs. $120K/yr for one junior hire' },
      ],
      objection: 'You don\'t need another tool that requires a new hire to manage. You need a system that runs while you sleep.',
    },
    {
      id: 'solo',
      tab: 'OPERATORS',
      headline: 'Your competitors hire.',
      subhead: 'You compound.',
      brief: '180+ agents working in shifts. Revenue intelligence, competitive analysis, outreach — all running before you open your laptop.',
      stats: [
        { value: '24/7', label: 'Autonomous operation' },
        { value: '$997/mo', label: 'Half the cost of one intern' },
        { value: '7 days', label: 'To first intelligence output' },
      ],
      objection: 'The operators who move first set the standard everyone else chases.',
    },
  ]

  const aud = audiences[activeTab]

  return (
    <div className="grain">
      {/* ── Scanline overlay ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        pointerEvents: 'none', zIndex: 9998,
      }} />

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(10,11,14,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(78,205,196,0.08)',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ECDC4', animation: 'pulse 2s infinite' }} />
            <span style={{
              fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 700,
              letterSpacing: '0.15em', color: '#F2EDE4',
            }}>OWL</span>
            <span style={{
              fontFamily: "'Courier New', monospace", fontSize: '0.55rem',
              color: 'rgba(78,205,196,0.4)', letterSpacing: '0.15em', marginLeft: '4px',
            }}>SYSTEMS OPERATIONAL</span>
          </div>
          <div className="hide-mobile" style={{ display: 'flex', gap: '28px', alignItems: 'center', fontSize: '0.78rem' }}>
            {['Intelligence', 'Capabilities', 'Deploy'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{
                color: 'rgba(242,237,228,0.45)', fontFamily: "'Courier New', monospace",
                fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}>{item}</a>
            ))}
            <a href="#contact" style={{
              padding: '8px 20px', border: '1px solid rgba(78,205,196,0.3)',
              color: '#4ECDC4', borderRadius: '4px', fontFamily: "'Courier New', monospace",
              fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              transition: 'all 0.2s',
            }}>REQUEST BRIEFING</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '160px 24px 80px', position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(78,205,196,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(78,205,196,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '30%', right: '10%', width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(78,205,196,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '5%', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(200,98,42,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative' }}>
          <SectionLabel>Managed AI Operating System // Est. 2024</SectionLabel>

          <h1 className="font-serif" style={{
            fontSize: 'clamp(3rem, 7vw, 5.5rem)', lineHeight: 1.05,
            fontWeight: 400, maxWidth: '900px', marginTop: '16px',
          }}>
            The intelligence layer<br />
            <span style={{ color: '#C8622A', fontStyle: 'italic' }}>
              your business is missing.
            </span>
          </h1>

          <div style={{
            marginTop: '40px', maxWidth: '540px',
            fontFamily: "'Courier New', monospace", fontSize: '0.85rem',
            color: 'rgba(242,237,228,0.5)', lineHeight: 1.8,
          }}>
            <TypingText texts={[
              '> Deploying 180+ autonomous agents across revenue, operations, and intelligence...',
              '> EBITDA attribution active. Patent-pending methodology online.',
              '> FORGE org decomposition complete. Retention radar scanning.',
              '> Morning brief compiled. 3 actionable signals detected.',
            ]} />
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '48px' }}>
            <a href="#contact" style={{
              padding: '14px 32px', background: '#C8622A', color: '#F2EDE4',
              borderRadius: '4px', fontFamily: "'Courier New', monospace",
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', transition: 'all 0.2s',
            }}>Request Intelligence Briefing</a>
            <a href="#intelligence" style={{
              padding: '14px 32px', border: '1px solid rgba(242,237,228,0.12)',
              color: 'rgba(242,237,228,0.5)', borderRadius: '4px',
              fontFamily: "'Courier New', monospace", fontSize: '0.75rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>View Live Systems</a>
          </div>
        </div>
      </section>

      {/* ── Live Command Center ── */}
      <Section id="intelligence">
        <SectionLabel>Live System Status</SectionLabel>
        <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, marginBottom: '48px' }}>
          This is what's running <span style={{ color: '#C8622A', fontStyle: 'italic' }}>right now.</span>
        </h2>
        <DashboardMock />
      </Section>

      {/* ── What separates OWL ── */}
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '48px' }}>
          <div>
            <SectionLabel>Why This Is Different</SectionLabel>
            <h2 className="font-serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', lineHeight: 1.15, marginBottom: '32px' }}>
              Not another AI tool.<br />
              <span style={{ color: '#C8622A', fontStyle: 'italic' }}>An operating system.</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { marker: '01', title: 'Managed, not DIY', body: 'Lindy gives you a toolkit. OWL shows up built, configured, and running on your specific business. We are the contractor, not the hardware store.' },
                { marker: '02', title: 'EBITDA attribution, not vibes', body: 'Patent-pending ledger traces every agent output to measurable business impact. Your board doesn\'t want "we use AI." They want a number.' },
                { marker: '03', title: 'Org intelligence no one else has', body: 'FORGE decomposes your organization continuously — living job descriptions, retention radar, performance signals. This product does not exist anywhere else in managed form.' },
                { marker: '04', title: 'Governed, not reckless', body: '4-tier permission architecture. Values-governed output pipeline. Quality gate on every deliverable. Nothing touches your clients without oversight.' },
              ].map((d) => (
                <div key={d.marker} style={{ display: 'flex', gap: '20px' }}>
                  <div style={{
                    fontFamily: "'Courier New', monospace", fontSize: '0.7rem',
                    color: '#C8622A', fontWeight: 700, flexShrink: 0, marginTop: '2px',
                  }}>{d.marker}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>{d.title}</div>
                    <div style={{ color: 'rgba(242,237,228,0.5)', fontSize: '0.9rem', lineHeight: 1.7 }}>{d.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <EbitdaDashboard />
            <ForgePanel />
          </div>
        </div>
      </Section>

      {/* ── Capabilities ── */}
      <Section id="capabilities">
        <SectionLabel>Intelligence Architecture</SectionLabel>
        <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, marginBottom: '56px' }}>
          Seven systems. One mission.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1px', background: 'rgba(78,205,196,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          {[
            { code: 'ORACLE', name: 'Strategic Intelligence', desc: '7-agent adversarial synthesis. Sees what one analyst can\'t.' },
            { code: 'FORGE', name: 'Org Decomposition', desc: 'Living org chart. Retention radar. Performance signals. No equivalent exists.' },
            { code: 'GRIND', name: 'Revenue Engine', desc: 'Pipeline building, lead scoring, outreach sequencing. Running by 6am.' },
            { code: 'SENTINEL', name: 'Threat Detection', desc: 'Daily health scans. Weekly threat briefs. Anomaly detection across all systems.' },
            { code: 'DEMING', name: 'Quality Assurance', desc: 'Every output scored before delivery. Continuous improvement across the OS.' },
            { code: 'RADAR', name: 'Competitive Intelligence', desc: 'Monthly landscape scans. Competitor pricing, funding, and feature tracking.' },
          ].map((sys) => (
            <div key={sys.code} style={{
              background: '#0a0b0e', padding: '32px 28px',
            }}>
              <div style={{
                fontFamily: "'Courier New', monospace", fontSize: '0.65rem',
                color: '#4ECDC4', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '12px',
              }}>{sys.code}</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>{sys.name}</div>
              <div style={{ color: 'rgba(242,237,228,0.45)', fontSize: '0.88rem', lineHeight: 1.7 }}>{sys.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Audience Dossiers ── */}
      <Section id="deploy">
        <SectionLabel>Deployment Profiles</SectionLabel>
        <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, marginBottom: '48px' }}>
          Select your profile.
        </h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '40px', borderBottom: '1px solid rgba(78,205,196,0.1)' }}>
          {audiences.map((a, i) => (
            <button key={a.id} onClick={() => setActiveTab(i)} style={{
              padding: '14px 28px', background: 'none', border: 'none',
              fontFamily: "'Courier New', monospace", fontSize: '0.72rem',
              letterSpacing: '0.12em', cursor: 'pointer',
              color: i === activeTab ? '#4ECDC4' : 'rgba(242,237,228,0.3)',
              borderBottom: i === activeTab ? '2px solid #4ECDC4' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>{a.tab}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px' }}>
          <div>
            <h3 className="font-serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', lineHeight: 1.15, marginBottom: '8px' }}>
              {aud.headline}
            </h3>
            <h3 className="font-serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', lineHeight: 1.15, color: '#C8622A', fontStyle: 'italic', marginBottom: '28px' }}>
              {aud.subhead}
            </h3>
            <p style={{ color: 'rgba(242,237,228,0.55)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '32px' }}>{aud.brief}</p>
            <div style={{
              padding: '16px 20px', background: 'rgba(200,98,42,0.05)',
              border: '1px solid rgba(200,98,42,0.15)', borderRadius: '6px',
              fontFamily: "'Courier New', monospace", fontSize: '0.8rem',
              color: 'rgba(242,237,228,0.5)', lineHeight: 1.7, fontStyle: 'italic',
            }}>
              {aud.objection}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {aud.stats.map((s) => (
              <div key={s.label} style={{
                background: '#0a0b0e', border: '1px solid rgba(78,205,196,0.1)',
                borderRadius: '8px', padding: '28px 24px',
              }}>
                <div className="font-serif" style={{ fontSize: '2rem', color: '#D4A853', fontWeight: 700, marginBottom: '6px' }}>{s.value}</div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.7rem', color: 'rgba(242,237,228,0.35)', letterSpacing: '0.08em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Timeline ── */}
      <Section>
        <SectionLabel>Deployment Protocol</SectionLabel>
        <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, marginBottom: '56px' }}>
          90 days to measurable impact.<br />
          <span style={{ color: 'rgba(242,237,228,0.3)', fontSize: '0.5em', fontFamily: "'Courier New', monospace", fontStyle: 'normal', letterSpacing: '0.1em' }}>
            OR WE DON'T INVOICE MONTH FOUR.
          </span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1px', background: 'rgba(78,205,196,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          {[
            { phase: 'PHASE 1', time: 'Week 1–2', name: 'Decomposition', desc: 'Map every function, workflow, and decision point. Build the Canon. No agent output yet.' },
            { phase: 'PHASE 2', time: 'Week 3–4', name: 'Configuration', desc: 'Agents configured to your business. First test outputs. Rough edges smoothed.' },
            { phase: 'PHASE 3', time: 'Month 2', name: 'Activation', desc: 'System live. Intelligence deliverables within 48 hours. Weekly progress reports begin.' },
            { phase: 'PHASE 4', time: 'Month 3', name: 'Proof', desc: 'EBITDA impact measured. Quarterly report delivered. Board-ready numbers.' },
          ].map((step) => (
            <div key={step.phase} style={{ background: '#0a0b0e', padding: '32px 28px' }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.6rem', color: '#4ECDC4', letterSpacing: '0.15em', marginBottom: '4px' }}>{step.phase}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.7rem', color: 'rgba(242,237,228,0.3)', marginBottom: '12px' }}>{step.time}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>{step.name}</div>
              <div style={{ color: 'rgba(242,237,228,0.45)', fontSize: '0.88rem', lineHeight: 1.7 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA ── */}
      <section id="contact" style={{
        padding: '140px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(200,98,42,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <SectionLabel>Initiate Contact</SectionLabel>
          <h2 className="font-serif" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', lineHeight: 1.1, marginBottom: '24px' }}>
            30-minute intelligence briefing.<br />
            <span style={{ color: '#C8622A', fontStyle: 'italic' }}>No pitch deck.</span>
          </h2>
          <p style={{ color: 'rgba(242,237,228,0.5)', fontSize: '1rem', lineHeight: 1.7, marginBottom: '40px' }}>
            You'll leave knowing your highest-leverage activation point. If OWL isn't the right fit, we'll tell you. Classified until you say otherwise.
          </p>
          <a href="mailto:james@moburg.com" style={{
            display: 'inline-block', padding: '16px 48px',
            background: '#C8622A', color: '#F2EDE4', borderRadius: '4px',
            fontFamily: "'Courier New', monospace", fontSize: '0.8rem',
            fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>REQUEST BRIEFING</a>
          <div style={{
            marginTop: '24px', fontFamily: "'Courier New', monospace",
            fontSize: '0.7rem', color: 'rgba(242,237,228,0.25)', letterSpacing: '0.1em',
          }}>james@moburg.com // OvermatchLabs / Mi12 LLC</div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(78,205,196,0.06)', padding: '24px' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ECDC4' }} />
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.65rem', color: 'rgba(242,237,228,0.25)', letterSpacing: '0.1em' }}>
              OWL // ALL SYSTEMS OPERATIONAL
            </span>
          </div>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.6rem', color: 'rgba(242,237,228,0.15)', letterSpacing: '0.1em' }}>
            3 PATENTS PENDING // CONFIDENTIAL
          </span>
        </div>
      </footer>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes fadeRow { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes growBar { from { width: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
