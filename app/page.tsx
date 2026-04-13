'use client'

import { useState } from 'react'

/* ─────────────────────────────────────────────
   OWL — The AI Operating System for Business
   ───────────────────────────────────────────── */

const CAPABILITIES = [
  {
    icon: '⚡',
    title: 'Revenue Intelligence',
    desc: 'Daily lead prioritization, deal stall detection, text-to-qualify flows, and pipeline forecasting that runs while you sleep.',
  },
  {
    icon: '🏗',
    title: 'FORGE — Org Intelligence',
    desc: 'Continuous org decomposition, living job descriptions, retention radar, and performance signals. No competitor offers this managed.',
  },
  {
    icon: '📊',
    title: 'EBITDA Attribution',
    desc: 'Patent-pending methodology that traces AI agent output directly to measurable EBITDA impact. LP-grade reporting every quarter.',
  },
  {
    icon: '🛡',
    title: 'Governed Autonomy',
    desc: 'Every agent operates within a 4-tier permission system. Values-governed output pipeline ensures nothing ships without oversight.',
  },
  {
    icon: '🔄',
    title: 'Compound Intelligence',
    desc: 'Every engagement makes the system smarter. The 10th client benefits from the learning of the first 9. A network effect in intelligence.',
  },
  {
    icon: '🎯',
    title: 'Competitive Intelligence',
    desc: 'Weekly market monitoring, threat detection, and positioning analysis. Know what your competitors are doing before they announce it.',
  },
]

const HOW_IT_WORKS = [
  {
    week: 'Week 1–2',
    title: 'Decomposition',
    desc: 'We map your organization — every function, every workflow, every decision point. No agent output yet. This is the foundation.',
  },
  {
    week: 'Week 3–4',
    title: 'Configuration',
    desc: 'Agents are configured to your business. First test outputs appear. Rough edges get smoothed. Your Canon gets built.',
  },
  {
    week: 'Month 2',
    title: 'Go Live',
    desc: 'System goes live. First intelligence deliverables within 48 hours. Weekly progress reports begin. Agents start compounding.',
  },
  {
    week: 'Month 3',
    title: 'Proof',
    desc: 'EBITDA impact becomes measurable. First quarterly report delivered. You see the numbers. Your board sees the numbers.',
  },
]

const PERSONAS = [
  {
    id: 'pe',
    label: 'PE Firms',
    headline: 'Your competitors are getting AI playbooks at exit. Yours already has one.',
    problems: [
      'Board asks about AI at every meeting — no coordinated answer',
      'Each portco doing something different with AI — nothing repeatable',
      'Paying consultants $200K for decks that collect dust',
      'Hold period ending before EBITDA impact materializes',
    ],
    solution:
      'OWL deploys a repeatable AI operating layer across your portfolio — 90-day deployment, quarterly EBITDA report, scales without headcount.',
    metric: '$200K–$400K annual EBITDA recovery within 90 days for a 100-person company',
    price: 'From $3,500/portco/month',
    anchor: 'vs. $50K–$500K per Big 4 engagement',
  },
  {
    id: 'smb',
    label: '$5M–$50M Companies',
    headline: "Your competitors are still managing. You're operating.",
    problems: [
      'Outgrown spreadsheets but not ready for enterprise software',
      'Watching faster competitors and can\'t figure out what they\'re doing',
      'Every AI tool requires a new hire to manage it',
      'Paying enterprise prices for tools built for companies 10x your size',
    ],
    solution:
      'The intelligence layer Fortune 500 companies pay $500K/year for — deployed to your business in 90 days at a fraction of the cost.',
    metric: '8–12 hours recovered per team member per week',
    price: 'From $2,500/month',
    anchor: 'vs. $60K–$120K/year for one junior hire',
  },
  {
    id: 'solo',
    label: 'Solo Operators',
    headline: 'Your competitors hire. You compound.',
    problems: [
      'Running five things at once — weekends spent catching up',
      'Outcompeted by people with bigger teams and more resources',
      'Trapped in the operational layer — can\'t do strategic work',
      'Every new tool adds complexity instead of removing it',
    ],
    solution:
      'OWL gives you 180+ agents working in shifts. Your attention goes only to the decisions only you can make.',
    metric: 'The leverage of a 20-person team without the overhead',
    price: 'From $997/month',
    anchor: 'vs. $75K+/year for your first hire',
  },
]

const PRICING = [
  {
    tier: 'Intelligence Suite',
    price: '$500',
    period: '/month',
    desc: 'Entry point. Low risk. Immediate value.',
    features: [
      'Weekly competitive landscape report',
      'Market signal monitoring',
      'Venture health scores',
      'Sunday synthesis brief',
    ],
    cta: 'Start Here',
    highlight: false,
  },
  {
    tier: 'Revenue Acceleration',
    price: '$299',
    period: '/team/month',
    desc: 'Revenue intelligence on top of your existing CRM.',
    features: [
      'Daily lead prioritization (top 3)',
      'Context loading before every call',
      'Outreach drafting + compliance',
      'Deal stall detection',
      'Text-to-qualify flow',
      'Weekly pipeline report',
    ],
    cta: 'Accelerate Revenue',
    highlight: false,
  },
  {
    tier: 'FORGE',
    price: '$2,500',
    period: '/month',
    desc: 'Workforce intelligence. No competitor offers this.',
    features: [
      'Org decomposition map',
      'Living job descriptions',
      'Performance signal detection',
      'Retention radar',
      'Onboarding playbooks',
      'Development plans',
    ],
    cta: 'Deploy FORGE',
    highlight: true,
  },
  {
    tier: 'Enterprise OS',
    price: '$3,500',
    period: '/month',
    desc: 'Full AI operating system. Every agent team.',
    features: [
      'Everything in all tiers',
      'Full Canon build + configuration',
      'All agent teams deployed',
      'Quarterly EBITDA impact report',
      'PE portfolio pricing available',
      '90-day deployment guarantee',
    ],
    cta: 'Talk to James',
    highlight: false,
  },
]

const COMPARISONS = [
  { name: 'OWL', managed: true, org: true, ebitda: true, pe: true, guarantee: true, price: '$500/mo' },
  { name: 'Lindy AI', managed: false, org: false, ebitda: false, pe: false, guarantee: false, price: '$50/mo DIY' },
  { name: '11x.ai', managed: false, org: false, ebitda: false, pe: false, guarantee: true, price: '$5K/mo' },
  { name: 'Copilot', managed: false, org: false, ebitda: false, pe: false, guarantee: false, price: '$30/user/mo' },
  { name: 'Big 4', managed: false, org: false, ebitda: false, pe: true, guarantee: false, price: '$50K+' },
]

function Section({ children, id, className = '' }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`section-padding ${className}`}>
      <div className="container">{children}</div>
    </section>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 16px',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--copper)',
        border: '1px solid var(--copper)',
        borderRadius: '100px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </span>
  )
}

export default function HomePage() {
  const [activePersona, setActivePersona] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const persona = PERSONAS[activePersona]

  return (
    <div className="grain">
      {/* ── Nav ── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'rgba(15, 16, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
          }}
        >
          <a href="#" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em' }}>
            OWL
          </a>
          <div className="hide-mobile" style={{ display: 'flex', gap: '32px', alignItems: 'center', fontSize: '0.875rem', fontWeight: 500 }}>
            <a href="#what" style={{ color: 'var(--bone-mid)', transition: 'color 0.2s' }}>What</a>
            <a href="#capabilities" style={{ color: 'var(--bone-mid)', transition: 'color 0.2s' }}>Capabilities</a>
            <a href="#who" style={{ color: 'var(--bone-mid)', transition: 'color 0.2s' }}>Who It's For</a>
            <a href="#pricing" style={{ color: 'var(--bone-mid)', transition: 'color 0.2s' }}>Pricing</a>
            <a href="#how" style={{ color: 'var(--bone-mid)', transition: 'color 0.2s' }}>How It Works</a>
            <a
              href="#contact"
              style={{
                padding: '10px 24px',
                background: 'var(--copper)',
                color: 'var(--bone)',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Talk to James
            </a>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              color: 'var(--bone)',
              fontSize: '1.5rem',
              cursor: 'pointer',
            }}
            className="mobile-menu-btn"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
        {mobileMenuOpen && (
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '1rem' }}>
            <a href="#what" onClick={() => setMobileMenuOpen(false)}>What</a>
            <a href="#capabilities" onClick={() => setMobileMenuOpen(false)}>Capabilities</a>
            <a href="#who" onClick={() => setMobileMenuOpen(false)}>Who It's For</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#how" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--copper)' }}>Talk to James</a>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '140px 24px 100px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(200,98,42,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Badge>The AI Operating System</Badge>
        <h1
          className="font-serif"
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            lineHeight: 1.1,
            marginTop: '32px',
            maxWidth: '900px',
            fontWeight: 400,
          }}
        >
          Your competitors are still managing.{' '}
          <span className="text-copper" style={{ fontStyle: 'italic' }}>
            You're operating.
          </span>
        </h1>
        <p
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: 'var(--bone-mid)',
            maxWidth: '680px',
            marginTop: '28px',
            lineHeight: 1.7,
          }}
        >
          OWL deploys 180+ specialized AI agents across your business — revenue intelligence,
          org decomposition, competitive analysis, and sales acceleration. Fully managed.
          Deployed in 90 days. Zero added headcount.
        </p>
        <div style={{ display: 'flex', gap: '16px', marginTop: '48px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href="#contact"
            style={{
              padding: '16px 36px',
              background: 'var(--copper)',
              color: 'var(--bone)',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            See What OWL Removes From Your Plate
          </a>
          <a
            href="#what"
            style={{
              padding: '16px 36px',
              border: '1px solid var(--border2)',
              color: 'var(--bone-mid)',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            How It Works
          </a>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: '1px', height: '48px', background: 'linear-gradient(to bottom, var(--copper), transparent)' }} />
        </div>
      </section>

      {/* ── What OWL Is ── */}
      <Section id="what">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '64px', alignItems: 'center' }}>
          <div>
            <Badge>Not a tool. An operating system.</Badge>
            <h2
              className="font-serif"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '24px', lineHeight: 1.15 }}
            >
              The infrastructure layer that{' '}
              <span className="text-copper" style={{ fontStyle: 'italic' }}>runs your business</span>
            </h2>
            <p style={{ color: 'var(--bone-mid)', marginTop: '24px', lineHeight: 1.8, fontSize: '1.05rem' }}>
              OWL is to your business what an operating system is to a computer. It doesn't run one
              program at a time. It runs everything simultaneously — allocates resources, manages
              intelligence, and restores from failures — while you focus on what only you can do.
            </p>
            <p style={{ color: 'var(--bone-mid)', marginTop: '16px', lineHeight: 1.8, fontSize: '1.05rem' }}>
              The closest comparison is the Big 4 — except OWL delivers a running system in 90 days
              instead of a deck in 6 months. At 1/10th the cost. And it stays.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { num: '180+', label: 'Specialized Agents' },
              { num: '90', label: 'Day Deployment' },
              { num: '7', label: 'Intelligence Systems' },
              { num: '24/7', label: 'Autonomous Operation' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: 'var(--ink2)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '32px 24px',
                  textAlign: 'center',
                }}
              >
                <div className="font-serif text-copper" style={{ fontSize: '2.5rem', fontWeight: 700 }}>
                  {s.num}
                </div>
                <div style={{ color: 'var(--bone-mid)', fontSize: '0.85rem', marginTop: '8px', fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── The Gap ── */}
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <Badge>The Market Gap</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', marginTop: '24px', lineHeight: 1.2 }}>
            Every AI product makes you build it yourself.{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>OWL shows up built.</span>
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            marginTop: '56px',
          }}
        >
          {[
            {
              gap: 'No managed AI OS at SMB price points',
              detail: 'Lindy and Relevance require you to build it. Enterprise platforms require 300+ seats. OWL is fully managed for companies under $50M.',
            },
            {
              gap: 'No org intelligence as a monthly service',
              detail: 'FORGE — continuous org decomposition, retention radar, living job descriptions — has zero direct competitors in managed form.',
            },
            {
              gap: 'No PE portfolio deployment layer',
              detail: 'No product deploys a repeatable AI playbook across multiple portcos with unified EBITDA reporting. OWL is the first.',
            },
          ].map((g) => (
            <div
              key={g.gap}
              style={{
                background: 'var(--ink2)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '36px 28px',
              }}
            >
              <div className="text-signal" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Uncontested
              </div>
              <h3 className="font-serif" style={{ fontSize: '1.25rem', marginTop: '12px', lineHeight: 1.3 }}>
                {g.gap}
              </h3>
              <p style={{ color: 'var(--bone-mid)', fontSize: '0.95rem', marginTop: '12px', lineHeight: 1.7 }}>
                {g.detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Capabilities ── */}
      <Section id="capabilities">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <Badge>Capabilities</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '24px', lineHeight: 1.15 }}>
            Six intelligence layers.{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>One operating system.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              style={{
                background: 'var(--ink2)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '36px 28px',
                transition: 'border-color 0.3s',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '16px' }}>{c.icon}</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>{c.title}</h3>
              <p style={{ color: 'var(--bone-mid)', fontSize: '0.95rem', lineHeight: 1.7 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Who It's For (Personas) ── */}
      <Section id="who">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Badge>Who It's For</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '24px', lineHeight: 1.15 }}>
            Built for operators who{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>mean business</span>
          </h2>
        </div>

        {/* Persona tabs */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '48px', flexWrap: 'wrap' }}>
          {PERSONAS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePersona(i)}
              style={{
                padding: '12px 28px',
                borderRadius: '100px',
                border: i === activePersona ? '1px solid var(--copper)' : '1px solid var(--border2)',
                background: i === activePersona ? 'var(--copper-dim)' : 'transparent',
                color: i === activePersona ? 'var(--copper)' : 'var(--bone-mid)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Persona content */}
        <div
          key={persona.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '48px',
            alignItems: 'start',
            animation: 'fade-in 0.5s ease',
          }}
        >
          <div>
            <h3
              className="font-serif"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', lineHeight: 1.2, marginBottom: '28px' }}
            >
              {persona.headline}
            </h3>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bone-mid)', marginBottom: '16px' }}>
                Problems We Solve
              </div>
              {persona.problems.map((prob) => (
                <div
                  key={prob}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                    color: 'var(--bone-mid)',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                  }}
                >
                  <span className="text-copper" style={{ flexShrink: 0, marginTop: '2px' }}>&#x2192;</span>
                  {prob}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div
              style={{
                background: 'var(--ink2)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '36px 28px',
              }}
            >
              <p style={{ fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '24px' }}>{persona.solution}</p>
              <div
                style={{
                  background: 'var(--copper-dim)',
                  border: '1px solid rgba(200,98,42,0.2)',
                  borderRadius: '10px',
                  padding: '20px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--copper)', marginBottom: '6px' }}>
                  Expected Impact
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{persona.metric}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span className="font-serif text-copper" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {persona.price}
                  </span>
                </div>
                <div style={{ color: 'var(--bone-mid)', fontSize: '0.85rem' }}>{persona.anchor}</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── How It Works ── */}
      <Section id="how">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <Badge>90-Day Deployment</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '24px', lineHeight: 1.15 }}>
            From conversation to{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>measurable EBITDA impact</span>
          </h2>
          <p style={{ color: 'var(--bone-mid)', marginTop: '16px', fontSize: '1.05rem' }}>
            90-day deployment or we don't invoice month four.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.title}
              style={{
                position: 'relative',
                background: 'var(--ink2)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '36px 28px',
              }}
            >
              <div className="text-copper" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {step.week}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '12px 0' }}>{step.title}</h3>
              <p style={{ color: 'var(--bone-mid)', fontSize: '0.95rem', lineHeight: 1.7 }}>{step.desc}</p>
              {i < HOW_IT_WORKS.length - 1 && (
                <div
                  className="hide-mobile"
                  style={{
                    position: 'absolute',
                    right: '-14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--copper)',
                    fontSize: '1.2rem',
                    zIndex: 2,
                  }}
                >
                  &#x2192;
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pricing ── */}
      <Section id="pricing">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <Badge>Pricing</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '24px', lineHeight: 1.15 }}>
            Land small.{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>Expand with proof.</span>
          </h2>
          <p style={{ color: 'var(--bone-mid)', marginTop: '16px', fontSize: '1.05rem' }}>
            Every tier delivers standalone value. The 3x minimum value ratio is non-negotiable.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {PRICING.map((p) => (
            <div
              key={p.tier}
              style={{
                background: p.highlight ? 'var(--ink3)' : 'var(--ink2)',
                border: p.highlight ? '1px solid var(--copper)' : '1px solid var(--border)',
                borderRadius: '16px',
                padding: '36px 28px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {p.highlight && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--copper)',
                    color: 'var(--bone)',
                    padding: '4px 16px',
                    borderRadius: '100px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  No Competitor
                </div>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{p.tier}</h3>
              <div style={{ margin: '16px 0' }}>
                <span className="font-serif text-copper" style={{ fontSize: '2.5rem', fontWeight: 700 }}>
                  {p.price}
                </span>
                <span style={{ color: 'var(--bone-mid)', fontSize: '0.9rem' }}>{p.period}</span>
              </div>
              <p style={{ color: 'var(--bone-mid)', fontSize: '0.9rem', marginBottom: '20px' }}>{p.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
                {p.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                      color: 'var(--bone-mid)',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <span className="text-signal" style={{ flexShrink: 0 }}>&#x2713;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '14px',
                  marginTop: '24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  background: p.highlight ? 'var(--copper)' : 'transparent',
                  color: p.highlight ? 'var(--bone)' : 'var(--copper)',
                  border: p.highlight ? 'none' : '1px solid var(--copper)',
                }}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Comparison ── */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Badge>Comparison</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', marginTop: '24px', lineHeight: 1.2 }}>
            OWL vs. everything else
          </h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              minWidth: '640px',
            }}
          >
            <thead>
              <tr>
                {['', 'Managed', 'Org Intel', 'EBITDA Proof', 'PE-Ready', 'Guarantee', 'Entry Price'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--border2)',
                      color: 'var(--bone-mid)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISONS.map((c) => (
                <tr
                  key={c.name}
                  style={{
                    background: c.name === 'OWL' ? 'var(--copper-dim)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: c.name === 'OWL' ? 700 : 400, borderBottom: '1px solid var(--border)' }}>
                    {c.name}
                  </td>
                  {[c.managed, c.org, c.ebitda, c.pe, c.guarantee].map((v, i) => (
                    <td
                      key={i}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border)',
                        color: v ? 'var(--signal)' : 'rgba(242,237,228,0.25)',
                      }}
                    >
                      {v ? '✓' : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--bone-mid)' }}>
                    {c.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Architecture (from docs) ── */}
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div>
            <Badge>Architecture</Badge>
            <h2 className="font-serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', marginTop: '24px', lineHeight: 1.2 }}>
              Governed. Self-calibrating.{' '}
              <span className="text-copper" style={{ fontStyle: 'italic' }}>Self-scheduling.</span>
            </h2>
            <p style={{ color: 'var(--bone-mid)', marginTop: '20px', lineHeight: 1.8, fontSize: '1.05rem' }}>
              OWL isn't a collection of AI tools duct-taped together. It's a single architecture
              where every agent operates within a governed permission system, every output passes
              through a quality gate, and every result gets attributed to measurable business impact.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            {[
              { label: 'Agent Governance', detail: '4-tier permission system — from fully autonomous to James-only decisions' },
              { label: 'Quality Gate', detail: 'Every output scored 0–40 before it ships. Nothing goes out unchecked.' },
              { label: 'Signal Bus', detail: 'Every agent output routes to downstream agents automatically. Knowledge compounds.' },
              { label: 'Canon System', detail: 'Living organizational knowledge base. Every engagement gets a Canon — the AI equivalent of institutional memory.' },
            ].map((a) => (
              <div
                key={a.label}
                style={{
                  background: 'var(--ink2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '24px',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>{a.label}</div>
                <div style={{ color: 'var(--bone-mid)', fontSize: '0.9rem', lineHeight: 1.6 }}>{a.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── IP / Moat ── */}
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <Badge>Defensible</Badge>
          <h2 className="font-serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', marginTop: '24px', lineHeight: 1.2 }}>
            3 patents pending.{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>A moat that compounds.</span>
          </h2>
          <p style={{ color: 'var(--bone-mid)', marginTop: '20px', fontSize: '1.05rem', lineHeight: 1.7 }}>
            Most AI products aren't patentable — they're applications of existing models. OWL introduces
            novel architectures for governing, attributing value to, and operationalizing AI agents in
            enterprise environments.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '48px',
          }}
        >
          {[
            { title: 'Agent Action Firewall', desc: 'Governance layer for AI agent output control' },
            { title: 'EBITDA Attribution Ledger', desc: 'Tracing AI value to business operations' },
            { title: 'Canon-to-Policy Compiler', desc: 'Org knowledge to enforceable agent rules' },
          ].map((p) => (
            <div
              key={p.title}
              style={{
                background: 'var(--ink2)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '28px 24px',
                textAlign: 'center',
              }}
            >
              <div className="text-gold" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                Patent Pending
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>{p.title}</h4>
              <p style={{ color: 'var(--bone-mid)', fontSize: '0.85rem', lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA ── */}
      <section
        id="contact"
        style={{
          padding: '120px 24px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(200,98,42,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div className="container" style={{ position: 'relative' }}>
          <h2
            className="font-serif"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.15,
              maxWidth: '700px',
              margin: '0 auto',
            }}
          >
            30-minute conversation.{' '}
            <span className="text-copper" style={{ fontStyle: 'italic' }}>No pitch deck.</span>
          </h2>
          <p style={{ color: 'var(--bone-mid)', marginTop: '20px', fontSize: '1.1rem', maxWidth: '550px', margin: '20px auto 0' }}>
            You'll leave knowing your highest-leverage activation point. If OWL isn't the right fit,
            we'll tell you.
          </p>
          <a
            href="mailto:james@moburg.com"
            style={{
              display: 'inline-block',
              marginTop: '40px',
              padding: '18px 48px',
              background: 'var(--copper)',
              color: 'var(--bone)',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'transform 0.2s',
            }}
          >
            Talk to James
          </a>
          <p style={{ color: 'var(--bone-mid)', marginTop: '16px', fontSize: '0.85rem' }}>
            james@moburg.com
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '40px 24px',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <span className="font-serif" style={{ fontWeight: 700, letterSpacing: '0.08em' }}>OWL</span>
            <span style={{ color: 'var(--bone-mid)', fontSize: '0.85rem', marginLeft: '16px' }}>
              OvermatchLabs / Mi12 LLC
            </span>
          </div>
          <div style={{ color: 'var(--bone-mid)', fontSize: '0.8rem' }}>
            The AI Operating System for Business. Confidential.
          </div>
        </div>
      </footer>

      {/* ── Mobile menu button visibility ── */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </div>
  )
}
