import { useEffect, useRef, useState } from 'react'
import './Landing.css'
import { useI18n } from './i18n-context'
import { predictTransaction } from './api'
import { useModel, zeroVector } from './useModel'

import heroSecurityRadarImg from './assets/hero_security_radar.jpg'
import pipelineAiNeuralImg from './assets/pipeline_ai_neural.jpg'
import dashboardAnalyticsPreviewImg from './assets/dashboard_analytics_preview.jpg'
import enterpriseTrustShieldImg from './assets/enterprise_trust_shield.jpg'

/**
 * Probes the deployed model with one real request.
 *
 * The vector sent is the zero row for whatever schema the API declares — the
 * dataset mean once the features are standardised — so the page can demonstrate
 * live inference without baking a dataset-specific sample into the frontend. If
 * the API does not answer, the page says so rather than showing a
 * plausible-looking number.
 */
function useLiveProbe(features) {
  const [outcome, setOutcome] = useState(null)

  useEffect(() => {
    if (features.length === 0) return undefined
    const controller = new AbortController()

    predictTransaction(zeroVector(features), { signal: controller.signal })
      .then((data) => setOutcome({ status: 'ready', data }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setOutcome({ status: 'error', message: error.message })
      })

    return () => controller.abort()
  }, [features])

  return {
    status: outcome?.status ?? (features.length === 0 ? 'idle' : 'loading'),
    data: outcome?.data ?? null,
    message: outcome?.message ?? null,
  }
}

function AnimatedStat({ target, decimals = 0, prefix = '', suffix = '', label, sublabel }) {
  const { tn } = useI18n()
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const hasRun = useRef(false)

  useEffect(() => {
    const el = ref.current
    // Metrics arrive asynchronously, so `target` is missing on the first render.
    // Wait for a real number before wiring up the count-up.
    if (!el || target == null) return undefined
    if (hasRun.current) {
      // An earlier effect run already dealt with the count-up; just make sure
      // the tile holds the exact value.
      setValue(target)
      return undefined
    }

    const duration = 1400
    let frame
    let settle

    function animate() {
      if (hasRun.current) return
      hasRun.current = true
      const start = performance.now()

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(target * eased)
        if (progress < 1) {
          frame = requestAnimationFrame(tick)
        }
      }
      frame = requestAnimationFrame(tick)

      // The count-up is decoration; the number is the deliverable. Frame
      // callbacks are throttled whenever the tab is not foregrounded, so pin the
      // exact value regardless of whether the animation ever completes.
      settle = window.setTimeout(() => setValue(target), duration + 400)
    }

    // Measure visibility directly instead of waiting for an intersection
    // notification, which is itself throttled in a backgrounded tab.
    const box = el.getBoundingClientRect()
    if (box.top < window.innerHeight && box.bottom > 0) animate()

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && animate()),
      { threshold: 0.3 }
    )
    observer.observe(el)

    // Last resort: a tile showing 0 would be indistinguishable from a measured
    // zero, so the true value lands even if every animation path is throttled.
    const failsafe = window.setTimeout(() => {
      hasRun.current = true
      setValue(target)
    }, 4000)

    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(failsafe)
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [target])

  let display = '—'
  if (target != null) {
    display =
      decimals > 0
        ? tn(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : tn(Math.round(value))
  }

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

export default function Landing({ onLaunch }) {
  const { t, tn, lang, locale, toggleLanguage } = useI18n()
  // The deployment declares its own interface — version, threshold, metrics and
  // the feature list all come from GET /model, so this page describes whatever
  // model is actually running rather than the one it was written for.
  const model = useModel()
  const modelData = model.model
  const probe = useLiveProbe(model.features)

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
  }, [model.status])

  const metrics = model.metrics
  const operatingPoint = model.operatingPoint ?? {}
  const dataset = model.dataset
  const runtime = model.runtime

  const cutOff = model.cutOff
  const rocAuc = metrics.roc_auc ?? null
  const prAuc = metrics.pr_auc ?? null
  const prAucBaseline = metrics.pr_auc_baseline ?? null
  const testRows = metrics.test_rows ?? null
  const testFraudRows = metrics.test_fraud_rows ?? null

  const num = (value, digits) =>
    value == null
      ? '—'
      : tn(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const pct = (value, digits = 1) => (value == null ? '—' : `${num(value * 100, digits)}%`)

  // The one latency the API actually reported, shown wherever this page used to
  // quote an invented figure.
  const lastLatency = probe.data?.latency_ms ?? null

  const featureNames = model.features
  const featureCount = model.featureCount

  const trainedAt = modelData?.trained_at
    ? new Date(modelData.trained_at).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

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
              <span className="brand-subtitle">{t('nav.subtitle')}</span>
            </div>
          </div>

          <div className="nav-links">
            <a href="#simulator" className="nav-link">{t('nav.simulator')}</a>
            <a href="#pipeline" className="nav-link">{t('nav.pipeline')}</a>
            <a href="#features" className="nav-link">{t('nav.features')}</a>
            <a href="#benchmarks" className="nav-link">{t('nav.benchmarks')}</a>
          </div>

          <div className="nav-right">
            <div className="telemetry-pill">
              <span className="telemetry-dot" />
              <span className="telemetry-text">
                {model.status === 'ready' ? t('nav.telemetry') : t('nav.telemetryOffline')}
              </span>
            </div>
            <div className="lang-switcher">
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => lang !== 'en' && toggleLanguage()}
              >
                EN
              </button>
              <span className="lang-divider">|</span>
              <button
                className={`lang-btn ${lang === 'bn' ? 'active' : ''}`}
                onClick={() => lang !== 'bn' && toggleLanguage()}
              >
                বাং
              </button>
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
              <span>{t('nav.github')}</span>
            </a>
            <button className="btn-glow-primary" onClick={onLaunch}>
              <span>{t('nav.launch')}</span>
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
              <span>{t('hero.badge')}</span>
            </div>

            <h1 className="hero-headline">
              {t('hero.headlineLine1')} <br />
              <span className="gradient-text">{t('hero.headlineLine2')}</span>
            </h1>

            <p className="hero-description">
              {t('hero.description')}
            </p>

            <div className="hero-cta-group">
              <button className="btn-glow-primary btn-large" onClick={onLaunch}>
                <span>{t('hero.ctaPrimary')}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
              <a href="#simulator" className="btn-glass btn-large">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>{t('hero.ctaSecondary')}</span>
              </a>
            </div>

            <div className="hero-proof-strip">
              <div className="proof-item">
                <div className="proof-icon">🛡️</div>
                <div className="proof-meta">
                  <strong>{t('hero.proof1Title')}</strong>
                  <span>{t('hero.proof1Sub')}</span>
                </div>
              </div>
              <div className="proof-divider" />
              <div className="proof-item">
                <div className="proof-icon">⚖️</div>
                <div className="proof-meta">
                  <strong>{t('hero.proof2Title')}</strong>
                  <span>{t('hero.proof2Sub')}</span>
                </div>
              </div>
              <div className="proof-divider" />
              <div className="proof-item">
                <div className="proof-icon">🔍</div>
                <div className="proof-meta">
                  <strong>{t('hero.proof3Title')}</strong>
                  <span>{t('hero.proof3Sub')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-visual-col">
            <div className="hero-console-wrapper">
              <div className="hero-console-topbar">
                <div className="console-status-left">
                  <span className="console-live-dot" />
                  <span className="console-title">{t('hero.consoleTitle')}</span>
                </div>
                <div className="console-badge-right">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  <span>{t('hero.consoleBadgeLabel')} {num(rocAuc, 3)}</span>
                </div>
              </div>

              <div className="hero-image-frame">
                <div className="frame-glow" />
                <img
                  src={heroSecurityRadarImg}
                  alt="3D Holographic AI Security Radar and Threat Detection Hub"
                  className="hero-main-img"
                />
              </div>

              {probe.status === 'ready' ? (
                <div className="hero-telemetry-dock">
                  <div className="card-header-row">
                    <div className="card-tag-wrap">
                      <span className="card-live-dot" />
                      <span className="card-tag">{t('hero.liveTag')}</span>
                    </div>
                    <span className="latency-label">
                      {t('hero.scoredIn', { ms: num(probe.data.latency_ms, 1) })}
                    </span>
                  </div>
                  <div className="card-mid-row">
                    <div>
                      <div className="txn-id-label">
                        {t('hero.probeLine', { count: featureCount ?? 0 })}
                      </div>
                      <div className="txn-amount-val">
                        {t('hero.cutOffLabel')} {num(cutOff, 2)}
                      </div>
                    </div>
                    <div className={`score-pill ${probe.data.is_fraud ? '' : 'score-low'}`}>
                      <span className="score-num">{num(probe.data.fraud_probability, 3)}</span>
                      <span className="score-desc">{t('hero.probabilityLabel')}</span>
                    </div>
                  </div>
                  <div className="card-footer-status">
                    <span className={`status-pill ${probe.data.is_fraud ? 'status-alert' : 'status-ok'}`}>
                      {probe.data.is_fraud ? t('hero.verdictFlagged') : t('hero.verdictCleared')}
                    </span>
                    <span className="threshold-sublabel">
                      {t('hero.modelLabel')}: {probe.data.model_version}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="hero-telemetry-dock">
                  {probe.status === 'error' ? (
                    <>
                      <div className="console-notice console-notice-error">
                        <span className="console-notice-dot" />
                        <span>{t('hero.errorTitle')}</span>
                      </div>
                      <p className="console-notice-body">{t('hero.errorBody')}</p>
                    </>
                  ) : (
                    <div className="console-notice">
                      <span className="console-notice-dot" />
                      <span>{t('hero.awaiting')}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="console-notice-body">
                {t('hero.note', { count: featureCount ?? 0 })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Measured model performance, read from the deployed artifact */}
      <section className="shell stats-section section-reveal" id="benchmarks">
        <div className="section-head text-center">
          <div className="section-eyebrow">{t('stats.eyebrow')}</div>
          <h2 className="section-title">{t('stats.title')}</h2>
          <p className="section-subtitle">{t('stats.subtitle')}</p>
        </div>

        {model.status === 'error' ? (
          <div className="console-notice console-notice-error">
            <span className="console-notice-dot" />
            <span>{t('stats.unavailable')}</span>
          </div>
        ) : (
          <>
            <div className="stats-container">
              <AnimatedStat
                target={dataset.rows ?? null}
                label={t('stats.evaluated')}
                sublabel={t('stats.evaluatedSub')}
              />
              <AnimatedStat
                target={operatingPoint.recall == null ? null : operatingPoint.recall * 100}
                decimals={1}
                suffix="%"
                label={t('stats.recall')}
                sublabel={t('stats.recallSub')}
              />
              <AnimatedStat
                target={operatingPoint.precision == null ? null : operatingPoint.precision * 100}
                decimals={1}
                suffix="%"
                label={t('stats.precision')}
                sublabel={t('stats.precisionSub')}
              />
              <AnimatedStat
                target={prAuc}
                decimals={3}
                label={t('stats.prAuc')}
                sublabel={t('stats.prAucSub', {
                  baseline: num(prAucBaseline, 4),
                })}
              />
            </div>

            <p className="stats-caption">
              {model.status === 'ready'
                ? t('stats.ofTestRows', {
                    rows: num(testRows, 0),
                    fraud: num(testFraudRows, 0),
                  })
                : t('stats.loading')}
            </p>
          </>
        )}
      </section>

      {/* What this deployment declares about itself. Every value is read from
          GET /model, so the same page describes whatever model is running rather
          than the one it was written for. */}
      <section className="shell simulator-section section-reveal" id="simulator">
        <div className="section-head text-center">
          <div className="section-eyebrow">{t('interface.eyebrow')}</div>
          <h2 className="section-title">{t('interface.title')}</h2>
          <p className="section-subtitle">{t('interface.subtitle')}</p>
        </div>

        <div className="simulator-grid">
          <div className="simulator-controls">
            <h3 className="controls-heading">
              {t('interface.featuresLabel', { count: featureCount ?? 0 })}
            </h3>

            {featureNames.length > 0 ? (
              <div className="feature-chips">
                {featureNames.map((name) => (
                  <span key={name} className="feature-chip">{name}</span>
                ))}
              </div>
            ) : (
              <div className="console-notice">
                <span className="console-notice-dot" />
                <span>{t('interface.featuresUnavailable')}</span>
              </div>
            )}

            <p className="console-notice-body">{t('interface.featuresNote')}</p>

            <div className="simulator-note">
              <strong>{t('interface.probeTitle')}</strong>
              <p>
                {probe.status === 'ready'
                  ? t('interface.probeBody', {
                      count: featureCount ?? 0,
                      probability: pct(probe.data.fraud_probability),
                    })
                  : t('interface.probeWaiting')}
              </p>
              <button className="btn-glass btn-sm" onClick={onLaunch}>
                {t('interface.cta')} &rarr;
              </button>
            </div>
          </div>

          <div className="simulator-readout">
            <div className="readout-card">
              <div className="readout-header">
                <div>
                  <span className="readout-label">{t('interface.modelLabel')}</span>
                  <div className="readout-txn-id">{modelData?.version ?? '—'}</div>
                </div>
                <div
                  className={`readout-status-chip ${
                    model.status === 'error' ? 'status-fraud' : 'status-legit'
                  }`}
                >
                  {model.status === 'error'
                    ? t('interface.unavailable')
                    : model.status === 'ready'
                      ? t('interface.available')
                      : t('interface.loading')}
                </div>
              </div>

              <div className="interface-rows">
                {[
                  [
                    t('interface.rowCutOff'),
                    cutOff == null
                      ? '—'
                      : `${num(cutOff, 2)} · ${model.thresholdSource ?? '—'}`,
                  ],
                  [
                    t('interface.rowMetrics'),
                    operatingPoint.recall == null
                      ? '—'
                      : t('interface.metricsValue', {
                          recall: pct(operatingPoint.recall),
                          precision: pct(operatingPoint.precision),
                        }),
                  ],
                  [
                    t('interface.rowDataset'),
                    dataset.rows == null
                      ? '—'
                      : t('interface.datasetValue', {
                          rows: num(dataset.rows, 0),
                          positives: num(dataset.fraud_rows, 0),
                        }),
                  ],
                  [
                    t('interface.rowValidation'),
                    testRows == null
                      ? '—'
                      : t('interface.validationValue', {
                          rows: num(testRows, 0),
                          positives: num(testFraudRows, 0),
                        }),
                  ],
                  [
                    t('interface.rowRuntime'),
                    runtime.scikit_learn
                      ? `scikit-learn ${runtime.scikit_learn} · python ${runtime.python ?? '—'}`
                      : '—',
                  ],
                  [t('interface.rowTrained'), trainedAt],
                ].map(([label, value]) => (
                  <div key={label} className="preview-row">
                    <span className="preview-code">{label}</span>
                    <span className="status-badge-mini info">{value}</span>
                  </div>
                ))}
              </div>

              <div className="readout-action-bar">
                <div className="readout-time-stamp">{t('interface.note')}</div>
                <button className="btn-glow-primary btn-sm" onClick={onLaunch}>
                  {t('interface.cta')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Request path */}
      <section className="shell pipeline-section section-reveal" id="pipeline">
        <div className="section-head text-center">
          <div className="section-eyebrow">{t('pipeline.eyebrow')}</div>
          <h2 className="section-title">{t('pipeline.title')}</h2>
          <p className="section-subtitle">{t('pipeline.subtitle')}</p>
          <p className="stats-caption">
            {t('pipeline.latencyLabel')}:{' '}
            {lastLatency == null
              ? t('pipeline.latencyAwaiting')
              : t('hero.scoredIn', { ms: num(lastLatency, 1) })}
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
              <h3 className="step-title">{t('pipeline.step1Title')}</h3>
              <p className="step-body">{t('pipeline.step1Body')}</p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-number-glow">02</div>
              <h3 className="step-title">{t('pipeline.step2Title')}</h3>
              <p className="step-body">
                {t('pipeline.step2BodyPre')} <code>StandardScaler</code>{' '}
                {t('pipeline.step2BodyPost')}
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-number-glow">03</div>
              <h3 className="step-title">{t('pipeline.step3Title')}</h3>
              <p className="step-body">
                {cutOff == null
                  ? t('pipeline.step3Body')
                  : `${t('pipeline.step3Body')} ${t('pipeline.appliedCutOff', {
                      value: num(cutOff, 2),
                      source: model.thresholdSource ?? '—',
                    })}`}
              </p>
            </div>

            <div className="pipeline-step-card">
              <div className="step-number-glow">04</div>
              <h3 className="step-title">{t('pipeline.step4Title')}</h3>
              <p className="step-body">{t('pipeline.step4Body')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Two entry points */}
      <section className="shell features-section section-reveal" id="features">
        <div className="section-head text-center">
          <div className="section-eyebrow">{t('features.eyebrow')}</div>
          <h2 className="section-title">{t('features.title')}</h2>
          <p className="section-subtitle">{t('features.subtitle')}</p>
        </div>

        <div className="modes-showcase-grid">
          <div className="mode-card mode-single">
            <div className="mode-badge">{t('features.singleBadge')}</div>
            <h3 className="mode-heading">{t('features.singleTitle')}</h3>
            <p className="mode-desc">{t('features.singleDesc')}</p>
            <div className="mode-preview-box">
              <div className="preview-row">
                <span className="preview-code">{t('features.previewEndpointSingle')}</span>
                <span className="status-badge-mini legit">{t('features.previewEndpointSingleStatus')}</span>
              </div>
              <div className="preview-row">
                <span className="preview-code">{t('features.previewRowsLabel')}</span>
                <span className="status-badge-mini info">{t('features.previewRowsValue')}</span>
              </div>
              <div className="preview-row">
                <span className="preview-code">{t('features.previewEndpointHistory')}</span>
                <span className="status-badge-mini success">{t('features.previewEndpointHistoryStatus')}</span>
              </div>
            </div>
            <button className="btn-glow-primary" onClick={onLaunch}>
              {t('features.singleCta')}
            </button>
          </div>

          <div className="mode-card mode-batch">
            <div className="mode-badge">{t('features.batchBadge')}</div>
            <h3 className="mode-heading">{t('features.batchTitle')}</h3>
            <p className="mode-desc">{t('features.batchDesc')}</p>
            <div className="mode-preview-box">
              <div className="preview-row">
                <span className="preview-code">{t('features.previewEndpointBatch')}</span>
                <span className="status-badge-mini info">{t('features.previewEndpointBatchStatus')}</span>
              </div>
              <div className="preview-row">
                <span className="preview-code">{t('features.previewLatencyLabel')}</span>
                <span className="status-badge-mini success">
                  {lastLatency == null
                    ? '—'
                    : t('hero.scoredIn', { ms: num(lastLatency, 1) })}
                </span>
              </div>
            </div>
            <p className="mode-note">{t('features.batchLimit')}</p>
            <button className="btn-glass" onClick={onLaunch}>
              {t('features.batchCta')}
            </button>
          </div>
        </div>

        <div className="dashboard-showcase-banner">
          <div className="dashboard-banner-text">
            <span className="banner-tag">{t('features.bannerTag')}</span>
            <h3>{t('features.bannerTitle')}</h3>
            <p>{t('features.bannerDesc')}</p>
            <button className="btn-glow-primary" onClick={onLaunch}>
              {t('features.bannerCta')}
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

      {/* Trust model */}
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
            <div className="section-eyebrow">{t('trust.eyebrow')}</div>
            <h2 className="enterprise-heading">{t('trust.heading')}</h2>
            <p className="enterprise-body">{t('trust.body')}</p>

            <div className="trust-features-list">
              <div className="trust-feature-item">
                <div className="trust-icon-box">🗄️</div>
                <div>
                  <h4>{t('trust.item1Title')}</h4>
                  <p>{t('trust.item1Body')}</p>
                </div>
              </div>

              <div className="trust-feature-item">
                <div className="trust-icon-box">🔖</div>
                <div>
                  <h4>{t('trust.item2Title')}</h4>
                  <p>{t('trust.item2Body')}</p>
                </div>
              </div>

              <div className="trust-feature-item">
                <div className="trust-icon-box">📐</div>
                <div>
                  <h4>{t('trust.item3Title')}</h4>
                  <p>{t('trust.item3Body')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="shell final-cta-section section-reveal">
        <div className="final-cta-card">
          <div className="cta-glow-circle" />
          <h2 className="cta-heading">{t('cta.heading')}</h2>
          <p className="cta-sub">{t('cta.sub')}</p>
          <div className="cta-actions">
            <button className="btn-glow-primary btn-large" onClick={onLaunch}>
              <span>{t('cta.primary')}</span>
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
              <span>{t('cta.secondary')}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="shell footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">
              <div className="brand-badge small">
                <span className="brand-dot-pulse" />
              </div>
              <span className="brand-name">Fraud Radar</span>
            </div>
            <p className="footer-tagline">{t('footer.tagline')}</p>
            <div className="footer-badges">
              <span className="f-badge">
                {t('footer.badgeModel', { version: modelData?.version ?? '—' })}
              </span>
              <span className="f-badge">
                {t('footer.badgeSklearn', { version: runtime.scikit_learn ?? '—' })}
              </span>
              <span className="f-badge">
                {t('footer.badgePython', { version: runtime.python ?? '—' })}
              </span>
            </div>
            <div className="author-status">
              <span className="status-dot-green" />
              <span>
                {t('footer.apiStatus')}:{' '}
                {model.status === 'ready' ? t('footer.apiOnline') : t('footer.apiOffline')}
              </span>
            </div>
          </div>

          <div className="footer-nav-col">
            <div className="footer-heading">{t('footer.platform')}</div>
            <a href="#simulator">{t('nav.simulator')}</a>
            <a href="#pipeline">{t('nav.pipeline')}</a>
            <a href="#features">{t('nav.features')}</a>
            <a href="#benchmarks">{t('nav.benchmarks')}</a>
          </div>

          <div className="footer-nav-col">
            <div className="footer-heading">{t('footer.resources')}</div>
            <a href="https://github.com/mashraf02/fraud-detection-app" target="_blank" rel="noreferrer">
              {t('footer.githubRepo')}
            </a>
            <a href="https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud" target="_blank" rel="noreferrer">
              {t('footer.kaggle')}
            </a>
            <a href="https://github.com/mashraf02/fraud-detection-app/blob/main/README.md" target="_blank" rel="noreferrer">
              {t('footer.docs')}
            </a>
          </div>

          <div className="footer-nav-col">
            <div className="footer-heading">{t('footer.createdBy')}</div>
            <a href="https://github.com/mashraf02" target="_blank" rel="noreferrer" className="author-link">
              Mashraful
            </a>
            <span className="author-bio">{t('footer.authorBio')}</span>
            <div className="author-status">
              <span className="status-dot-green" />
              <span>{t('footer.authorStatus')}</span>
            </div>
          </div>
        </div>

        <div className="shell footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} {t('footer.copyright')}
          </p>
          <div className="footer-bottom-links">
            <a href="https://github.com/mashraf02/fraud-detection-app" target="_blank" rel="noreferrer">
              {t('footer.license')}
            </a>
            <span>&bull;</span>
            <span>{t('footer.trainedAt', { when: trainedAt })}</span>
            <span>&bull;</span>
            <button className="footer-text-btn" onClick={onLaunch}>
              {t('footer.openApp')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
