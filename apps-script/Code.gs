// Deploy this as a Google Apps Script Web App (free, uses your Gmail quota).
// 1. Go to script.google.com -> New project -> paste this code.
// 2. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
// 3. Copy the deployment URL into APPS_SCRIPT_URL in dashboard/src/config.js.

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (!data.to || !data.subject || !data.body) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing to/subject/body' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  GmailApp.sendEmail(data.to, data.subject, data.body);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
