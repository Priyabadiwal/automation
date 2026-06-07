import { useEffect, useMemo, useState } from 'react'
import { fetchSheetRows, normalizeCreator } from './sheet'
import { buildWhatsAppLink } from './whatsapp'
import { CONSENT_TEMPLATES, APPS_SCRIPT_URL } from './config'
import './App.css'

const STATUS_KEY = 'creator-dashboard-status'

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

function emailTemplateFor(language) {
  return CONSENT_TEMPLATES[language] || CONSENT_TEMPLATES.Default
}

async function sendConsentEmail(creator) {
  if (!APPS_SCRIPT_URL) {
    alert('Set APPS_SCRIPT_URL in src/config.js first (see README.md).')
    return false
  }
  const tpl = emailTemplateFor(creator.language)
  const body = tpl.body.replace(/{{name}}/g, creator.name || 'there')
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ to: creator.email, subject: tpl.subject, body }),
  })
  return res.ok
}

export default function App() {
  const [creators, setCreators] = useState([])
  const [status, setStatus] = useState(loadStatusMap)
  const [languageFilter, setLanguageFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSheetRows()
      .then(({ rows }) => setCreators(rows.map(normalizeCreator)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => saveStatusMap(status), [status])

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

  function setStage(id, stage) {
    setStatus((prev) => ({ ...prev, [id]: stage }))
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

  return (
    <div className="app">
      <header className="header">
        <h1>Buddy Tezz AI — Creator Outreach Dashboard</h1>
        <p className="subtitle">Live view of your response sheet, sorted by language, with one-click WhatsApp & consent-email actions.</p>
      </header>

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
        <span className="count">{filtered.length} creator{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="info">Loading sheet…</p>}
      {error && (
        <p className="error">
          {error} — make sure the sheet's sharing is set to "Anyone with the link can view", and SHEET_NAME in src/config.js matches your tab name.
        </p>
      )}

      {!loading && !error && (
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
            {filtered.map((c) => {
              const waLink = buildWhatsAppLink(c.whatsapp)
              const stage = status[c.id] || 'new'
              return (
                <tr key={c.id}>
                  <td>{c.name || '—'}</td>
                  <td><span className="badge">{c.language || '—'}</span></td>
                  <td>{c.instagram || '—'}</td>
                  <td>{c.followers || '—'}</td>
                  <td>{c.whatsapp || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    <select value={stage} onChange={(e) => setStage(c.id, e.target.value)}>
                      <option value="new">New</option>
                      <option value="whatsapp_sent">WhatsApp sent</option>
                      <option value="agreed">Agreed (I'M IN)</option>
                      <option value="consent_sent">Consent sent</option>
                    </select>
                  </td>
                  <td className="actions">
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
                    <button
                      className="btn btn-email"
                      disabled={!c.email}
                      onClick={() => handleSendEmail(c)}
                    >
                      Send consent
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
