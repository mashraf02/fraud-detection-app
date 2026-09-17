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

const API_BASE = 'http://localhost:8000'

function VerdictBadge({ isFraud }) {
  return (
    <span className={`badge ${isFraud ? 'badge-fraud' : 'badge-legit'}`}>
      {isFraud ? 'Fraud' : 'Legit'}
    </span>
  )
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

  const sessionChecks = history.length + (batchResults ? batchResults.total : 0)
  const sessionFraud = history.filter((h) => h.is_fraud).length + (batchResults ? batchResults.fraud_count : 0)
  const sessionLegit = sessionChecks - sessionFraud

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

  function handleCsvUpload(e) {
    const file = e.target.files[0]
    if (!file) return

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

  if (showLanding) {
    return <Landing onLaunch={() => setShowLanding(false)} />
  }

  return (
    <div className="page">
      <nav className="dash-nav">
        <div className="dash-brand">
          <span className="dash-brand-glyph" />
          <span>Fraud Radar</span>
        </div>
        <button className="dash-back-btn" onClick={() => setShowLanding(true)}>Back to overview</button>
      </nav>

      <header className="hero">
        <h1>Live Fraud Check</h1>
        <p>Credit card transaction fraud checker</p>
      </header>

      <div className="stats-strip">
        <div className="stat-tile stat-brand">
          <span className="stat-value">{sessionChecks}</span>
          <span className="stat-label">Checked this session</span>
        </div>
        <div className="stat-tile stat-fraud">
          <span className="stat-value">{sessionFraud}</span>
          <span className="stat-label">Flagged as fraud</span>
        </div>
        <div className="stat-tile stat-legit">
          <span className="stat-value">{sessionLegit}</span>
          <span className="stat-label">Looked legit</span>
        </div>
      </div>

      <nav className="tabs">
        <button className={tab === 'single' ? 'tab active' : 'tab'} onClick={() => setTab('single')}>
          Single Check
        </button>
        <button className={tab === 'batch' ? 'tab active' : 'tab'} onClick={() => setTab('batch')}>
          Batch Upload
        </button>
      </nav>

      {tab === 'single' && (
        <section className="card card-brand">
          <h2>Check a transaction</h2>
          <div className="field-section">
            <h3 className="field-section-title">Transaction details</h3>
            <div className="field-grid field-grid-primary">
              {PRIMARY_FIELDS.map((name) => (
                <label key={name} className="field field-primary">
                  <span>{name}</span>
                  <input
                    type="number"
                    step="any"
                    value={fields[name]}
                    onChange={(e) => updateField(name, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="field-section">
            <h3 className="field-section-title">Technical features (V1&ndash;V28)</h3>
            <p className="field-section-hint">Anonymized model inputs, pre-filled with a sample transaction.</p>
            <div className="field-grid field-grid-technical">
              {TECHNICAL_FIELDS.map((name) => (
                <label key={name} className="field">
                  <span>{name}</span>
                  <input
                    type="number"
                    step="any"
                    value={fields[name]}
                    onChange={(e) => updateField(name, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <button className="primary-btn" onClick={checkSingle} disabled={loading}>
            {loading ? 'Checking...' : 'Check Transaction'}
          </button>

          {error && <div className="banner error">{error}</div>}
          {result && (
            <div className={`banner ${result.is_fraud ? 'fraud' : 'legit'}`}>
              {result.is_fraud
                ? `Likely FRAUD — probability ${result.fraud_probability}`
                : `Looks legit — fraud probability ${result.fraud_probability}`}
            </div>
          )}

          {history.length > 0 && (
            <div className="history">
              <h3>History (this session)</h3>
              <table>
                <thead>
                  <tr><th>Time checked</th><th>Amount</th><th>Verdict</th><th>Probability</th></tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.time}</td>
                      <td>${h.amount}</td>
                      <td><VerdictBadge isFraud={h.is_fraud} /></td>
                      <td>{h.fraud_probability}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'batch' && (
        <section className="card card-gold">
          <h2>Batch upload (CSV)</h2>
          <p className="hint">
            CSV must have columns: Time, Amount, V1–V28 (same format as the training dataset).
          </p>
          <input type="file" accept=".csv" onChange={handleCsvUpload} />

          {batchLoading && <div className="banner">Processing...</div>}
          {batchError && <div className="banner error">{batchError}</div>}

          {batchResults && (
            <>
              <div className="banner summary">
                {batchResults.fraud_count} of {batchResults.total} transactions flagged as fraud
              </div>
              <table>
                <thead>
                  <tr><th>#</th><th>Amount</th><th>Verdict</th><th>Probability</th></tr>
                </thead>
                <tbody>
                  {batchResults.results.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>${r.Amount}</td>
                      <td><VerdictBadge isFraud={r.is_fraud} /></td>
                      <td>{r.fraud_probability}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default App