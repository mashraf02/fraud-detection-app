// The deployment's model interface, as declared by the API.
//
// Nothing about the model is hardcoded in the frontend any more: the feature
// names and their order come from `GET /model`, so the same console drives a
// credit-card fraud model, a payments risk model, or anything else that exposes
// the same contract. When the schema cannot be read, callers say so — they never
// fall back to a guessed feature list, which would silently score the wrong
// vector.

import { useEffect, useMemo, useState } from 'react'

import { fetchModelInfo } from './api'

export function useModel() {
  const [state, setState] = useState({ status: 'loading', model: null, error: null })

  useEffect(() => {
    const controller = new AbortController()

    fetchModelInfo({ signal: controller.signal })
      .then((model) => setState({ status: 'ready', model, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setState({ status: 'error', model: null, error: error.message })
      })

    return () => controller.abort()
  }, [])

  const model = state.model
  // Memoised so consumers can depend on `features` in an effect without it
  // changing identity on every render.
  const features = useMemo(() => model?.features ?? [], [model])
  const metrics = model?.metrics ?? {}
  const dataset = model?.dataset ?? {}
  const runtime = model?.runtime ?? {}

  return {
    ...state,
    model,
    features,
    metrics,
    dataset,
    runtime,
    // Held-out performance at the cut-off actually in force, when the artifact
    // reports it. Absent fields stay null so callers show a dash, not a zero.
    operatingPoint: metrics.operating_point ?? null,
    cutOff: model?.effective_threshold ?? null,
    thresholdSource: model?.threshold_source ?? null,
    rocAuc: metrics.roc_auc ?? null,
    prAuc: metrics.pr_auc ?? null,
    prAucBaseline: metrics.pr_auc_baseline ?? null,
    featureCount: features.length || null,
  }
}

/** A zero vector for the declared schema: the dataset mean, post-standardisation. */
export function zeroVector(features) {
  return Object.fromEntries(features.map((name) => [name, 0]))
}
