import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import Landing from './Landing'
import { predictBatch, predictTransaction } from './api'
import { useModel, zeroVector } from './useModel'
import './App.css'

// Nothing about the model is hardcoded in this console. The inspector renders
// whatever feature list `GET /model` declares, so the same UI drives a different
// model — or a different domain — without a frontend change. There are
// deliberately no baked-in sample vectors either: a preset that only makes sense
// for one dataset is a liability in a general product, so the only shortcuts
// left are schema-derived (the zero vector) or the user's own last submission.

function VerdictBadge({ isFlagged }) {
  return (
    <span className={`dash-badge ${isFlagged ? 'dash-badge-fraud' : 'dash-badge-legit'}`}>
      <span className="badge-dot" />
      <span>{isFlagged ? 'FLAGGED' : 'CLEARED'}</span>
    </span>
  )
}

function Spinner() {
  return <span className="dash-spinner" aria-hidden="true" />
}

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [tab, setTab] = useState('single')
  const [edits, setEdits] = useState({})
  const [lastScored, setLastScored] = useState(null)
  const [featureFilter, setFeatureFilter] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const [batchResults, setBatchResults] = useState(null)
  const [batchError, setBatchError] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [fileName, setFileName] = useState(null)

  // Batch totals accumulate across uploads. Summing only the most recent batch
  // silently dropped every earlier upload from the session figures.
  const [batchTotals, setBatchTotals] = useState({ total: 0, fraud: 0 })

  // The deployment declares its own interface; the console follows it.
  const { status: modelStatus, model: modelInfo, error: modelError, features } = useModel()

  // The form is derived rather than seeded in an effect: the zero vector for
  // whatever schema arrives is the base value and edits layer on top, so a
  // schema change can never leave stale values from a previous model behind. If
  // the interface cannot be read, the field list is genuinely empty and the
  // inspector says so instead of guessing a schema to score against.
  const baseline = useMemo(() => zeroVector(features), [features])
  const fields = useMemo(() => ({ ...baseline, ...edits }), [baseline, edits])

  const visibleFeatures = useMemo(() => {
    const needle = featureFilter.trim().toLowerCase()
    if (!needle) return features
    return features.filter((name) => name.toLowerCase().includes(needle))
  }, [features, featureFilter])

  const sessionChecks = history.length + batchTotals.total
  const sessionFraud = history.filter((h) => h.is_fraud).length + batchTotals.fraud
  const sessionLegit = sessionChecks - sessionFraud
  const fraudPercentage = sessionChecks > 0 ? ((sessionFraud / sessionChecks) * 100).toFixed(1) : '0.0'

  // Decisioning facts read from the API at runtime. Nothing here is a literal
  // that can drift away from the deployed model.
  const operatingPoint = modelInfo?.metrics?.operating_point ?? null
  const asPercent = (value) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`)
  const cutOffText =
    modelInfo == null ? null : Number(modelInfo.effective_threshold).toFixed(2)

  function updateField(name, value) {
    setEdits((prev) => ({ ...prev, [name]: value }))
  }

  async function checkSingle() {
    setError(null)
    setResult(null)
    setLoading(true)

    const payload = {}
    for (const name of features) {
      const num = parseFloat(fields[name])
      if (Number.isNaN(num)) {
        setError(`"${name}" is not a valid number.`)
        setLoading(false)
        return
      }
      payload[name] = num
    }

    try {
      const data = await predictTransaction(payload)
      setResult(data)
      setLastScored(payload)
      setHistory((prev) => [
        {
          // The API assigns the id and it is the same id the audit trail uses,
          // so the console no longer invents a display-only one.
          id: data.transaction_id,
          time: new Date().toLocaleTimeString(),
          amount: payload.Amount,
          ...data,
        },
        ...prev,
      ])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function processCsvFile(file) {
    if (!file) return
    setFileName(file.name)
    setBatchError(null)
    setBatchResults(null)
    setBatchLoading(true)

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          // Validate before uploading. A missing column or an empty cell used to
          // reach the API and come back as a 422 that named no row at all.
          const problems = []
          for (
            let index = 0;
            index < parsed.data.length && problems.length < 5;
            index += 1
          ) {
            const row = parsed.data[index]
            for (const name of features) {
              const value = row[name]
              if (
                value === undefined ||
                value === null ||
                value === '' ||
                Number.isNaN(Number(value))
              ) {
                problems.push(
                  `row ${index + 2}: ${name} is ${
                    value === undefined ? 'missing' : `"${value}"`
                  }`,
                )
                break
              }
            }
          }

          if (problems.length > 0) {
            setBatchError(
              `CSV rejected before upload — ${problems.join('; ')}. Expected the ${features.length} features this model declares, all numeric.`,
            )
            setBatchLoading(false)
            return
          }

          const rows = parsed.data.map((row) => {
            const clean = {}
            for (const name of features) {
              clean[name] = Number(row[name])
            }
            return clean
          })

          const data = await predictBatch(rows)
          setBatchResults(data)
          setBatchTotals((current) => ({
            total: current.total + data.total,
            fraud: current.fraud + data.fraud_count,
          }))
        } catch (err) {
          setBatchError(err.message)
        } finally {
          setBatchLoading(false)
        }
      },
      error: (err) => {
        setBatchError(err.message)
        setBatchLoading(false)
      },
    })
  }

  function handleFileInputChange(e) {
    processCsvFile(e.target.files[0])
  }

  function handleDrop(e) {
    e.preventDefault()
    processCsvFile(e.dataTransfer.files[0])
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  if (showLanding) {
    return <Landing onLaunch={() => setShowLanding(false)} />
  }

  return (
    <div className="dash-page">
      {/* Dynamic Background Mesh Glows */}
      <div className="dash-bg-glow glow-1" aria-hidden="true" />
      <div className="dash-bg-glow glow-2" aria-hidden="true" />

      {/* Dashboard Top Navigation */}
      <header className="dash-header">
        <nav className="shell dash-nav">
          <div className="dash-brand">
            <div className="dash-brand-badge">
              <span className="dash-brand-pulse" />
              <svg className="dash-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div className="dash-brand-text">
              <span className="dash-brand-title">Fraud Radar</span>
              <span className="dash-brand-subtitle">Analyst Console</span>
            </div>
          </div>

          <div className="dash-nav-right">
            <div className="dash-telemetry-pill">
              <span className="telemetry-dot" />
              <span className="telemetry-text">
                {modelInfo
                  ? `Model loaded \u00b7 cut-off ${cutOffText}`
                  : modelError
                    ? 'Model unreachable'
                    : 'Loading model\u2026'}
              </span>
            </div>
            <button className="dash-back-btn" onClick={() => setShowLanding(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Back to Overview</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="shell dash-main">
        {/* Hero Section */}
        <section className="dash-hero">
          <div className="dash-hero-badge">
            <span className="dash-sparkle">✦</span>
            <span>Model-agnostic decision console</span>
          </div>
          <h1 className="dash-hero-title">Live Risk Decisioning Console</h1>
          <p className="dash-hero-desc">
            {features.length > 0
              ? `Score one row against the ${features.length}-feature interface this deployment declares, or screen a whole CSV through the same vectorised path.`
              : 'Score a single row or screen a whole CSV once the model interface has been read.'}
          </p>
          {modelInfo && (
            <p className="dash-hero-desc">
              Deployed model <strong>{modelInfo.version}</strong>
              {operatingPoint
                ? ` — held-out recall ${asPercent(operatingPoint.recall)} at ${asPercent(operatingPoint.precision)} precision, decision cut-off ${cutOffText} (source: ${modelInfo.threshold_source.replace(/_/g, ' ')}).`
                : `.`}
            </p>
          )}
          {modelError && (
            <p className="dash-hero-desc">
              Model metadata unavailable ({modelError}). Scoring below still goes to the live API; only the reported cut-off is missing.
            </p>
          )}
        </section>

        {/* Live Session Telemetry Stats */}
        <section className="dash-stats-grid">
          <div className="dash-stat-tile stat-total">
            <div className="stat-glow" />
            <span className="stat-label">TOTAL EVALUATED</span>
            <div className="stat-value">{sessionChecks.toLocaleString()}</div>
            <span className="stat-sub">Across active session</span>
          </div>

          <div className="dash-stat-tile stat-fraud">
            <div className="stat-glow" />
            <span className="stat-label">FLAGGED</span>
            <div className="stat-value text-fraud">{sessionFraud.toLocaleString()}</div>
            <span className="stat-sub">Over the cut-off</span>
          </div>

          <div className="dash-stat-tile stat-legit">
            <div className="stat-glow" />
            <span className="stat-label">CLEARED</span>
            <div className="stat-value text-legit">{sessionLegit.toLocaleString()}</div>
            <span className="stat-sub">Under the cut-off</span>
          </div>

          <div className="dash-stat-tile stat-rate">
            <div className="stat-glow" />
            <span className="stat-label">SESSION FLAG RATE</span>
            <div className="stat-value text-cyan">{fraudPercentage}%</div>
            <span className="stat-sub">Flagged ratio</span>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="dash-tabs-wrapper">
          <div className="dash-tabs">
            <button
              className={`dash-tab ${tab === 'single' ? 'is-active' : ''}`}
              onClick={() => setTab('single')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span>Single row check</span>
            </button>
            <button
              className={`dash-tab ${tab === 'batch' ? 'is-active' : ''}`}
              onClick={() => setTab('batch')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Batch CSV</span>
            </button>
          </div>
        </div>

        {/* SINGLE CHECK TAB */}
        {tab === 'single' && (
          <div className="dash-card">
            <div className="card-header-bar">
              <div>
                <h2 className="card-heading">Single Row Inspector</h2>
                <p className="card-subhead">
                  Enter every feature this model declares. The response carries the probability, the cut-off that was applied and the measured latency.
                </p>
              </div>

              {/* The only shortcuts offered are derived from the schema itself
                  (a zero vector is the mean row after standardisation) or from
                  the user's own input. Nothing dataset-specific is baked in. */}
              <div className="preset-group">
                <span className="preset-title">Presets:</span>
                <button
                  type="button"
                  className="preset-btn preset-safe"
                  onClick={() => setEdits({})}
                  disabled={features.length === 0}
                >
                  <span className="dot-green" />
                  Zero vector (mean row)
                </button>
                <button
                  type="button"
                  className="preset-btn preset-danger"
                  onClick={() => setEdits(lastScored)}
                  disabled={!lastScored}
                >
                  <span className="dot-red" />
                  Reload last scored vector
                </button>
              </div>
            </div>

            {modelStatus !== 'ready' ? (
              <div className="dash-banner banner-loading">
                <Spinner />
                <span>
                  {modelStatus === 'error'
                    ? `The model interface could not be read (${modelError}). This inspector needs GET /model to know which features to collect, and it will not guess.`
                    : 'Reading the model interface…'}
                </span>
              </div>
            ) : (
              <div className="dash-field-box">
                <div className="field-box-title">
                  <span>Features declared by the model ({features.length})</span>
                  <span className="field-box-note">Names and order come from GET /model</span>
                </div>

                {features.length > 12 && (
                  <input
                    type="search"
                    value={featureFilter}
                    onChange={(event) => setFeatureFilter(event.target.value)}
                    placeholder={`Filter ${features.length} features by name`}
                    aria-label="Filter features by name"
                    className="dash-input"
                  />
                )}

                <div className="dash-grid-technical">
                  {visibleFeatures.map((name) => (
                    <div key={name} className="dash-input-group technical-item">
                      <label htmlFor={`field-${name}`} className="dash-label-mono">{name}</label>
                      <input
                        id={`field-${name}`}
                        type="number"
                        step="any"
                        value={fields[name] ?? ''}
                        onChange={(e) => updateField(name, e.target.value)}
                        className="dash-input mono-input"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="action-row">
              <button
                className="btn-dash-primary"
                onClick={checkSingle}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner />
                    <span>Scoring…</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="10 8 16 12 10 16 10 8"/>
                    </svg>
                    <span>Score this row</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="dash-banner banner-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Result Readout Banner */}
            {result && (
              <div className={`dash-result-card ${result.is_fraud ? 'is-fraud' : 'is-legit'}`}>
                <div className="result-header">
                  <div className="result-verdict-wrap">
                    <span className="result-badge">
                      {result.is_fraud ? 'OVER THE CUT-OFF' : 'UNDER THE CUT-OFF'}
                    </span>
                    <h3 className="result-title">
                      {result.is_fraud ? 'Flagged for human review' : 'No review required'}
                    </h3>
                  </div>
                  <div className="result-score-block">
                    <span className="score-heading">RISK PROBABILITY</span>
                    <div className="score-huge">
                      {(result.fraud_probability * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="result-meter">
                  <div className="meter-track">
                    <div
                      className={`meter-fill ${result.is_fraud ? 'meter-danger' : 'meter-safe'}`}
                      style={{ width: `${result.fraud_probability * 100}%` }}
                    />
                  </div>
                  {/* The cut-off is deliberately not drawn on this meter: the old
                      label sat at the midpoint and claimed 0.50 while the model
                      was scoring against a different threshold. */}
                  <div className="meter-labels">
                    <span>0.00 (Safe)</span>
                    <span>1.00 (Severe)</span>
                  </div>
                </div>

                <div className="result-footer-meta">
                  <span>Scored in {Number(result.latency_ms).toFixed(1)} ms</span>
                  <span>
                    Model: {result.model_version} &middot; cut-off{' '}
                    {Number(result.threshold).toFixed(2)}
                  </span>
                  <span>
                    Transaction {String(result.transaction_id).slice(0, 12)}
                    {result.review_required ? ' queued for review' : ' cleared'}
                  </span>
                </div>
              </div>
            )}

            {/* Session Inspection History Table */}
            <div className="dash-history-section">
              <div className="history-header">
                <h3>Session Evaluation History</h3>
                <span className="history-count">{history.length} transactions recorded</span>
              </div>

              {history.length === 0 ? (
                <div className="dash-empty-state">
                  <div className="empty-icon">📊</div>
                  <p>Evaluated transactions from this session will appear here in real time.</p>
                </div>
              ) : (
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Transaction</th>
                        <th>Time Checked</th>
                        <th>Amount</th>
                        <th>Verdict</th>
                        <th>Risk Probability</th>
                        <th>Model Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i} className={h.is_fraud ? 'row-fraud' : 'row-legit'}>
                          <td className="font-mono text-cyan" title={h.id}>
                            {String(h.id).slice(0, 12)}
                          </td>
                          <td className="font-mono text-muted">{h.time}</td>
                          <td className="font-mono font-bold">
                            {typeof h.amount === 'number' ? `$${h.amount.toFixed(2)}` : '—'}
                          </td>
                          <td><VerdictBadge isFlagged={h.is_fraud} /></td>
                          <td className="font-mono font-bold">
                            <span className={h.is_fraud ? 'text-fraud' : 'text-legit'}>
                              {(h.fraud_probability * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="font-mono text-muted">
                            {Number(h.latency_ms).toFixed(1)} ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BATCH UPLOAD TAB */}
        {tab === 'batch' && (
          <div className="dash-card">
            <div className="card-header-bar">
              <div>
                <h2 className="card-heading">Batch CSV Screening</h2>
                <p className="card-subhead">
                  Screen a file of rows in a single vectorised inference pass. Rows are validated against the declared schema before anything is sent.
                </p>
              </div>
            </div>

            <p className="batch-format-hint">
              <strong>Expected schema:</strong>{' '}
              {features.length > 0 ? (
                <>
                  the header row must contain the {features.length} features this model
                  declares — <code>{features.slice(0, 4).join(', ')}</code>
                  {features.length > 4 ? `, … ${features.length} in total` : ''} — all
                  numeric.
                </>
              ) : (
                'waiting for GET /model to declare the expected columns.'
              )}
            </p>

            <label
              className="dash-upload-zone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="upload-input-hidden"
              />
              <div className="upload-icon-box">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <span className="upload-main-text">
                {fileName ? fileName : 'Click to select CSV file or drag and drop here'}
              </span>
              <span className="upload-sub-text">Standard CSV format &bull; Evaluated locally</span>
            </label>

            {batchLoading && (
              <div className="dash-banner banner-loading">
                <Spinner />
                <span>Processing batch records through inference pipeline...</span>
              </div>
            )}

            {batchError && (
              <div className="dash-banner banner-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                </svg>
                <span>{batchError}</span>
              </div>
            )}

            {!batchResults && !batchLoading && !batchError && (
              <div className="dash-empty-state">
                <div className="empty-icon">📁</div>
                <p>Upload a transaction CSV dataset above to display audit results and classification breakdown.</p>
              </div>
            )}

            {batchResults && (
              <div className="batch-results-area">
                <div className="batch-summary-strip">
                  <div className="summary-pill total">
                    <span>Total Rows</span>
                    <strong>{batchResults.total.toLocaleString()}</strong>
                  </div>
                  <div className="summary-pill fraud">
                    <span>Flagged Fraud</span>
                    <strong>{batchResults.fraud_count.toLocaleString()}</strong>
                  </div>
                  <div className="summary-pill legit">
                    <span>Approved Legit</span>
                    <strong>{(batchResults.total - batchResults.fraud_count).toLocaleString()}</strong>
                  </div>
                  <div className="summary-pill rate">
                    <span>Flagged Ratio</span>
                    <strong>{((batchResults.fraud_count / batchResults.total) * 100).toFixed(2)}%</strong>
                  </div>
                  <div className="summary-pill rate">
                    <span>Model Time</span>
                    <strong>{Number(batchResults.latency_ms).toFixed(1)} ms</strong>
                  </div>
                </div>

                <p className="batch-format-hint">
                  Scored with <strong>{batchResults.model_version}</strong> at cut-off{' '}
                  {Number(batchResults.threshold).toFixed(2)} —{' '}
                  {(Number(batchResults.latency_ms) / Math.max(batchResults.total, 1) * 1000).toFixed(0)}
                  {' '}µs per row across {batchResults.total.toLocaleString()} rows.
                </p>

                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Amount</th>
                        <th>Verdict</th>
                        <th>Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.results.slice(0, 50).map((r, i) => (
                        <tr key={i} className={r.is_fraud ? 'row-fraud' : 'row-legit'}>
                          <td className="font-mono text-muted">{i + 1}</td>
                          <td className="font-mono font-bold">
                            {typeof r.Amount === 'number' ? `$${r.Amount.toFixed(2)}` : '—'}
                          </td>
                          <td><VerdictBadge isFlagged={r.is_fraud} /></td>
                          <td className="font-mono font-bold">
                            <span className={r.is_fraud ? 'text-fraud' : 'text-legit'}>
                              {(r.fraud_probability * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {batchResults.results.length > 50 && (
                  <p className="table-pagination-note">
                    Showing first 50 of {batchResults.results.length.toLocaleString()} transactions.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App