// Language context, hook and helpers.
//
// Kept separate from i18n.jsx so that file only exports a component — the
// react-refresh lint rule requires components and non-components to live apart.

import { createContext, useContext } from 'react'

export const STORAGE_KEY = 'fraud-radar-lang'
export const SUPPORTED_LANGUAGES = ['en', 'bn']
export const FALLBACK_LANGUAGE = 'en'

export const LanguageContext = createContext(null)

export function resolve(tree, path) {
  return path
    .split('.')
    .reduce((node, key) => (node == null ? undefined : node[key]), tree)
}

export function detectInitialLanguage() {
  if (typeof window === 'undefined') return FALLBACK_LANGUAGE
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved
  } catch {
    /* localStorage unavailable (private mode) — fall through to navigator */
  }
  const browser = window.navigator?.language?.toLowerCase() ?? ''
  return browser.startsWith('bn') ? 'bn' : FALLBACK_LANGUAGE
}

export function useI18n() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useI18n must be used inside a <LanguageProvider>')
  return context
}
