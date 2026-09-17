import { useEffect, useRef, useState } from 'react'
import './Landing.css'

function AnimatedStat({ target, decimals = 0, suffix = '', label }) {
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
            const duration = 1200
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
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  const display =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString()

  return (
    <div className="stat" ref={ref}>
      <div className="stat-value">{display}{suffix}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function Landing({ onLaunch }) {
  useEffect(() => {
    const sections = document.querySelectorAll('.landing .section')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing">

      <nav className="landing-nav shell">
        <div className="nav-brand">
          <span className="brand-glyph" />
          <span>Fraud Radar</span>
        </div>
        <div className="nav-links">
          <a href="#pipeline">How it works</a>
          <a href="#results">Results</a>
          <a href="#limits">Limitations</a>
        </div>
        <div className="nav-right">
          <span className="nav-tag">Prototype</span>
          <a
            href="https://github.com/mashraf02/fraud-detection-app"
            target="_blank"
            rel="noreferrer"
            className="nav-github"
          >
            GitHub
          </a>
          <button className="nav-cta" onClick={onLaunch}>
            Open dashboard
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-grid shell">
          <div>
            <h1>
              Most fraud
              <span className="accent-line">doesn't look like fraud.</span>
            </h1>
            <p className="hero-sub">
              Fraud Radar scores card transactions for suspicious behavior
              and surfaces the handful of cases that deserve a second look
              from a human.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={onLaunch}>
                Try the demo
              </button>
              <a href="#pipeline" className="btn btn-secondary">
                See how scoring works
              </a>
            </div>
            <p className="hero-note">
              A local prototype trained on a public benchmark dataset.
              Nothing you enter here is stored.
            </p>
          </div>

          <div className="hero-visual">
            <div className="radar" aria-hidden="true">
              <div className="radar-ring radar-ring-1" />
              <div className="radar-ring radar-ring-2" />
              <div className="radar-ring radar-ring-3" />
              <div className="radar-sweep" />
              <div className="radar-point point-1" />
              <div className="radar-point point-2" />
              <div className="radar-point point-3" />
            </div>

            <div className="score-card">
              <div className="score-card-top">
                <span>Transaction score</span>
                <span>live</span>
              </div>
              <div className="score-value">0.874</div>
              <div className="score-caption">fraud probability</div>
              <div className="score-flag">
                <span className="is-flagged">Flagged for review</span>
                <span>threshold 0.50</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="stats">
        <div className="stats-row shell">
          <AnimatedStat target={284807} label="transactions in the benchmark set" />
          <AnimatedStat target={492} label="of those were fraudulent" />
          <AnimatedStat target={0.17} decimals={2} suffix="%" label="overall fraud rate" />
          <AnimatedStat target={30} label="features the model reads" />
        </div>
      </section>

      <section className="section">
        <div className="shell problem-layout">
          <div>
            <h2>Rare events are the hard part.</h2>
          </div>
          <div className="problem-copy">
            <p>
              When fraud is a tiny fraction of all transactions, the
              challenge isn't classifying the obvious cases — it's finding
              the few that hide inside an overwhelming majority of normal
              ones.
            </p>
            <p>
              A model that labels every transaction as legitimate would
              still score extremely high on accuracy, while catching
              nothing.
            </p>
            <div className="pull-callout">
              <div className="pull-number">99.8%</div>
              <p>
                accuracy, and still useless — if it comes from ignoring
                fraud entirely rather than finding it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pipeline">
        <div className="shell">
          <h2>From transaction to risk signal.</h2>
          <p className="section-lede">
            A transaction moves through four steps before a person ever
            sees it.
          </p>

          <div className="pipeline">
            <div className="pipeline-step">
              <span className="pipeline-num">1</span>
              <h3>Receive</h3>
              <p>The transaction's 30 numeric features arrive as a single request.</p>
            </div>
            <div className="pipeline-step">
              <span className="pipeline-num">2</span>
              <h3>Normalize</h3>
              <p>A StandardScaler puts every value on the same scale used during training.</p>
            </div>
            <div className="pipeline-step">
              <span className="pipeline-num">3</span>
              <h3>Score</h3>
              <p>Logistic regression converts the features into a probability between 0 and 1.</p>
            </div>
            <div className="pipeline-step">
              <span className="pipeline-num">4</span>
              <h3>Review</h3>
              <p>Anything above the threshold is surfaced for a person to check.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <h2>One transaction, or a few thousand.</h2>
          <p className="section-lede">
            The same model runs either way — the difference is how many
            transactions go in at once.
          </p>

          <div className="modes">
            <div className="mode">
              <span className="mode-tag">Single check</span>
              <h3>Inspect one transaction</h3>
              <p>
                Send a transaction to the scoring endpoint and get its
                probability and verdict back immediately.
              </p>
              <div className="mode-readout">
                <span>TXN_001847</span>
                <span className="is-flagged">0.874 — review</span>
              </div>
              <button className="mode-link" onClick={onLaunch}>
                Run a single check
              </button>
            </div>

            <div className="mode">
              <span className="mode-tag">Batch upload</span>
              <h3>Screen a whole CSV</h3>
              <p>
                Upload a file with the same columns as the training data.
                Every row is scored in one request.
              </p>
              <div className="mode-readout">
                <span>2,481 rows</span>
                <span className="is-flagged">37 flagged</span>
              </div>
              <button className="mode-link" onClick={onLaunch}>
                Run a batch check
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell model-layout">
          <div>
            <h2>A simple model, on purpose.</h2>
            <p className="section-lede">
              Logistic regression with balanced class weighting. Nothing
              here is hidden behind a black box.
            </p>
          </div>

          <div className="model-diagram">
            <div className="model-row">
              <div className="model-node">
                <div className="node-value">30</div>
                <div className="node-label">features</div>
              </div>
              <span className="model-arrow">→</span>
              <div className="model-node">
                <div className="node-value">σ</div>
                <div className="node-label">sigmoid</div>
              </div>
              <span className="model-arrow">→</span>
              <div className="model-node is-output">
                <div className="node-value">0–1</div>
                <div className="node-label">probability</div>
              </div>
            </div>

            <div className="model-files">
              <div><code>fraud_model.pkl</code><span>trained classifier</span></div>
              <div><code>scaler.pkl</code><span>feature normalization</span></div>
              <div><code>feature_order.pkl</code><span>expected input order</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="results">
        <div className="shell">
          <h2>Tuned to catch fraud, not to look clean.</h2>
          <p className="section-lede">
            These numbers come from the current proof-of-concept model at
            its chosen threshold.
          </p>

          <div className="results">
            <div className="result is-primary">
              <div className="result-label">Recall</div>
              <div className="result-value">92%</div>
              <p>of fraud cases caught at the current threshold.</p>
            </div>
            <div className="result">
              <div className="result-label">ROC-AUC</div>
              <div className="result-value">0.97</div>
              <p>discrimination across all possible thresholds.</p>
            </div>
            <div className="result">
              <div className="result-label">Precision</div>
              <div className="result-value">6%</div>
              <p>most flagged cases still need a human look.</p>
            </div>
          </div>

          <p className="threshold-note">
            <strong>Thresholds are a trade-off.</strong> A lower threshold
            catches more fraud but creates more false alarms. This model
            is tuned to favor catching fraud over keeping the review queue
            small.
          </p>
        </div>
      </section>

      <section className="section" id="limits">
        <div className="shell">
          <h2>Where this stops being a prototype.</h2>
          <p className="section-lede">
            These are the pieces that would need to change before this
            could run on real traffic.
          </p>

          <div className="limits">
            <div className="limit">
              <h3>Anonymized features</h3>
              <p>
                The benchmark dataset uses PCA-transformed features
                (V1–V28), so the model can't yet accept a merchant's raw
                transaction schema.
              </p>
            </div>
            <div className="limit">
              <h3>No persistent storage</h3>
              <p>
                History and session stats live only in React state and
                disappear when the tab closes.
              </p>
            </div>
            <div className="limit">
              <h3>Precision needs work</h3>
              <p>
                The current threshold produces a large review queue —
                fine for a demo, not for real transaction volumes.
              </p>
            </div>
            <div className="limit">
              <h3>No authentication</h3>
              <p>
                This is a local, single-user proof of concept, not a
                production application.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <h2>What's next.</h2>

          <div className="roadmap">
            <div className="roadmap-item">
              <h3>Better models</h3>
              <p>Try gradient boosting and other approaches built for imbalanced data.</p>
            </div>
            <div className="roadmap-item">
              <h3>Real feature schemas</h3>
              <p>Support transaction fields based on merchant, device, and customer behavior.</p>
            </div>
            <div className="roadmap-item">
              <h3>A persistent review queue</h3>
              <p>Add authentication, storage, and an actual analyst workflow.</p>
            </div>
            <div className="roadmap-item">
              <h3>Adjustable thresholds</h3>
              <p>Let a team tune the trade-off between missed fraud and false alarms themselves.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta shell">
        <h2>Send a transaction. See what the model finds.</h2>
        <p className="section-lede">
          The full pipeline runs locally — nothing leaves your machine.
        </p>
        <button className="btn btn-primary" onClick={onLaunch}>
          Open Fraud Radar
        </button>
      </section>

      <footer className="landing-footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <div className="nav-brand">
              <span className="brand-glyph" />
              <span>Fraud Radar</span>
            </div>
            <p>A fraud screening prototype built on a public benchmark dataset.</p>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <a href="#pipeline">How it works</a>
            <a href="#results">Results</a>
            <a href="#limits">Limitations</a>
          </div>

          <div className="footer-col">
            <h4>Resources</h4>
            <a
              href="https://github.com/mashraf02/fraud-detection-app"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repository
            </a>
            <a
              href="https://github.com/mashraf02/fraud-detection-app/blob/main/README.md"
              target="_blank"
              rel="noreferrer"
            >
              README
            </a>
            <a
              href="https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud"
              target="_blank"
              rel="noreferrer"
            >
              Dataset
            </a>
          </div>

          <div className="footer-col">
            <h4>Built by</h4>
            <a
              href="https://github.com/mashraf02"
              target="_blank"
              rel="noreferrer"
            >
              Mashraful
            </a>
            <span className="footer-note">CS undergraduate, IUB</span>
          </div>
        </div>

        <div className="footer-bottom shell">
          <span>Fraud Radar &mdash; internship prototype</span>
        </div>
      </footer>

    </div>
  )
}