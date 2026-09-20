// Verifies that every t('...') key used in the landing page resolves in every
// locale. A missing key renders as the raw dotted path on screen, which the
// build and the linter both accept silently — so it needs its own check.
//
// Usage (from the repo root):  node .freebuff/check-keys.mjs

import { readFileSync } from 'node:fs'

import { translations } from '../frontend/src/translations.js'

const LOCALES = Object.keys(translations)
const FILES = ['../frontend/src/Landing.jsx']

const resolve = (tree, path) =>
  path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), tree)

const findings = []
const used = new Set()

for (const relative of FILES) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
    used.add(match[1])
  }
}

for (const key of [...used].sort()) {
  for (const locale of LOCALES) {
    const value = resolve(translations[locale], key)
    if (value === undefined || value === '') {
      findings.push(`UNRESOLVED  ${locale}  ${key}`)
    }
  }
}

// Catalogue entries nobody renders any more are dead weight, so report them too.
const unused = []
const walk = (node, prefix = '') => {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      walk(value, path)
    } else {
      // A key counts as used when it, or any ancestor object, was requested —
      // `t('simulator.scenarios')` covers every nested scenario string.
      const parts = path.split('.')
      const covered = parts.some((_, index) =>
        used.has(parts.slice(0, index + 1).join('.')),
      )
      if (!covered) unused.push(path)
    }
  }
}
walk(translations.en)

for (const line of findings) console.log(line)
for (const line of unused) console.log(`UNUSED      en  ${line}`)

console.log(
  findings.length === 0
    ? `OK — every t() key resolves in ${LOCALES.join(', ')}`
    : `${findings.length} unresolved key(s)`,
)
process.exit(findings.length === 0 ? 0 : 1)
