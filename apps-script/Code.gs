// Deploy this as a Google Apps Script Web App (free, uses your Gmail quota).
// 1. Go to script.google.com -> New project -> paste this code.
// 2. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
// 3. Copy the deployment URL into APPS_SCRIPT_URL in dashboard/src/config.js.

var DEFAULT_TARGET_SHEET_ID = '1dgOTTcLYMwwnDKXXgeIzUMI-gLgwU8OCWXGP_hyLVeY'
var DEFAULT_WILLINGNESS_SHEET_ID = '1mTrReLcWGxTbK8gp1BHIok-L6ElBsteZSR4M_R1adIw'

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var props = PropertiesService.getScriptProperties();
  // If the client requests to save a status, handle it here and return early.
  if (data.action === 'saveStatus') {
    try {
      var sheetId = data.sheetId
      var id = data.id
      var stage = data.stage

      if (!sheetId || typeof id === 'undefined' || typeof stage === 'undefined') {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing sheetId/id/stage' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var ss = SpreadsheetApp.openById(sheetId)
      var sheetName = 'DashboardStatus'
      var sheet = ss.getSheetByName(sheetName)
      if (!sheet) {
        sheet = ss.insertSheet(sheetName)
        sheet.appendRow(['id', 'stage', 'updatedAt'])
      }

      var values = sheet.getDataRange().getValues()
      var rowIndex = -1
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(id)) {
          rowIndex = i + 1
          break
        }
      }

      var now = new Date()
      if (rowIndex === -1) {
        sheet.appendRow([id, stage, now])
      } else {
        sheet.getRange(rowIndex, 2).setValue(stage)
        sheet.getRange(rowIndex, 3).setValue(now)
      }

      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (data.action === 'markWilling') {
    try {
      var willingnessSheetId = data.willingnessSheetId
      var name = data.name || ''
      var email = data.email || ''
      var stage = data.stage || ''

      if (!willingnessSheetId || !email) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing willingnessSheetId or email' }))
          .setMimeType(ContentService.MimeType.JSON)
      }

      var ss = SpreadsheetApp.openById(willingnessSheetId)
      var sheet = ss.getSheets()[0]
      var values = sheet.getDataRange().getValues()
      var headers = values[0].map(function (h) { return String(h).toLowerCase() })
      var emailIdx = headers.findIndex(function (h) { return /email/.test(h) })
      var nameIdx = headers.findIndex(function (h) { return /name/.test(h) })
      var statusIdx = headers.findIndex(function (h) { return /status|in|willing|consent|reply/.test(h) })

      // find existing row by email
      var foundRow = -1
      for (var i = 1; i < values.length; i++) {
        var cellEmail = ''
        if (emailIdx >= 0) cellEmail = String(values[i][emailIdx] || '').toLowerCase().trim()
        if (cellEmail && cellEmail === String(email).toLowerCase().trim()) {
          foundRow = i + 1
          break
        }
      }

      var now = new Date()
      if (foundRow === -1) {
        // append: ensure header columns exist
        var appendRow = []
        // build row with same number of columns as header
        for (var c = 0; c < headers.length; c++) appendRow.push('')
        if (nameIdx >= 0) appendRow[nameIdx] = name
        if (emailIdx >= 0) appendRow[emailIdx] = email
        if (statusIdx >= 0) appendRow[statusIdx] = stage
        // add timestamp column if exists or push
        appendRow.push(now)
        sheet.appendRow(appendRow)
      } else {
        if (statusIdx === -1) {
          // add a new 'Status' column at end
          var newCol = values[0].length + 1
          sheet.getRange(1, newCol).setValue('Status')
          statusIdx = newCol - 1
        }
        sheet.getRange(foundRow, statusIdx + 1).setValue(stage)
        // set timestamp next column
        sheet.getRange(foundRow, statusIdx + 2).setValue(now)
      }

      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
        .setMimeType(ContentService.MimeType.JSON)
    }
  }

  // Sync onboarded creators from a willingness spreadsheet into a 'Onboarded' tab
  if (data.action === 'syncOnboarded') {
    try {
      var willingnessSheetId = data.willingnessSheetId
      var targetSheetId = data.targetSheetId
      var responsesSheetName = data.responsesSheetName || 'Form Responses 1'

      if (!willingnessSheetId || !targetSheetId) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing willingnessSheetId or targetSheetId' }))
          .setMimeType(ContentService.MimeType.JSON)
      }

      var result = syncOnboarded(willingnessSheetId, targetSheetId, responsesSheetName)
      // record last synced
      props.setProperty('LAST_SYNCED', new Date().toISOString())
      props.setProperty('LAST_SYNCED_COUNT', String(result.synced || 0))
      return ContentService.createTextOutput(JSON.stringify({ ok: true, synced: result.synced }))
        .setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
        .setMimeType(ContentService.MimeType.JSON)
    }
  }

  if (data.action === 'getSyncStatus') {
    var last = props.getProperty('LAST_SYNCED') || null
    var count = props.getProperty('LAST_SYNCED_COUNT') || '0'
    return ContentService.createTextOutput(JSON.stringify({ ok: true, lastSynced: last, count: Number(count) }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  if (data.action === 'createTrigger') {
    try {
      var wId = data.willingnessSheetId
      var tId = data.targetSheetId
      if (!wId || !tId) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing ids' })).setMimeType(ContentService.MimeType.JSON)
      // save in script properties
      props.setProperty('WILLINGNESS_SHEET_ID', wId)
      props.setProperty('TARGET_SHEET_ID', tId)
      // check existing
      var triggers = ScriptApp.getProjectTriggers()
      var exists = triggers.some(function (tr) { return tr.getHandlerFunction() === 'scheduledSync' })
      if (!exists) {
        ScriptApp.newTrigger('scheduledSync').timeBased().everyDays(1).atHour(3).create()
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, created: !exists })).setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON)
    }
  }

  if (data.action === 'deleteTrigger') {
    try {
      var triggers = ScriptApp.getProjectTriggers()
      var removed = 0
      triggers.forEach(function (tr) {
        if (tr.getHandlerFunction() === 'scheduledSync') {
          ScriptApp.deleteTrigger(tr)
          removed++
        }
      })
      props.deleteProperty('WILLINGNESS_SHEET_ID')
      props.deleteProperty('TARGET_SHEET_ID')
      return ContentService.createTextOutput(JSON.stringify({ ok: true, removed: removed })).setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON)
    }
  }

  if (data.action === 'getTriggerStatus') {
    try {
      var triggers = ScriptApp.getProjectTriggers()
      var exists = triggers.some(function (tr) { return tr.getHandlerFunction() === 'scheduledSync' })
      return ContentService.createTextOutput(JSON.stringify({ ok: true, enabled: exists })).setMimeType(ContentService.MimeType.JSON)
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON)
    }
  }

  if (!data.to || !data.subject || !data.body) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing to/subject/body' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var options = {};

  // If attachments (array of public URLs) are provided, fetch and attach them.
  if (data.attachments && Array.isArray(data.attachments) && data.attachments.length) {
    try {
      var blobs = [];
      data.attachments.forEach(function (url) {
        try {
          if (typeof url === 'string') {
            var res = UrlFetchApp.fetch(url);
            blobs.push(res.getBlob());
          } else if (url && url.base64) {
            var bytes = Utilities.base64Decode(url.base64);
            var contentType = url.contentType || 'application/octet-stream';
            var name = url.name || 'attachment';
            blobs.push(Utilities.newBlob(bytes, contentType, name));
          }
        } catch (fetchErr) {
          // skip failing attachments
        }
      });
      if (blobs.length) options.attachments = blobs;
    } catch (e) {
      // ignore attachment errors and continue sending without attachments
    }
  }

  MailApp.sendEmail(data.to, data.subject, data.body, options);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this once manually in the Apps Script editor to grant spreadsheet access.
 * It will force the OAuth consent flow for SpreadsheetApp and UrlFetchApp.
 */
function setupPermissions() {
  var props = PropertiesService.getScriptProperties()
  var targetSheetId = props.getProperty('TARGET_SHEET_ID') || DEFAULT_TARGET_SHEET_ID
  var willingnessSheetId = props.getProperty('WILLINGNESS_SHEET_ID') || DEFAULT_WILLINGNESS_SHEET_ID

  if (targetSheetId) {
    SpreadsheetApp.openById(targetSheetId).getSheets()[0].getName()
  }

  if (willingnessSheetId) {
    SpreadsheetApp.openById(willingnessSheetId).getSheets()[0].getName()
  }

  // Also verify UrlFetch access because the web app uses it for PDF attachments.
  UrlFetchApp.fetch('https://www.google.com')

  return true
}

/**
 * Perform the onboarded sync logic and update responses sheet Stage column.
 * Returns { synced: number }
 */
function syncOnboarded(willingnessSheetId, targetSheetId, responsesSheetName) {
  var srcSS = SpreadsheetApp.openById(willingnessSheetId)
  var srcSheet = srcSS.getSheets()[0]
  var srcValues = srcSheet.getDataRange().getValues()
  if (srcValues.length < 2) return { synced: 0 }

  var headers = srcValues[0].map(function (h) { return String(h).toLowerCase().trim() })
  var emailIdx = headers.findIndex(function (h) { return /email/.test(h) })
  var statusIdx = headers.findIndex(function (h) { return /in|willing|status|reply|consent/.test(h) })
  var nameIdx = headers.findIndex(function (h) { return /name/.test(h) })

  var onboarded = []
  for (var i = 1; i < srcValues.length; i++) {
    var row = srcValues[i]
    var status = statusIdx >= 0 ? String(row[statusIdx] || '').toLowerCase() : ''
    if (status.indexOf('in') !== -1 || status.indexOf("i'm in") !== -1 || status.indexOf('agree') !== -1 || status.indexOf('yes') !== -1) {
      onboarded.push({ name: nameIdx >= 0 ? row[nameIdx] : '', email: emailIdx >= 0 ? row[emailIdx] : '', sourceRow: i + 1 })
    }
  }

  var targetSS = SpreadsheetApp.openById(targetSheetId)
  var respSheet = targetSS.getSheetByName(responsesSheetName)
  var respMap = {}
  var respVals = []
  if (respSheet) {
    respVals = respSheet.getDataRange().getValues()
    var respHeaders = respVals[0].map(function (h) { return String(h).toLowerCase() })
    var respEmailIdx = respHeaders.findIndex(function (h) { return /email/.test(h) })
    var respWhatsappIdx = respHeaders.findIndex(function (h) { return /whatsapp|phone|mobile|number/.test(h) })
    var respLangIdx = respHeaders.findIndex(function (h) { return /language/.test(h) })
    var respNameIdx = respHeaders.findIndex(function (h) { return /name/.test(h) })

    for (var ri = 1; ri < respVals.length; ri++) {
      var r = respVals[ri]
      var em = respEmailIdx >= 0 ? String(r[respEmailIdx] || '').toLowerCase().trim() : ''
      if (em) {
        respMap[em] = { rowIndex: ri + 1, name: respNameIdx >= 0 ? r[respNameIdx] : '', email: em, whatsapp: respWhatsappIdx >= 0 ? r[respWhatsappIdx] : '', language: respLangIdx >= 0 ? r[respLangIdx] : '' }
      }
    }
  }

  // Prepare Onboarded sheet
  var onboardedSheetName = 'Onboarded'
  var onboardedSheet = targetSS.getSheetByName(onboardedSheetName)
  if (!onboardedSheet) onboardedSheet = targetSS.insertSheet(onboardedSheetName)
  onboardedSheet.clear()
  var header = ['name', 'email', 'whatsapp', 'language', 'sourceRow', 'syncedAt']
  var out = [header]
  var now = new Date()
  onboarded.forEach(function (o) {
    var em = (o.email || '').toString().toLowerCase().trim()
    var enriched = respMap[em]
    out.push([enriched ? enriched.name : o.name || '', enriched ? enriched.email : o.email || '', enriched ? enriched.whatsapp : '', enriched ? enriched.language : '', o.sourceRow, now])
  })
  if (out.length > 1) {
    onboardedSheet.getRange(1, 1, out.length, out[0].length).setValues(out)
  }

  // Update responses sheet Stage column for matched emails
  if (respSheet && respVals.length) {
    var stageCol = ensureStageColumn(respSheet)
    var respHeaders = respVals[0].map(function (h) { return String(h).toLowerCase() })
    var respEmailIdx = respHeaders.findIndex(function (h) { return /email/.test(h) })
    if (respEmailIdx >= 0) {
      var updates = []
      onboarded.forEach(function (o) {
        var em = (o.email || '').toString().toLowerCase().trim()
        var match = respMap[em]
        if (match) {
          // set Stage to 'agreed' or 'onboarded'
          updates.push({ row: match.rowIndex, col: stageCol, value: 'onboarded' })
        }
      })
      // apply updates in batch
      updates.forEach(function (u) { respSheet.getRange(u.row, u.col).setValue(u.value) })
    }
  }

  return { synced: onboarded.length }
}

function ensureStageColumn(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  var idx = -1
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase()
    if (h.indexOf('stage') !== -1 || h.indexOf('status') !== -1 || h.indexOf('onboard') !== -1) {
      idx = i + 1
      break
    }
  }
  if (idx === -1) {
    idx = headers.length + 1
    sheet.getRange(1, idx).setValue('Stage')
  }
  return idx
}

/**
 * Triggered by time-based trigger. Reads stored properties for ids and runs sync.
 */
function scheduledSync() {
  var props = PropertiesService.getScriptProperties()
  var wId = props.getProperty('WILLINGNESS_SHEET_ID')
  var tId = props.getProperty('TARGET_SHEET_ID')
  var respName = props.getProperty('RESPONSES_SHEET_NAME') || 'Form Responses 1'
  if (!wId || !tId) return
  var result = syncOnboarded(wId, tId, respName)
  props.setProperty('LAST_SYNCED', new Date().toISOString())
  props.setProperty('LAST_SYNCED_COUNT', String(result.synced || 0))
}
