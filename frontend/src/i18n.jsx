import { useEffect, useMemo, useState } from 'react'
import { translations } from './translations'
import {
  FALLBACK_LANGUAGE,
  LanguageContext,
  STORAGE_KEY,
  detectInitialLanguage,
  resolve,
} from './i18n-context'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectInitialLanguage)

  useEffect(() => {
    // Drives the `html[lang='bn']` font rules in Landing.css and helps screen readers.
    document.documentElement.lang = lang
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [lang])

  const value = useMemo(() => {
    // Resolves dotted paths and returns strings, arrays or objects. Missing or
    // empty keys fall back to English, so a partial locale never renders blank.
    //
    // `t('a.b')`                    -> string
    // `t('a.b', { ms: 12.4 })`      -> string with {{ms}} substituted
    // `t('a.b', 'literal fallback')`-> string (second arg as a string is the
    //                                  legacy fallback form, kept working)
    const t = (path, params, fallback) => {
      const values = params && typeof params === 'object' ? params : undefined
      const orElse = values ? fallback : params

      const hit = resolve(translations[lang], path)
      const value =
        hit !== undefined && hit !== ''
          ? hit
          : resolve(translations[FALLBACK_LANGUAGE], path)

      if (value === undefined || value === '') {
        return orElse !== undefined ? orElse : path
      }
      if (typeof value === 'string' && values) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, key) =>
          values[key] === undefined || values[key] === null
            ? match
            : String(values[key]),
        )
      }
      return value
    }

    const locale = lang === 'bn' ? 'bn-BD' : 'en-US'

    return {
      lang,
      locale,
      setLang,
      toggleLanguage: () => setLang((current) => (current === 'en' ? 'bn' : 'en')),
      t,
      tn: (number, options) => Number(number).toLocaleString(locale, options),
    }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export default LanguageProvider
