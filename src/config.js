// ---- Fill these in (see README.md for setup steps) ----

// Your Google Sheet ID (from the sheet URL between /d/ and /edit)
export const SHEET_ID = '1dgOTTcLYMwwnDKXXgeIzUMI-gLgwU8OCWXGP_hyLVeY'

// Name of the tab/sheet that holds form responses
export const SHEET_NAME = 'UGC Creator Onboarding Form | Buddy Tezz  (Responses)'

// Apps Script Web App URL that sends consent emails (see apps-script/Code.gs)
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx9Xqlgx2JRSSey5VfHmTWmq0-5BcJlrSIvNNeEiIBLEZgHny-A2KCluUUcyaDIQqN8/exec'

// Pitch message sent to creators on WhatsApp (used to build click-to-chat links)
export const WHATSAPP_PITCH = `Hi! This is Buddy Tezz AI 👋

Following up on the UGC creator program — short video creation from scripts, ₹1000/video, demo within 24 hrs.

Could you share a bit more about yourself so we can move forward?`

// Map each language to the consent email subject + body template.
// {{name}} is replaced with the creator's name.
export const CONSENT_TEMPLATES = {
  Tamil: {
    subject: 'Buddy Tezz AI – Creator Onboarding Consent',
    body: `Hi {{name}},

Welcome aboard! Please confirm your consent to proceed with the Buddy Tezz AI UGC creator program (Tamil content).

By replying "I AGREE" to this email, you confirm you accept the project guidelines and payment terms (₹1000/video, demo within 24 hrs).

Looking forward to working with you!

Buddy Tezz AI Team`,
  },
  Kannada: {
    subject: 'Buddy Tezz AI – Creator Onboarding Consent',
    body: `Hi {{name}},

Welcome aboard! Please confirm your consent to proceed with the Buddy Tezz AI UGC creator program (Kannada content).

By replying "I AGREE" to this email, you confirm you accept the project guidelines and payment terms (₹1000/video, demo within 24 hrs).

Looking forward to working with you!

Buddy Tezz AI Team`,
  },
  Default: {
    subject: 'Buddy Tezz AI – Creator Onboarding Consent',
    body: `Hi {{name}},

Welcome aboard! Please confirm your consent to proceed with the Buddy Tezz AI UGC creator program.

By replying "I AGREE" to this email, you confirm you accept the project guidelines and payment terms (₹1000/video, demo within 24 hrs).

Looking forward to working with you!

Buddy Tezz AI Team`,
  },
}
