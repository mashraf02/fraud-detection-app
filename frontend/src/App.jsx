import { useState } from 'react'
import Papa from 'papaparse'
import Landing from './Landing'
import './App.css'

const FIELD_NAMES = ['Time', 'Amount', ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`)]
const PRIMARY_FIELDS = ['Time', 'Amount']
const TECHNICAL_FIELDS = FIELD_NAMES.filter((n) => !PRIMARY_FIELDS.includes(n))

const DEFAULT_VALUES = {
  Time: 406, Amount: 0,
  V1: -2.3122265423263, V2: 1.95199201064158, V3: -1.60985073229769,
  V4: 3.9979055875468, V5: -0.522187864667764, V6: -1.42654531920595,
  V7: -2.53738730624579, V8: 1.39165724829804, V9: -2.77008927719433,
  V10: -2.77227214465915, V11: 3.20203320709635, V12: -2.89990738849473,
  V13: -0.595221881324605, V14: -4.28925378244217, V15: 0.389724120274487,
  V16: -1.14074717980657, V17: -2.83005567450437, V18: -0.0168224681808257,
  V19: 0.416955705037907, V20: 0.126910559061474, V21: 0.517232370861764,
  V22: -0.0350493686052974, V23: -0.465211076182388, V24: 0.320198198514526,
  V25: 0.0445191674731724, V26: 0.177839798284401, V27: 0.261145002567677,
  V28: -0.143275874698919,
}

const LEGIT_SAMPLE_VALUES = {
  Time: 1204, Amount: 38.50,
  V1: 0.1211, V2: -0.0524, V3: 0.2241, V4: -0.1582, V5: 0.0814, V6: -0.0219,
  V7: 0.1145, V8: -0.0432, V9: 0.0618, V10: -0.0812, V11: 0.1423, V12: -0.0312,
  V13: 0.0519, V14: 0.0214, V15: -0.1245, V16: 0.0912, V17: -0.0184, V18: 0.0421,
  V19: -0.0612, V20: 0.0142, V21: -0.0215, V22: 0.0512, V23: -0.0142, V24: 0.0315,
  V25: -0.0418, V26: 0.0214, V27: -0.0112, V28: 0.0105,
}

const API_BASE = 'http://localhost:8000'

function VerdictBadge({ isFraud }) {
  return (
    <span className={`dash-badge ${isFraud ? 'dash-badge-fraud' : 'dash-badge-legit'}`}>
      <span className="badge-dot" />
      <span>{isFraud ? 'FRAUD' : 'LEGIT'}</span>
    </span>
  )
}

function Spinner() {
  return <span className="dash-spinner" aria-hidden="true" />
}

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [tab, setTab] = useState('single')
  const [fields, setFields] = useState(DEFAULT_VALUES)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const [batchResults, setBatchResults] = useState(null)
  const [batchError, setBatchError] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [fileName, setFileName] = useState(null)

  const sessionChecks = history.length + (batchResults ? batchResults.total : 0)
  const sessionFraud = history.filter((h) => h.is_fraud).length + (batchResults ? batchResults.fraud_count : 0)
  const sessionLegit = sessionChecks - sessionFraud
  const fraudPercentage = sessionChecks > 0 ? ((sessionFraud / sessionChecks) * 100).toFixed(1) : '0.0'

  function updateField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }))
  }

  async function checkSingle() {
    setError(null)
    setResult(null)
    setLoading(true)

    const payload = {}
    for (const name of FIELD_NAMES) {
      const num = parseFloat(fields[name])
      if (Number.isNaN(num)) {
        setError(`"${name}" is not a valid number.`)
        setLoading(false)
        return
      }
      payload[name] = num
    }

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      setResult(data)
      setHistory((prev) => [
        {
          id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
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
          const rows = parsed.data.map((row) => {
            const clean = {}
            for (const name of FIELD_NAMES) {
              clean[name] = row[name]
            }
            return clean
          })

          const res = await fetch(`${API_BASE}/predict/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rows),
          })
          if (!res.ok) throw new Error(`API returned ${res.status}`)
          const data = await res.json()
          setBatchResults(data)
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
              <span className="telemetry-text">Model Online &bull; &lt;15ms</span>
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
            <span>Real-Time ML Decision Engine</span>
          </div>
          <h1 className="dash-hero-title">Live Fraud Screening Console</h1>
          <p className="dash-hero-desc">
            Test single edge-case transactions with 30-feature vector inputs or run high-throughput batch CSV evaluations against calibrated decision thresholds.
          </p>
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
            <span className="stat-label">FLAGGED FRAUD</span>
            <div className="stat-value text-fraud">{sessionFraud.toLocaleString()}</div>
            <span className="stat-sub">Triggered review cutoff</span>
          </div>

          <div className="dash-stat-tile stat-legit">
            <div className="stat-glow" />
            <span className="stat-label">VERIFIED LEGIT</span>
            <div className="stat-value text-legit">{sessionLegit.toLocaleString()}</div>
            <span className="stat-sub">Normal behavioral range</span>
          </div>

          <div className="dash-stat-tile stat-rate">
            <div className="stat-glow" />
            <span className="stat-label">SESSION FRAUD RATE</span>
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
              <span>Single Transaction Check</span>
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
              <span>Batch CSV Screener</span>
            </button>
          </div>
        </div>

        {/* SINGLE CHECK TAB */}
        {tab === 'single' && (
          <div className="dash-card">
            <div className="card-header-bar">
              <div>
                <h2 className="card-heading">Single Transaction Inspector</h2>
                <p className="card-subhead">
                  Specify transaction features to compute probability and decision classification.
                </p>
              </div>

              {/* Presets */}
              <div className="preset-group">
                <span className="preset-title">Presets:</span>
                <button
                  type="button"
                  className="preset-btn preset-danger"
                  onClick={() => setFields(DEFAULT_VALUES)}
                >
                  <span className="dot-red" />
                  Load Known Fraud Pattern
                </button>
                <button
                  type="button"
                  className="preset-btn preset-safe"
                  onClick={() => setFields(LEGIT_SAMPLE_VALUES)}
                >
                  <span className="dot-green" />
                  Load Normal Purchase
                </button>
              </div>
            </div>

            {/* Primary Fields */}
            <div className="dash-field-box">
              <div className="field-box-title">
                <span>Core Transaction Details</span>
                <span className="field-box-note">Direct merchant payload</span>
              </div>
              <div className="dash-grid-primary">
                {PRIMARY_FIELDS.map((name) => (
                  <div key={name} className="dash-input-group">
                    <label htmlFor={`field-${name}`} className="dash-label">
                      <span>{name}</span>
                      <span className="label-sub">{name === 'Time' ? '(Seconds from epoch)' : '(USD Amount)'}</span>
                    </label>
                    <input
                      id={`field-${name}`}
                      type="number"
                      step="any"
                      value={fields[name]}
                      onChange={(e) => updateField(name, e.target.value)}
                      className="dash-input primary-input"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Technical PCA Features */}
            <div className="dash-field-box">
              <div className="field-box-title">
                <span>Technical PCA Behavioral Features (V1 &ndash; V28)</span>
                <span className="field-box-note">Standardized behavioral projections</span>
              </div>
              <div className="dash-grid-technical">
                {TECHNICAL_FIELDS.map((name) => (
                  <div key={name} className="dash-input-group technical-item">
                    <label htmlFor={`field-${name}`} className="dash-label-mono">{name}</label>
                    <input
                      id={`field-${name}`}
                      type="number"
                      step="any"
                      value={fields[name]}
                      onChange={(e) => updateField(name, e.target.value)}
                      className="dash-input mono-input"
                    />
                  </div>
                ))}
              </div>
            </div>

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
                    <span>Evaluating Telemetry...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="10 8 16 12 10 16 10 8"/>
                    </svg>
                    <span>Run Fraud Assessment</span>
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
                      {result.is_fraud ? 'HIGH RISK DETECTED' : 'LOW RISK VERIFIED'}
                    </span>
                    <h3 className="result-title">
                      {result.is_fraud ? 'Flagged for Human Review' : 'Transaction Approved as Normal'}
                    </h3>
                  </div>
                  <div className="result-score-block">
                    <span className="score-heading">FRAUD PROBABILITY</span>
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
                  <div className="meter-labels">
                    <span>0.00 (Safe)</span>
                    <span>0.50 (Decision Cutoff)</span>
                    <span>1.00 (Severe)</span>
                  </div>
                </div>

                <div className="result-footer-meta">
                  <span>Processed locally in &lt;15ms</span>
                  <span>Model: StandardScaler + Logistic Regression (Balanced)</span>
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
                        <th>ID</th>
                        <th>Time Checked</th>
                        <th>Amount</th>
                        <th>Verdict</th>
                        <th>Risk Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i} className={h.is_fraud ? 'row-fraud' : 'row-legit'}>
                          <td className="font-mono text-cyan">{h.id}</td>
                          <td className="font-mono text-muted">{h.time}</td>
                          <td className="font-mono font-bold">${typeof h.amount === 'number' ? h.amount.toFixed(2) : h.amount}</td>
                          <td><VerdictBadge isFraud={h.is_fraud} /></td>
                          <td className="font-mono font-bold">
                            <span className={h.is_fraud ? 'text-fraud' : 'text-legit'}>
                              {(h.fraud_probability * 100).toFixed(1)}%
                            </span>
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
                <h2 className="card-heading">High-Throughput Batch CSV Screening</h2>
                <p className="card-subhead">
                  Screen entire datasets containing thousands of transactions in a single vectorized inference cycle.
                </p>
              </div>
            </div>

            <p className="batch-format-hint">
              <strong>Expected Schema:</strong> Header row must contain <code>Time</code>, <code>Amount</code>, and <code>V1</code> through <code>V28</code> columns.
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
                </div>

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
                          <td className="font-mono font-bold">${typeof r.Amount === 'number' ? r.Amount.toFixed(2) : r.Amount}</td>
                          <td><VerdictBadge isFraud={r.is_fraud} /></td>
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