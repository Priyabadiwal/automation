import { SHEET_ID, SHEET_NAME } from './config'

// Reads a publicly-viewable Google Sheet via the gviz JSON endpoint.
// No API key needed — just set sharing to "Anyone with the link can view".
export async function fetchSheetRows() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load sheet (${res.status}). Is it shared as "Anyone with the link can view"?`)

  const text = await res.text()
  // Response is wrapped like: google.visualization.Query.setResponse({...});
  const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1))

  const cols = json.table.cols.map((c) => (c.label || c.id || '').trim())
  const rows = json.table.rows.map((r, i) => {
    const row = { _id: i }
    r.c.forEach((cell, idx) => {
      row[cols[idx] || `col${idx}`] = cell?.f ?? cell?.v ?? ''
    })
    return row
  })
  return { columns: cols, rows }
}

// Best-effort guesses for which column holds which field, since real-world
// Google Form headers vary (e.g. "Your Name", "WhatsApp Number", "Language you create in").
export function pickField(row, candidates) {
  const keys = Object.keys(row)
  for (const candidate of candidates) {
    const match = keys.find((k) => k.toLowerCase().includes(candidate.toLowerCase()))
    if (match && row[match]) return row[match]
  }
  return ''
}

export function normalizeCreator(row) {
  return {
    id: row._id,
    name: pickField(row, ['name']),
    language: pickField(row, ['language']),
    whatsapp: pickField(row, ['whatsapp', 'phone', 'mobile', 'number']),
    email: pickField(row, ['email']),
    followers: pickField(row, ['follower']),
    instagram: pickField(row, ['instagram', 'handle', 'profile']),
    raw: row,
  }
}
