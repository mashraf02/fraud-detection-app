// Single place that knows where the API lives and how to talk to it.
//
// Relative by default: the Vite dev server (see vite.config.js) and the
// production nginx image both proxy /api to the backend, so the browser only
// ever talks to one origin and no CORS is involved.

export const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(message, { status = null, code = null, problems = [] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.problems = problems
  }
}

/**
 * The API answers every failure — validation, HTTP, unhandled — with the same
 * envelope: { error: { code, message, details, request_id } }. Turning that into
 * a readable sentence here keeps every call site from re-parsing it.
 */
async function toApiError(response) {
  let code = null
  let message = response.statusText || `Request failed with status ${response.status}`
  let problems = []

  try {
    const payload = await response.json()
    const error = payload?.error
    if (error) {
      code = error.code ?? null
      if (typeof error.message === 'string') message = error.message
      const raw = error.details?.problems
      if (Array.isArray(raw)) {
        // Field-level validation failures: name the offending fields so the
        // caller can show "Row 42: V14 is required" instead of a bare 422.
        problems = raw.map((item) => ({
          field: String(item?.field ?? '').replace(/^body\./, ''),
          issue: item?.problem ?? 'invalid',
        }))
        if (problems.length) {
          message = problems
            .slice(0, 5)
            .map((item) => `${item.field}: ${item.issue}`)
            .join(', ')
        }
      }
    } else if (Array.isArray(payload?.detail)) {
      message = payload.detail.map((item) => item?.msg ?? String(item)).join(', ')
    }
  } catch {
    /* Non-JSON error body — keep the status-line message. */
  }

  return new ApiError(message, { status: response.status, code, problems })
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause
    throw new ApiError(
      'Cannot reach the scoring API. Is the backend running?',
      { code: 'network_error' },
    )
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return null
  return response.json()
}

export const fetchHealth = (options) => request('/health', options)

/** Live model version, effective threshold and evaluated metrics. */
export const fetchModelInfo = (options) => request('/model', options)

/** Readiness: reports whether the database and model are actually usable. */
export const fetchReadiness = (options) => request('/ready', options)

export const predictTransaction = (features, options) =>
  request('/predict', { ...options, method: 'POST', body: features })

export const predictBatch = (rows, options) =>
  request('/predict/batch', { ...options, method: 'POST', body: rows })

export const fetchPredictionHistory = (params = {}, options = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ).toString()
  return request(`/predictions${query ? `?${query}` : ''}`, options)
}

export const fetchReviewQueue = (params = {}, options = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ).toString()
  return request(`/review-queue${query ? `?${query}` : ''}`, options)
}

export const fetchTransactionDetail = (transactionId, options) =>
  request(`/transactions/${encodeURIComponent(transactionId)}`, options)

export const submitDecision = (transactionId, decision, options) =>
  request(`/transactions/${encodeURIComponent(transactionId)}/decision`, {
    ...options,
    method: 'POST',
    body: decision,
  })
