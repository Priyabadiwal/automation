import { useEffect, useMemo, useState } from 'react'
import { fetchSheetRows, normalizeCreator } from './sheet'
import { buildWhatsAppLink } from './whatsapp'
import { APPS_SCRIPT_URL, CONSENT_TEMPLATES, WHATSAPP_MESSAGES, WHATSAPP_REMINDER_MESSAGES, AGREEMENT_PDF_URL, AGREEMENT_PDF_NAME, SHEET_ID, SHEET_NAME, WILLINGNESS_SHEET_ID } from './config'
import './App.css'
const STATUS_KEY = 'creator-dashboard-status'
const WHATSAPP_TEMPLATE_KEY = 'creator-dashboard-whatsapp-template'

function loadStatusMap() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY)) || {}
  } catch {
    return {}
  }
}

function saveStatusMap(map) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(map))
}

function loadWhatsAppTemplateMap() {
  try {
    return JSON.parse(localStorage.getItem(WHATSAPP_TEMPLATE_KEY)) || {}
  } catch {
    return {}
  }
}

function saveWhatsAppTemplateMap(map) {
  localStorage.setItem(WHATSAPP_TEMPLATE_KEY, JSON.stringify(map))
}

function emailTemplateFor(language) {
  return CONSENT_TEMPLATES[language] || CONSENT_TEMPLATES.Default
}

function defaultWhatsAppTemplateFor(language) {
  return /vernac/i.test(language || '') ? 'Vernac' : 'Hindi'
}

function selectedWhatsAppTemplateFor(creator, overrides) {
  return overrides[creator.id] || defaultWhatsAppTemplateFor(creator.language)
}

async function fetchAgreementAttachment() {
  if (typeof window === 'undefined') return null

  const normalizePath = (path) => {
    if (!path) return ''
    let normalized = path.trim()
    if (normalized.startsWith('public/')) {
      normalized = normalized.replace(/^public\//, '')
    }
    if (!normalized.startsWith('/') && !/^https?:\/\//i.test(normalized)) {
      normalized = `/${normalized}`
    }
    return normalized
  }

  const tryResolveUrl = (path) => {
    if (!path) return null
    if (/^https?:\/\//i.test(path)) {
      return path
    }
    try {
      return new URL(path, window.location.origin).href
    } catch {
      return null
    }
  }

  const possiblePaths = []
  if (AGREEMENT_PDF_URL) possiblePaths.push(normalizePath(AGREEMENT_PDF_URL))
  if (AGREEMENT_PDF_NAME) possiblePaths.push(normalizePath(AGREEMENT_PDF_NAME))

  for (const path of possiblePaths) {
    const attachmentUrl = tryResolveUrl(path)
    if (!attachmentUrl) continue

    try {
      const response = await fetch(encodeURI(attachmentUrl))
      if (!response.ok) {
        console.warn('Attachment fetch failed', response.status, attachmentUrl)
        continue
      }

      const blob = await response.blob()
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || '')
          resolve(result.split(',')[1] || '')
        }
        reader.onerror = () => reject(new Error('Failed to read agreement PDF'))
        reader.readAsDataURL(blob)
      })

      if (!base64) continue

      return {
        name: AGREEMENT_PDF_NAME || 'agreement.pdf',
        contentType: blob.type || 'application/pdf',
        base64,
      }
    } catch (err) {
      console.warn('Failed to fetch agreement attachment:', err, attachmentUrl)
    }
  }

  return null
}

async function sendConsentEmail(creator) {
  if (!APPS_SCRIPT_URL) {
    return { ok: false, error: 'Set APPS_SCRIPT_URL in src/config.js first (see README.md).' }
  }
  if (!creator?.email) {
    return { ok: false, error: 'No email address available for this creator.' }
  }

  try {
    const tpl = emailTemplateFor(creator.language)
    const body = tpl.body.replace(/{{name}}/g, creator.name || 'there')
    const payload = { to: creator.email, subject: tpl.subject, body }

    const agreementAttachment = await fetchAgreementAttachment()
    if (agreementAttachment) payload.attachments = [agreementAttachment]

    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      // ignore parse errors
    }

    if (!res.ok || (json && json.ok === false)) {
      const fallback = await trySendEmailWithGet(creator, tpl, body, json)
      if (fallback) return fallback
      return { ok: false, error: json?.error || `HTTP ${res.status}: ${text}` }
    }

    return { ok: true }
  } catch (err) {
    console.error('Failed to send consent email:', err)
    const fallback = await trySendEmailWithGet(creator, tpl, body)
    if (fallback) return fallback
    return { ok: false, error: err.message }
  }
}

async function trySendEmailWithGet(creator, tpl, body, previousJson) {
  const fallbackError = previousJson?.error || ''
  if (!creator?.email || !tpl?.subject || !body) return null

  if (fallbackError && fallbackError.toLowerCase().includes('missing to/subject/body')) {
    const params = new URLSearchParams({
      action: 'sendEmail',
      to: creator.email,
      subject: tpl.subject,
      body,
    })
    const fallbackUrl = `${APPS_SCRIPT_URL}?${params.toString()}`
    try {
      const response = await fetch(fallbackUrl, { method: 'GET', redirect: 'follow' })
      const text = await response.text()
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        return null
      }
      if (response.ok && json.ok !== false) {
        return { ok: true }
      }
      return { ok: false, error: json?.error || text || 'Fallback GET failed' }
    } catch (err) {
      console.warn('GET fallback for send email failed:', err)
      return null
    }
  }

  return null
}

export default function App() {
  // eslint-disable-next-line no-unused-vars
  const normalizeDashboardPhone = (value) =>
    (value || '')
      .toString()
      .replace(/\D/g, '')
      .replace(/^91/, '')
      .replace(/^0+/, '');

  // eslint-disable-next-line no-unused-vars
  const normalizeDashboardText = (value) =>
    (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

// COMPONENT_MARKER
  const [creators, setCreators] = useState([])
  const [status, setStatus] = useState(loadStatusMap)
  const [whatsappTemplates, setWhatsappTemplates] = useState(loadWhatsAppTemplateMap)
  const [languageFilter, setLanguageFilter] = useState('All')
  const [onboardedFilter, setOnboardedFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastSynced, setLastSynced] = useState(null)
  const [triggerEnabled, setTriggerEnabled] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [view, setView] = useState('creators')
  const [onboarded, setOnboarded] = useState({ columns: [], rows: [] })
  const [onboardedEmails, setOnboardedEmails] = useState(new Set())
  const [onboardedLanguageFilter, setOnboardedLanguageFilter] = useState(new Set())

  function normalizeEmail(value) {
    return String(value || '').toLowerCase().trim()
  }

  async function refreshOnboardedIndex() {
    try {
      const { rows } = await fetchSheetRows('Onboarded')
      const emailSet = new Set()
      rows.forEach((row) => {
        const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email'))
        if (!emailKey) return
        const email = normalizeEmail(row[emailKey])
        if (email) emailSet.add(email)
      })
      setOnboardedEmails(emailSet)
    } catch {
      // If Onboarded tab is missing or inaccessible, keep it empty.
      setOnboardedEmails(new Set())
    }
  }

  useEffect(() => {
    fetchSheetRows()
      .then(({ rows }) => setCreators(rows.map(normalizeCreator)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshOnboardedIndex()
  }, [])

  useEffect(() => {
    if (!APPS_SCRIPT_URL) return
    // fetch last sync status
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getSyncStatus' }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.lastSynced) setLastSynced(j.lastSynced)
      })
      .catch(() => {})

    // fetch trigger status
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getTriggerStatus' }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setTriggerEnabled(!!j.enabled)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // When switching to onboarded view, fetch Onboarded tab
    if (view === 'onboarded') {
      // schedule setting loading asynchronously to avoid synchronous setState in effect
      Promise.resolve().then(() => setLoading(true))
      // fetch the willingness sheet (only show people who submitted willingness and said they're in)
      import('./sheet').then(({ fetchExternalSheetRows }) => {
        fetchExternalSheetRows(WILLINGNESS_SHEET_ID)
          .then(({ columns, rows }) => {
            // detect status/email columns with broader matching
            const headers = columns.map((h) => (h || '').toString().toLowerCase())
            const emailIdx = headers.findIndex((h) => /email/.test(h))
            const statusIdx = headers.findIndex((h) => /status|in|willing|reply|consent|agree|response/.test(h))

            // filter rows where status indicates in/agree/yes - more flexible matching
            const filteredRows = rows.filter((r) => {
              const status = statusIdx >= 0 ? (r[columns[statusIdx]] || '').toString().toLowerCase().trim() : ''
              const email = emailIdx >= 0 ? (r[columns[emailIdx]] || '').toString().toLowerCase().trim() : ''
              if (!email) return false
              // Match yes, in, agree, or any variation
              return /yes|in|agree|i'm in/.test(status)
            })

            // Enrich with response info from main creators list (match by email)
            const respMap = {}
            creators.forEach((c) => {
              if (c.email) respMap[c.email.toString().toLowerCase().trim()] = c
            })

            // Deduplicate by normalized email
            const seenOnboardedEmails = new Set()
            const uniqueRows = []
            filteredRows.forEach((r) => {
              const email = emailIdx >= 0 ? (r[columns[emailIdx]] || '').toString().toLowerCase().trim() : ''
              if (!email || seenOnboardedEmails.has(email)) return
              seenOnboardedEmails.add(email)
              uniqueRows.push(r)
            })

            const outColumns = ['sourceRow', 'name', 'email', 'whatsapp', 'language', 'status']
            const outRows = uniqueRows.map((r, i) => {
              const email = emailIdx >= 0 ? (r[columns[emailIdx]] || '').toString().toLowerCase().trim() : ''
              const status = statusIdx >= 0 ? (r[columns[statusIdx]] || '') : ''
              const creator = respMap[email]
              return {
                _id: i,
                sourceRow: r._id + 1,
                name: (creator && creator.name) || r[columns[headers.findIndex((h) => /name/.test(h))] || ''] || '',
                email: email || '',
                whatsapp: (creator && creator.whatsapp) || '',
                language: (creator && creator.language) || '',
                status: status || '',
              }
            })

            setOnboarded({ columns: outColumns, rows: outRows })
            // Reset language filter when onboarded data updates
            setOnboardedLanguageFilter(new Set())
          })
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false))
      })
    }
  }, [creators, view])

  useEffect(() => saveStatusMap(status), [status])
  useEffect(() => saveWhatsAppTemplateMap(whatsappTemplates), [whatsappTemplates])

  const languages = useMemo(() => {
    const set = new Set(creators.map((c) => c.language).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [creators])

  const filtered = useMemo(() => {
    return creators.filter((c) => {
      if (languageFilter !== 'All' && c.language !== languageFilter) return false
      if (search && !`${c.name} ${c.instagram} ${c.email}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [creators, languageFilter, search])

  const visibleCreators = useMemo(() => {
    return filtered.filter((creator) => {
      if (onboardedFilter === 'onboarded') {
        return isOnboardedCreator(creator, status[creator.id])
      }
      return true
    })
  }, [filtered, onboardedFilter, status, onboardedEmails])

  function isOnboardedStatus(stage) {
    const normalized = String(stage || '').toLowerCase()
    return normalized === 'onboarded' || normalized === 'agreed' || normalized === 'onboard'
  }

  function isOnboardedCreator(creator, stage) {
    if (isOnboardedStatus(stage)) return true
    const email = normalizeEmail(creator?.email)
    return email ? onboardedEmails.has(email) : false
  }

  const summary = useMemo(() => {
    return visibleCreators.reduce(
      (acc, creator) => {
        acc.whatsappReady += creator.whatsapp ? 1 : 0
        acc.emailReady += creator.email ? 1 : 0
        acc.languages.add(creator.language || 'Unspecified')
        const stage = String(status[creator.id] || 'new').toLowerCase()
        if (acc.stages[stage] !== undefined) {
          acc.stages[stage] += 1
        }
        if (isOnboardedCreator(creator, stage)) {
          acc.stages.onboarded += 1
        }
        return acc
      },
      {
        whatsappReady: 0,
        emailReady: 0,
        languages: new Set(),
        stages: {
          new: 0,
          whatsapp_sent: 0,
          agreed: 0,
          consent_sent: 0,
          onboarded: 0,
        },
      },
    )
  }, [onboardedEmails, status, visibleCreators])

  function setStage(id, stage) {
    setStatus((prev) => ({ ...prev, [id]: stage }))
    // Optimistically persist stage to server so it's consistent across devices.
    persistStage(id, stage).catch((err) => console.error('Failed to persist stage', err))
    // If the user indicates they're "in" (agreed/onboarded), also update the willingness spreadsheet
    if (stage === 'agreed' || stage === 'onboarded' || stage === 'onboard') {
      const creator = creators.find((c) => c.id === id)
      if (creator) {
        markWillingOnServer(creator, stage).catch((err) => console.error('Failed to mark willingness', err))
      }
    }
  }

  async function persistStage(id, stage) {
    if (!APPS_SCRIPT_URL || !SHEET_ID) return
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveStatus', sheetId: SHEET_ID, id, stage }),
    })
  }

  async function markWillingOnServer(creator, stage) {
    if (!APPS_SCRIPT_URL || !WILLINGNESS_SHEET_ID) return
    const payload = {
      action: 'markWilling',
      willingnessSheetId: WILLINGNESS_SHEET_ID,
      name: creator.name || '',
      email: creator.email || '',
      stage: stage,
    }
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
  }

  function setWhatsAppTemplate(id, template) {
    setWhatsappTemplates((prev) => {
      const next = { ...prev }
      const creator = creators.find((item) => item.id === id)
      const defaultTemplate = defaultWhatsAppTemplateFor(creator?.language)

      if (template === defaultTemplate) {
        delete next[id]
      } else {
        next[id] = template
      }

      return next
    })
  }

  async function handleSendEmail(creator) {
    const result = await sendConsentEmail(creator)
    if (result.ok) {
      setStage(creator.id, 'consent_sent')
      alert(`Consent email sent to ${creator.name || creator.email}`)
    } else {
      const message = result.error || 'Failed to send email — check APPS_SCRIPT_URL deployment.'
      alert(message)
    }
  }

  function handleSendReminder(creator) {
    const reminderTemplate = /vernac/i.test(creator.language || '')
      ? WHATSAPP_REMINDER_MESSAGES.Vernac
      : WHATSAPP_REMINDER_MESSAGES.Hindi
    const waLink = buildWhatsAppLink(creator.whatsapp, reminderTemplate)
    if (!waLink) {
      alert('No WhatsApp number available for this creator.')
      return
    }
    window.open(waLink, '_blank', 'noopener,noreferrer')
    setStage(creator.id, 'reminder_sent')
  }

  return (
    <div className="app-shell">
      <main className="app">
        <header className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Buddy Tezz AI</p>
            <h1>Creator Outreach Dashboard</h1>
            <p className="subtitle">
              A clean working view for tracking creators, sending the right WhatsApp pitch, and moving consent forward.
            </p>
          </div>
          <div className="hero-meta">
            <div className="hero-meta-item">
              <span className="hero-meta-label">Visible creators</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-label">Languages</span>
              <strong>{summary.languages.size}</strong>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-label">Last sync</span>
              <strong>{lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}</strong>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-label">View</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setView('creators')}>Creators</button>
                <button className="btn" onClick={() => setView('onboarded')}>Onboarded</button>
              </div>
            </div>
          </div>
        </header>

        <section className="metrics-grid" aria-label="Dashboard summary">
          <article className="metric-card">
            <span className="metric-label">Creators in view</span>
            <strong>{visibleCreators.length}</strong>
            <span className="metric-footnote">After search and language filter</span>
          </article>
          <article className="metric-card">
            <span className="metric-label">WhatsApp-ready</span>
            <strong>{summary.whatsappReady}</strong>
            <span className="metric-footnote">Rows with a number available</span>
          </article>
          <article className="metric-card">
            <span className="metric-label">Email-ready</span>
            <strong>{summary.emailReady}</strong>
            <span className="metric-footnote">Rows with email available</span>
          </article>
          <article className="metric-card">
            <span className="metric-label">Stage complete</span>
            <strong>{summary.stages.consent_sent}</strong>
            <span className="metric-footnote">Creators already sent consent</span>
          </article>
        </section>

        <section className="panel toolbar-panel">
          <div className="toolbar-header">
            <div>
              <h2>Work queue</h2>
              <p>Search, filter, and move through creators in a single view.</p>
            </div>
            <span className="count">{visibleCreators.length} creator{visibleCreators.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="toolbar">
            <input
              type="text"
              placeholder="Search by name, Instagram, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select value={onboardedFilter} onChange={(e) => setOnboardedFilter(e.target.value)}>
              <option value="all">All creators</option>
              <option value="onboarded">Onboarded only</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn sync-btn"
                disabled={syncing}
                onClick={async () => {
                  if (!confirm('Sync onboarded creators from willingness sheet into the primary spreadsheet?')) return
                  setSyncing(true)
                  try {
                    const res = await fetch(APPS_SCRIPT_URL, {
                      method: 'POST',
                      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                      body: JSON.stringify({ action: 'syncOnboarded', willingnessSheetId: WILLINGNESS_SHEET_ID, targetSheetId: SHEET_ID, responsesSheetName: SHEET_NAME }),
                    })
                    const json = await res.json()
                    if (res.ok && json.ok) {
                      alert(`Synced ${json.synced} onboarded creators.`)
                      setLastSynced(new Date().toISOString())
                      refreshOnboardedIndex()
                    } else {
                      alert('Sync failed: ' + (json.error || JSON.stringify(json)))
                    }
                  } catch (e) {
                    alert('Sync failed: ' + e.message)
                  } finally {
                    setSyncing(false)
                  }
                }}
              >
                {syncing ? 'Syncing…' : 'Sync Onboarded'}
              </button>

              <button
                className="btn"
                onClick={async () => {
                  try {
                    if (!triggerEnabled) {
                      const res = await fetch(APPS_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({ action: 'createTrigger', willingnessSheetId: WILLINGNESS_SHEET_ID, targetSheetId: SHEET_ID }),
                      })
                      const j = await res.json()
                      if (j.ok) {
                        setTriggerEnabled(true)
                        alert('Daily sync enabled')
                      } else alert('Failed to enable: ' + (j.error || JSON.stringify(j)))
                    } else {
                      const res = await fetch(APPS_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({ action: 'deleteTrigger' }),
                      })
                      const j = await res.json()
                      if (j.ok) {
                        setTriggerEnabled(false)
                        alert('Daily sync disabled')
                      } else alert('Failed to disable: ' + (j.error || JSON.stringify(j)))
                    }
                  } catch (e) {
                    alert('Trigger action failed: ' + e.message)
                  }
                }}
              >
                {/* {triggerEnabled ? 'Disable daily sync' : 'Enable daily sync'} */}
              </button>
            </div>
          </div>
        </section>

      {loading && <p className="info">Loading sheet…</p>}
      {error && (
        <p className="error">
          {error} — make sure the sheet's sharing is set to "Anyone with the link can view", and SHEET_NAME in src/config.js matches your tab name.
        </p>
      )}

        {!loading && !error && view === 'creators' && (
          <section className="panel table-panel">
            <div className="table-header">
              <div>
                <h2>Creators</h2>
                <p>Use the message selector to choose Hindi or Vernac before sending WhatsApp.</p>
              </div>
              <div className="status-legend" aria-label="Stage summary">
                <span className="legend-item"><i className="legend-dot legend-new" /> New {summary.stages.new}</span>
                <span className="legend-item"><i className="legend-dot legend-wa" /> WhatsApp {summary.stages.whatsapp_sent}</span>
                <span className="legend-item"><i className="legend-dot legend-agreed" /> Agreed {summary.stages.agreed}</span>
                <span className="legend-item"><i className="legend-dot legend-consent" /> Consent {summary.stages.consent_sent}</span>
                <span className="legend-item"><i className="legend-dot legend-onboarded" /> Onboarded {summary.stages.onboarded || 0}</span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="creator-table">
                <thead>
                  <tr>
                    <th className="sticky-name">Name</th>
                    <th className="sticky-language">Language</th>
                    <th>Instagram</th>
                    <th>Followers</th>
                    <th>WhatsApp</th>
                    <th>Email</th>
                    <th>Stage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCreators.map((c) => {
                    const waTemplate = selectedWhatsAppTemplateFor(c, whatsappTemplates)
                    const waLink = buildWhatsAppLink(c.whatsapp, WHATSAPP_MESSAGES[waTemplate] || WHATSAPP_MESSAGES.Hindi)
                    const stage = status[c.id] || 'new'
                    const onboarded = isOnboardedCreator(c, stage)
                    return (
                      <tr key={c.id} className={onboarded ? 'onboarded-row' : ''}>
                        <td className="sticky-name">
                          <div className="creator-name-wrap">
                            <div className="creator-name">{c.name || '—'}</div>
                            {onboarded && <span className="creator-chip creator-chip-onboarded">Onboarded</span>}
                          </div>
                        </td>
                        <td className="sticky-language"><span className="badge">{c.language || '—'}</span></td>
                        <td>{c.instagram || '—'}</td>
                        <td>{c.followers || '—'}</td>
                        <td>{c.whatsapp || '—'}</td>
                        <td>{c.email || '—'}</td>
                        <td>
                          <select className={`stage-select stage-${stage}`} value={stage} onChange={(e) => setStage(c.id, e.target.value)}>
                            <option value="new">New</option>
                            <option value="whatsapp_sent">WhatsApp sent</option>
                            <option value="agreed">Agreed (I'M IN)</option>
                            <option value="consent_sent">Consent sent</option>
                            <option value="reminder_sent">Reminder sent</option>
                            <option value="onboarded">Onboarded</option>
                          </select>
                        </td>
                        <td className="actions">
                          <div className="whatsapp-controls">
                            <select
                              className="whatsapp-template-select"
                              value={waTemplate}
                              onChange={(e) => setWhatsAppTemplate(c.id, e.target.value)}
                              aria-label={`Choose WhatsApp message for ${c.name || c.email || 'creator'}`}
                            >
                              <option value="Hindi">Hindi</option>
                              <option value="Vernac">Vernac</option>
                            </select>
                            {waLink ? (
                              <a
                                className="btn btn-whatsapp"
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setStage(c.id, stage === 'new' ? 'whatsapp_sent' : stage)}
                              >
                                WhatsApp
                              </a>
                            ) : (
                              <span className="btn btn-disabled">No number</span>
                            )}
                            {(stage === 'consent_sent' || stage === 'reminder_sent') && (
                              <button
                                className="btn btn-reminder"
                                onClick={() => handleSendReminder(c)}
                              >
                                Send reminder
                              </button>
                            )}
                          </div>
                          <button className="btn btn-email" disabled={!c.email} onClick={() => handleSendEmail(c)}>
                            Send consent
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && !error && view === 'onboarded' && (() => {
          // Extract unique individual languages, normalizing and cleaning punctuation
          const langMap = new Map() // normalized -> original
          onboarded.rows.forEach((r) => {
            const langString = (r.language || '').trim()
            if (langString) {
              // Split by space/comma and clean up each language
              const langs = langString.split(/[\s,]+/).filter(Boolean)
              langs.forEach((lang) => {
                const cleaned = lang.trim()
                if (cleaned) {
                  const normalized = cleaned.toLowerCase()
                  // Keep first occurrence of each language (case-insensitive)
                  if (!langMap.has(normalized)) {
                    langMap.set(normalized, cleaned)
                  }
                }
              })
            }
          })
          const uniqueLanguages = Array.from(langMap.values()).sort()

          // Filter rows: if no filter selected, show all. Otherwise show rows where language contains ANY selected language
          const filteredOnboardedRows = onboarded.rows.filter((r) => {
            if (onboardedLanguageFilter.size === 0) return true
            const langString = (r.language || '').trim()
            if (!langString) return false
            const langs = langString.split(/[\s,]+/).filter(Boolean)
            // Check if any of the row's languages match any selected filter (case-insensitive)
            return langs.some((lang) => onboardedLanguageFilter.has(lang.trim().toLowerCase()))
          })

          return (
            <section className="panel table-panel">
              <div className="table-header">
                <div>
                  <h2>Onboarded Creators</h2>
                  <p>Creators marked as onboarded / "I'M IN" across the system.</p>
                </div>
              </div>

              <div className="toolbar-panel" style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '12px', fontWeight: '600', color: '#0f172a' }}>Filter by Language:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {uniqueLanguages.map((lang) => (
                    <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={onboardedLanguageFilter.has(lang.toLowerCase())}
                        onChange={(e) => {
                          const newFilter = new Set(onboardedLanguageFilter)
                          const normalized = lang.toLowerCase()
                          if (e.target.checked) {
                            newFilter.add(normalized)
                          } else {
                            newFilter.delete(normalized)
                          }
                          setOnboardedLanguageFilter(newFilter)
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table className="creator-table">
                  <thead>
                    <tr>
                      {onboarded.columns.map((c) => (
                        <th
                          key={c}
                          className={c === 'name' ? 'sticky-name' : c === 'language' ? 'sticky-language' : undefined}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOnboardedRows.map((r) => (
                      <tr key={r._id}>
                        {onboarded.columns.map((c) => (
                          <td
                            key={c}
                            className={c === 'name' ? 'sticky-name' : c === 'language' ? 'sticky-language' : undefined}
                          >
                            {r[c] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })()}
      </main>
    </div>
  )
}
