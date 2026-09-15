import { useState } from 'react'
import './App.css'

const DEFAULT_TX = JSON.stringify({
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
}, null, 2)

function App() {
  const [txInput, setTxInput] = useState(DEFAULT_TX)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function checkFraud() {
    setError(null)
    setResult(null)

    let parsed
    try {
      parsed = JSON.parse(txInput)
    } catch (e) {
      setError('Invalid JSON — check your syntax.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h2>Credit Card Fraud Checker</h2>
      <p>Paste a transaction as JSON (Time, Amount, V1–V28):</p>
      <textarea
        value={txInput}
        onChange={(e) => setTxInput(e.target.value)}
        rows={12}
      />
      <button onClick={checkFraud} disabled={loading}>
        {loading ? 'Checking...' : 'Check Transaction'}
      </button>

      {error && <div className="result error">{error}</div>}

      {result && (
        <div className={`result ${result.is_fraud ? 'fraud' : 'legit'}`}>
          {result.is_fraud
            ? `Likely FRAUD — probability ${result.fraud_probability}`
            : `Looks legit — fraud probability ${result.fraud_probability}`}
        </div>
      )}
    </div>
  )
}

export default App