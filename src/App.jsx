import { useEffect, useMemo, useState } from 'react'
import { fetchSheetRows, normalizeCreator } from './sheet'
import { buildWhatsAppLink } from './whatsapp'
import { APPS_SCRIPT_URL, CONSENT_TEMPLATES, WHATSAPP_MESSAGES, WHATSAPP_REMINDER_MESSAGES, AGREEMENT_PDF_URL, AGREEMENT_PDF_NAME, SHEET_ID, SHEET_NAME, WILLINGNESS_SHEET_ID } from './config'
import './App.css'// TEMP_APP_CSS_IMPORT_MARKER
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

  const attachmentUrl = AGREEMENT_PDF_URL || (AGREEMENT_PDF_NAME ? `${window.location.origin}/${encodeURIComponent(AGREEMENT_PDF_NAME)}` : '')
  if (!attachmentUrl) return null

  const response = await fetch(attachmentUrl)
  if (!response.ok) return null

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

  if (!base64) return null

  return {
    name: AGREEMENT_PDF_NAME || 'agreement.pdf',
    contentType: blob.type || 'application/pdf',
    base64,
  }
}

async function sendConsentEmail(creator) {
  if (!APPS_SCRIPT_URL) {
    alert('Set APPS_SCRIPT_URL in src/config.js first (see README.md).')
    return false
  }
  const tpl = emailTemplateFor(creator.language)
  const body = tpl.body.replace(/{{name}}/g, creator.name || 'there')
  const payload = { to: creator.email, subject: tpl.subject, body }

  const agreementAttachment = await fetchAgreementAttachment()
  if (agreementAttachment) payload.attachments = [agreementAttachment]

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  return res.ok
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
            // detect status/email columns
            const headers = columns.map((h) => (h || '').toString().toLowerCase())
            const emailIdx = headers.findIndex((h) => /email/.test(h))
            const statusIdx = headers.findIndex((h) => /in|willing|status|reply|consent|agree/.test(h))

            // filter rows where status indicates in/agree/yes
            const filteredRows = rows.filter((r) => {
              const status = statusIdx >= 0 ? (r[columns[statusIdx]] || '').toString().toLowerCase() : ''
              const email = emailIdx >= 0 ? (r[columns[emailIdx]] || '').toString().toLowerCase().trim() : ''
              if (!email) return false
              return status.indexOf('in') !== -1 || status.indexOf("i'm in") !== -1 || status.indexOf('agree') !== -1 || status.indexOf('yes') !== -1
            })

            // Enrich with response info from main creators list (match by email)
            const respMap = {}
            creators.forEach((c) => {
              if (c.email) respMap[c.email.toString().toLowerCase().trim()] = c
            })

            const outColumns = ['name', 'email', 'whatsapp', 'language', 'status', 'sourceRow']
            const outRows = filteredRows.map((r, i) => {
              const email = emailIdx >= 0 ? (r[columns[emailIdx]] || '').toString().toLowerCase().trim() : ''
              const status = statusIdx >= 0 ? (r[columns[statusIdx]] || '') : ''
              const creator = respMap[email]
              return {
                _id: i,
                name: (creator && creator.name) || r[columns[headers.findIndex((h) => /name/.test(h))] || ''] || '',
                email: email || '',
                whatsapp: (creator && creator.whatsapp) || '',
                language: (creator && creator.language) || '',
                status: status || '',
                sourceRow: r._id + 1,
              }
            })

            setOnboarded({ columns: outColumns, rows: outRows })
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
    const ok = await sendConsentEmail(creator)
    if (ok) {
      setStage(creator.id, 'consent_sent')
      alert(`Consent email sent to ${creator.name || creator.email}`)
    } else {
      alert('Failed to send email — check APPS_SCRIPT_URL deployment.')
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
                {triggerEnabled ? 'Disable daily sync' : 'Enable daily sync'}
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
                    <th>Name</th>
                    <th>Language</th>
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
                        <td>
                          <div className="creator-name-wrap">
                            <div className="creator-name">{c.name || '—'}</div>
                            {onboarded && <span className="creator-chip creator-chip-onboarded">Onboarded</span>}
                          </div>
                        </td>
                        <td><span className="badge">{c.language || '—'}</span></td>
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

        {!loading && !error && view === 'onboarded' && (
          <section className="panel table-panel">
            <div className="table-header">
              <div>
                <h2>Onboarded Creators</h2>
                <p>Creators marked as onboarded / "I'M IN" across the system.</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="creator-table">
                <thead>
                  <tr>
                    {onboarded.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {onboarded.rows.map((r) => (
                    <tr key={r._id}>
                      {onboarded.columns.map((c) => (
                        <td key={c}>{r[c] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
