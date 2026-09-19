import { useEffect, useRef, useState, useId } from 'react'
import './Landing.css'

import heroSecurityRadarImg from './assets/hero_security_radar.jpg'
import pipelineAiNeuralImg from './assets/pipeline_ai_neural.jpg'
import dashboardAnalyticsPreviewImg from './assets/dashboard_analytics_preview.jpg'
import enterpriseTrustShieldImg from './assets/enterprise_trust_shield.jpg'

function AnimatedStat({ target, decimals = 0, prefix = '', suffix = '', label, sublabel }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const hasRun = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasRun.current) {
            hasRun.current = true
            const duration = 1400
            const start = performance.now()

            function tick(now) {
              const progress = Math.min((now - start) / duration, 1)
              const eased = 1 - Math.pow(1 - progress, 3)
              setValue(target * eased)
              if (progress < 1) {
                requestAnimationFrame(tick)
              }
            }
            requestAnimationFrame(tick)
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  const display =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString()

  return (
    <div className="stat-card" ref={ref}>
      <div className="stat-card-glow" />
      <div className="stat-val">
        {prefix}{display}{suffix}
      </div>
      <div className="stat-lbl">{label}</div>
      {sublabel && <div className="stat-sub">{sublabel}</div>}
    </div>
  )
}

const SAMPLE_TRANSACTIONS = [
  {
    id: 'TXN-88420',
    title: 'Low-Risk Everyday Purchase',
    description: 'Local coffee shop tap payment within regular cardholder geography.',
    amount: '$4.75',
    timeDelta: '09:14 AM (Normal Hours)',
    riskProbability: 0.024,
    status: 'LEGIT',
    statusClass: 'status-legit',
    confidence: '99.8% Legitimate',
    topSignals: ['Matches historical velocity', 'Standard merchant category', 'Zero geographic deviation']
  },
  {
    id: 'TXN-91204',
    title: 'Anomalous Midnight Velocity Spike',
    description: 'High-value electronics purchased at 3:12 AM with anomalous PCA vectors.',
    amount: '$1,850.00',
    timeDelta: '03:12 AM (Abnormal Window)',
    riskProbability: 0.912,
    status: 'FLAGGED FRAUD',
    statusClass: 'status-fraud',
    confidence: '91.2% Risk Score',
    topSignals: ['Severe V14 & V17 feature deviation', 'Velocity exceeds 99th percentile', 'High single transaction amount']
  },
  {
    id: 'TXN-74192',
    title: 'Borderline High-Frequency Micropay',
    description: 'Multiple consecutive $1.20 test charges across differing digital merchants.',
    amount: '$1.20',
    timeDelta: '01:42 AM (Repeated Burst)',
    riskProbability: 0.638,
    status: 'MANUAL REVIEW',
    statusClass: 'status-review',
    confidence: '63.8% Escalation',
    topSignals: ['Card-testing pattern detected', 'Rapid interval sequence', 'Sub-threshold amount clustering']
  }
]

export default function Landing({ onLaunch }) {
  const [selectedTxn, setSelectedTxn] = useState(SAMPLE_TRANSACTIONS[1])
  const [monthlyTxns, setMonthlyTxns] = useState(120000)
  const [avgTicket, setAvgTicket] = useState(85)
  const monthlyTxnsInputId = useId()
  const avgTicketInputId = useId()

  useEffect(() => {
    const sections = document.querySelectorAll('.landing .section-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // ROI calculations: standard e-commerce fraud rate ~ 0.17%, model catches ~92%
  const monthlyTotalVolume = monthlyTxns * avgTicket
  const estimatedFraudVolume = monthlyTotalVolume * 0.0017
  const estimatedMonthlySavings = estimatedFraudVolume * 0.92
  const estimatedAnnualSavings = estimatedMonthlySavings * 12

  return (
    <div className="landing">
      {/* Dynamic Background Mesh */}
      <div className="landing-bg-glow glow-top" aria-hidden="true" />
      <div className="landing-bg-glow glow-middle" aria-hidden="true" />
      <div className="landing-bg-glow glow-bottom" aria-hidden="true" />

      {/* Navigation */}
      <header className="landing-header">
        <nav className="shell landing-nav">
          <div className="nav-brand">
            <div className="brand-badge">
              <span className="brand-dot-pulse" />
              <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">Fraud Radar</span>
              <span className="brand-subtitle">AI Risk Engine</span>
            </div>
          </div>

          <div className="nav-links">
            <a href="#simulator" className="nav-link">Live Simulator</a>
            <a href="#pipeline" className="nav-link">AI Pipeline</a>
            <a href="#features" className="nav-link">Capabilities</a>
            <a href="#roi" className="nav-link">ROI Calculator</a>
            <a href="#benchmarks" className="nav-link">Benchmarks</a>
          </div>

          <div className="nav-right">
            <div className="telemetry-pill">
              <span className="telemetry-dot" />
              <span className="telemetry-text">Model Active &bull; &lt;15ms</span>
            </div>
            <a
              href="https://github.com/mashraf02/fraud-detection-app"
              target="_blank"
              rel="noreferrer"
              className="nav-github-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
            <button className="btn-glow-primary" onClick={onLaunch}>
              <span>Launch Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="shell hero-grid">
          <div className="hero-text-col">
            <div className="hero-badge">
              <span className="badge-sparkle">✦</span>
              <span>Next-Gen Machine Learning Fraud Engine</span>
            </div>

            <h1 className="hero-headline">
              Stop Invisible Fraud <br />
              <span className="gradient-text">Before It Clears.</span>
            </h1>

            <p className="hero-description">
              Fraud Radar turns high-dimensional transaction telemetry into real-time risk scores in sub-15ms.
              Calibrated specifically for severe 0.17% class imbalance, delivering a proven 92% recall rate on 284k+ benchmark records.
            </p>

            <div className="hero-cta-group">
              <button className="btn-glow-primary btn-large" onClick={onLaunch}>
                <span>Test Live Dashboard</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
              <a href="#simulator" className="btn-glass btn-large">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>Interactive Simulator</span>
              </a>
            </div>

            <div className="hero-proof-strip">
              <div className="proof-item">
                <div className="proof-icon">🛡️</div>
                <div className="proof-meta">
                  <strong>Zero Cloud Storage</strong>
                  <span>Private local inference</span>
                </div>
              </div>
              <div className="proof-divider" />
              <div className="proof-item">
                <div className="proof-icon">⚡</div>
                <div className="proof-meta">
                  <strong>&lt; 15ms Latency</strong>
                  <span>Bank-grade evaluation</span>
                </div>
              </div>
              <div className="proof-divider" />
              <div className="proof-item">
                <div className="proof-icon">🎯</div>
                <div className="proof-meta">
                  <strong>92% Recall</strong>
                  <span>Catches evasive fraud</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-visual-col">
            <div className="hero-console-wrapper">
              <div className="hero-console-topbar">
                <div className="console-status-left">
                  <span className="console-live-dot" />
                  <span className="console-title">REAL-TIME THREAT RADAR</span>
                </div>
                <div className="console-badge-right">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  <span>ROC-AUC 0.97 Verified</span>
                </div>
              </div>

              {/* Picture Frame - 100% Unobstructed */}
              <div className="hero-image-frame">
                <div className="frame-glow" />
                <img
                  src={heroSecurityRadarImg}
                  alt="3D Holographic AI Security Radar and Threat Detection Hub"
                  className="hero-main-img"
                />
              </div>

              {/* Dedicated Live Interception Telemetry Card (Positioned Cleanly Below Picture) */}
              <div className="hero-telemetry-dock">
                <div className="card-header-row">
                  <div className="card-tag-wrap">
                    <span className="card-live-dot" />
                    <span className="card-tag">LIVE INTERCEPTION</span>
                  </div>
                  <span className="latency-label">11.2ms latency</span>
                </div>
                <div className="card-mid-row">
                  <div>
                    <div className="txn-id-label">TXN-99824 • VISA CARD</div>
                    <div className="txn-amount-val">$1,850.00 USD</div>
                  </div>
                  <div className="score-pill score-high">
                    <span className="score-num">0.912</span>
                    <span className="score-desc">RISK SCORE</span>
                  </div>
                </div>
                <div className="card-footer-status">
                  <span className="status-pill status-alert">FLAGGED FOR HUMAN REVIEW</span>
                  <span className="threshold-sublabel">Threshold: 0.50</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verified Telemetry Numbers */}
      <section className="shell stats-section section-reveal" id="benchmarks">
        <div className="stats-container">
          <AnimatedStat
            target={284807}
            label="Transactions Evaluated"
            sublabel="Standard Kaggle European card benchmark dataset"
          />
          <AnimatedStat
            target={92.1}
            decimals={1}
            suffix="%"
            label="Fraud Recall Rate"
            sublabel="Percentage of actual fraud caught at calibrated threshold"
          />
          <AnimatedStat
            target={0.97}
            decimals={2}
            label="ROC-AUC Score"
            sublabel="Excellent discrimination across all decision thresholds"
          />
          <AnimatedStat
            target={12}
            suffix="ms"
            prefix="< "
            label="Inference Latency"
            sublabel="Instant real-time decisioning per transaction"
          />
        </div>
      </section>

      {/* Interactive Fraud Simulator Section */}
      <section className="shell simulator-section section-reveal" id="simulator">
        <div className="section-head text-center">
          <div className="section-eyebrow">TRY IT IN ACTION</div>
          <h2 className="section-title">Interactive Risk Scoring Sandbox</h2>
          <p className="section-subtitle">
            See how the Fraud Radar scoring engine evaluates transaction anomalies in real time.
            Select a sample transaction scenario below to inspect feature reactions.
          </p>
        </div>

        <div className="simulator-grid">
          {/* Scenario Selectors */}
          <div className="simulator-controls">
            <h3 className="controls-heading">Select Test Scenario:</h3>
            <div className="scenario-list">
              {SAMPLE_TRANSACTIONS.map((txn) => (
                <button
                  key={txn.id}
                  className={`scenario-btn ${selectedTxn.id === txn.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedTxn(txn)}
                >
                  <div className="scenario-btn-top">
                    <span className="scenario-title">{txn.title}</span>
                    <span className={`scenario-badge ${txn.statusClass}`}>
                      {txn.status}
                    </span>
                  </div>
                  <p className="scenario-desc">{txn.description}</p>
                  <div className="scenario-meta">
                    <span>{txn.amount}</span>
                    <span>&bull;</span>
                    <span>{txn.timeDelta}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="simulator-note">
              <strong>Need to test your own custom parameters?</strong>
              <p>Launch the full dashboard to test any arbitrary combination of 30 numerical features.</p>
              <button className="btn-glass btn-sm" onClick={onLaunch}>
                Open Full Manual Inspector &rarr;
              </button>
            </div>
          </div>

          {/* Interactive Inspection Readout */}
          <div className="simulator-readout">
            <div className="readout-card">
              <div className="readout-header">
                <div>
                  <span className="readout-label">INSPECTION ID</span>
                  <div className="readout-txn-id">{selectedTxn.id}</div>
                </div>
                <div className={`readout-status-chip ${selectedTxn.statusClass}`}>
                  {selectedTxn.status}
                </div>
              </div>

              <div className="readout-gauge-row">
                <div className="gauge-metric">
                  <span className="metric-label">Fraud Probability</span>
                  <div className="metric-value">
                    {(selectedTxn.riskProbability * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="gauge-bar-wrapper">
                  <div className="gauge-threshold-marker" style={{ left: '50%' }}>
                    <span className="marker-label">Threshold 0.50</span>
                  </div>
                  <div className="gauge-track">
                    <div
                      className={`gauge-fill ${
                        selectedTxn.riskProbability >= 0.5 ? 'fill-danger' : 'fill-safe'
                      }`}
                      style={{ width: `${selectedTxn.riskProbability * 100}%` }}
                    />
                  </div>
                  <div className="gauge-labels">
                    <span>0.00 (Safe)</span>
                    <span>0.50 (Review Cutoff)</span>
                    <span>1.00 (Severe)</span>
                  </div>
                </div>
              </div>

              <div className="readout-signals">
                <h4 className="signals-title">Dominant Feature Indicators:</h4>
                <ul className="signals-list">
                  {selectedTxn.topSignals.map((signal, idx) => (
                    <li key={idx} className="signal-item">
                      <span className="signal-dot" />
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="readout-action-bar">
                <div className="readout-time-stamp">Decision rendered in 11.4ms via Scaler + Sigmoid</div>
                <button className="btn-glow-primary btn-sm" onClick={onLaunch}>
                  Inspect in Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Pipeline Architecture Section with Neural Pipeline Image */}
      <section className="shell pipeline-section section-reveal" id="pipeline">
        <div className="section-head text-center">
          <div className="section-eyebrow">HOW IT WORKS</div>
          <h2 className="section-title">The Real-Time Decision Pipeline</h2>
          <p className="section-subtitle">
            From raw transaction event arrival to human analyst review escalation in under 15 milliseconds.
          </p>
        </div>

        <div className="pipeline-container">
          <div className="pipeline-image-wrapper">
            <div className="pipeline-glow-ring" />
            <img
              src={pipelineAiNeuralImg}
              alt="High Tech 3D AI Machine Learning Pipeline with Neural Architecture and Real-Time Scoring"
              className="pipeline-feature-img"
            />
          </div>

          <div className="pipeline-steps-grid">
            <div className="pipeline-step-card">
              <div className="step-number-glow">01</div>
              <h3 className="step-title">Ingest Telemetry</h3>
              <p className="step-body">
                30 high-frequency numeric dimensions (Time offset, Amount, and PCA-projected behavioral vectors V1 through V28) arrive via JSON payload.
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-number-glow">02</div>
              <h3 className="step-title">Standardize & Scale</h3>
              <p className="step-body">
                Trained <code>StandardScaler</code> aligns dynamic ranges to zero-mean and unit-variance, preventing high absolute amounts from distorting behavioral signals.
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-number-glow">03</div>
              <h3 className="step-title">Balanced Inference</h3>
              <p className="step-body">
                Calibrated logistic classifier applies inverse-class weights to overcome 0.17% rarity, computing calibrated probabilities between 0.00 and 1.00.
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-number-glow">04</div>
              <h3 className="step-title">Action & Route</h3>
              <p className="step-body">
                Transactions crossing the decision threshold (0.50) trigger instant alert flags with feature explanations, routing to analyst queues immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Modes Feature Showcase with Dashboard Analytics Image */}
      <section className="shell features-section section-reveal" id="features">
        <div className="section-head text-center">
          <div className="section-eyebrow">TWO POWERFUL SCREENING MODES</div>
          <h2 className="section-title">Engineered for Single Checks or High-Volume Batches</h2>
          <p className="section-subtitle">
            Whether screening a single suspicious wire or auditing an entire day of transactions via CSV.
          </p>
        </div>

        <div className="modes-showcase-grid">
          <div className="mode-card mode-single">
            <div className="mode-badge">REAL-TIME API</div>
            <h3 className="mode-heading">Single Transaction Inspector</h3>
            <p className="mode-desc">
              Test edge-case transactions with full control over all 30 input parameters. Immediate verdict with probability score, risk category, and feature breakdown.
            </p>
            <div className="mode-preview-box">
              <div className="preview-row">
                <span className="preview-code">TXN_ID: #40921</span>
                <span className="status-badge-mini legit">0.038 &bull; LEGIT</span>
              </div>
              <div className="preview-row">
                <span className="preview-code">TXN_ID: #40922</span>
                <span className="status-badge-mini fraud">0.892 &bull; FLAGGED</span>
              </div>
            </div>
            <button className="btn-glow-primary" onClick={onLaunch}>
              Test Single Check
            </button>
          </div>

          <div className="mode-card mode-batch">
            <div className="mode-badge">HIGH-THROUGHPUT CSV</div>
            <h3 className="mode-heading">Batch Dataset Screener</h3>
            <p className="mode-desc">
              Drag-and-drop client CSV files containing thousands of transactions. The client-side parser packages records for vectorized high-speed batch evaluation.
            </p>
            <div className="mode-preview-box">
              <div className="preview-row">
                <span className="preview-code">creditcard_sample.csv</span>
                <span className="status-badge-mini info">2,481 rows</span>
              </div>
              <div className="preview-row">
                <span className="preview-code">Processing Speed</span>
                <span className="status-badge-mini success">~140ms total</span>
              </div>
            </div>
            <button className="btn-glass" onClick={onLaunch}>
              Upload CSV Dataset
            </button>
          </div>
        </div>

        {/* Dashboard Preview Showcase */}
        <div className="dashboard-showcase-banner">
          <div className="dashboard-banner-text">
            <span className="banner-tag">ANALYST COMMAND CENTER</span>
            <h3>Comprehensive Telemetry at Your Fingertips</h3>
            <p>
              Real-time fraud trends, risk probability curves, vector distribution heatmaps, and instant resolution history.
            </p>
            <button className="btn-glow-primary" onClick={onLaunch}>
              Explore Full Dashboard
            </button>
          </div>
          <div className="dashboard-banner-visual">
            <img
              src={dashboardAnalyticsPreviewImg}
              alt="High resolution modern fintech analytics dashboard preview"
              className="dashboard-preview-img"
            />
          </div>
        </div>
      </section>

      {/* Interactive ROI Loss Prevention Calculator */}
      <section className="shell roi-section section-reveal" id="roi">
        <div className="section-head text-center">
          <div className="section-eyebrow">FINANCIAL IMPACT ESTIMATOR</div>
          <h2 className="section-title">Calculate Your Prevented Fraud Loss</h2>
          <p className="section-subtitle">
            Estimate potential savings using Fraud Radar's 92% recall rate on high-risk transaction volumes.
          </p>
        </div>

        <div className="roi-calculator-card">
          <div className="roi-sliders-col">
            <div className="slider-group">
              <div className="slider-label-row">
                <label htmlFor={monthlyTxnsInputId}>Monthly Transactions:</label>
                <span className="slider-value-display">{monthlyTxns.toLocaleString()}</span>
              </div>
              <input
                id={monthlyTxnsInputId}
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                value={monthlyTxns}
                onChange={(e) => setMonthlyTxns(Number(e.target.value))}
                className="roi-slider"
              />
              <div className="slider-hints">
                <span>10k / mo</span>
                <span>500k / mo</span>
                <span>1M+ / mo</span>
              </div>
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <label htmlFor={avgTicketInputId}>Average Ticket Size ($USD):</label>
                <span className="slider-value-display">${avgTicket}</span>
              </div>
              <input
                id={avgTicketInputId}
                type="range"
                min="15"
                max="500"
                step="5"
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="roi-slider"
              />
              <div className="slider-hints">
                <span>$15</span>
                <span>$250</span>
                <span>$500</span>
              </div>
            </div>

            <div className="roi-calculation-assumptions">
              <span className="assumptions-title">Assumptions & Baseline:</span>
              <p>Based on global merchant fraud rates of ~0.17% and Fraud Radar's validated 92.1% fraud recall sensitivity.</p>
            </div>
          </div>

          <div className="roi-results-col">
            <div className="roi-stat-box">
              <span className="roi-box-label">MONTHLY PROCESSED VOLUME</span>
              <div className="roi-box-value">${Math.round(monthlyTotalVolume).toLocaleString()}</div>
            </div>

            <div className="roi-stat-box highlight-emerald">
              <span className="roi-box-label">ESTIMATED ANNUAL FRAUD PREVENTED</span>
              <div className="roi-box-value large">${Math.round(estimatedAnnualSavings).toLocaleString()}</div>
              <span className="roi-box-sub">Direct chargeback and loss avoidance</span>
            </div>

            <div className="roi-stat-box">
              <span className="roi-box-label">ESTIMATED MONTHLY SAVINGS</span>
              <div className="roi-box-value">${Math.round(estimatedMonthlySavings).toLocaleString()} / mo</div>
            </div>

            <button className="btn-glow-primary btn-full-width" onClick={onLaunch}>
              Test With Your Own Data Now
            </button>
          </div>
        </div>
      </section>

      {/* Enterprise Security & Privacy Trust Section */}
      <section className="shell enterprise-section section-reveal">
        <div className="enterprise-layout">
          <div className="enterprise-visual-col">
            <div className="trust-shield-wrapper">
              <img
                src={enterpriseTrustShieldImg}
                alt="3D Enterprise Financial Security Guarantee Shield and Biometric Vault"
                className="trust-shield-img"
              />
            </div>
          </div>

          <div className="enterprise-text-col">
            <div className="section-eyebrow">ENTERPRISE TRUST GUARANTEE</div>
            <h2 className="enterprise-heading">Zero Data Retention. Total Privacy-First Architecture.</h2>
            <p className="enterprise-body">
              Financial data privacy is non-negotiable. Fraud Radar executes machine learning inference strictly in-memory within your local environment.
            </p>

            <div className="trust-features-list">
              <div className="trust-feature-item">
                <div className="trust-icon-box">🔒</div>
                <div>
                  <h4>No Cloud Telemetry Egress</h4>
                  <p>Uploaded CSV files and manual inputs never leave your host browser and local server.</p>
                </div>
              </div>

              <div className="trust-feature-item">
                <div className="trust-icon-box">⚖️</div>
                <div>
                  <h4>Calibrated for Imbalanced Reality</h4>
                  <p>Trained with class-balancing weights specifically engineered for datasets where 99.8% of entries are normal.</p>
                </div>
              </div>

              <div className="trust-feature-item">
                <div className="trust-icon-box">🔍</div>
                <div>
                  <h4>Transparent Mathematical Foundation</h4>
                  <p>StandardScaler normalization and Logistic Regression with interpretable weights — zero unexplainable black boxes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* High-Converting Final Banner */}
      <section className="shell final-cta-section section-reveal">
        <div className="final-cta-card">
          <div className="cta-glow-circle" />
          <h2 className="cta-heading">Ready to Experience Real-Time Fraud Radar?</h2>
          <p className="cta-sub">
            Explore live single-transaction testing or batch screen your own CSV records right now.
          </p>
          <div className="cta-actions">
            <button className="btn-glow-primary btn-large" onClick={onLaunch}>
              <span>Launch Fraud Radar Dashboard</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <a
              href="https://github.com/mashraf02/fraud-detection-app"
              target="_blank"
              rel="noreferrer"
              className="btn-glass btn-large"
            >
              <span>View Source on GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* Polished Modern Footer */}
      <footer className="landing-footer">
        <div className="shell footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">
              <div className="brand-badge small">
                <span className="brand-dot-pulse" />
              </div>
              <span className="brand-name">Fraud Radar</span>
            </div>
            <p className="footer-tagline">
              Sub-15ms AI credit card fraud screening engine built on benchmark transaction datasets.
            </p>
            <div className="footer-badges">
              <span className="f-badge">v1.0 Local</span>
              <span className="f-badge">React 19</span>
              <span className="f-badge">Scikit-Learn</span>
            </div>
          </div>

          <div className="footer-nav-col">
            <div className="footer-heading">Platform</div>
            <a href="#simulator">Live Simulator</a>
            <a href="#pipeline">AI Pipeline</a>
            <a href="#features">Capabilities</a>
            <a href="#roi">ROI Calculator</a>
            <a href="#benchmarks">Benchmarks</a>
          </div>

          <div className="footer-nav-col">
            <div className="footer-heading">Resources</div>
            <a href="https://github.com/mashraf02/fraud-detection-app" target="_blank" rel="noreferrer">GitHub Repository</a>
            <a href="https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud" target="_blank" rel="noreferrer">Kaggle Benchmark Dataset</a>
            <a href="https://github.com/mashraf02/fraud-detection-app/blob/main/README.md" target="_blank" rel="noreferrer">Technical Documentation</a>
          </div>

          <div className="footer-nav-col">
            <div className="footer-heading">Created By</div>
            <a href="https://github.com/mashraf02" target="_blank" rel="noreferrer" className="author-link">
              Mashraful
            </a>
            <span className="author-bio">Computer Science & Engineering, IUB</span>
            <div className="author-status">
              <span className="status-dot-green" />
              <span>Available for high-impact AI/SWE roles</span>
            </div>
          </div>
        </div>

        <div className="shell footer-bottom">
          <p>&copy; {new Date().getFullYear()} Fraud Radar. Built for high-precision fraud detection research & demonstrations.</p>
          <div className="footer-bottom-links">
            <a href="https://github.com/mashraf02/fraud-detection-app" target="_blank" rel="noreferrer">MIT License</a>
            <span>&bull;</span>
            <button className="footer-text-btn" onClick={onLaunch}>Open App</button>
          </div>
        </div>
      </footer>
    </div>
  )
}