// ---- Fill these in (see README.md for setup steps) ----

// Your Google Sheet ID (from the sheet URL between /d/ and /edit)
export const SHEET_ID = '1dgOTTcLYMwwnDKXXgeIzUMI-gLgwU8OCWXGP_hyLVeY'

// Name of the tab/sheet that holds form responses
export const SHEET_NAME = 'UGC Creator Onboarding Form | Buddy Tezz  (Responses)'

// Apps Script Web App URL that sends consent emails (see apps-script/Code.gs)
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyblTcfI5aOO_cE354cHZlydXmlniS0B_s13PfI_ZSW1M2zAlwvZJLjqZ15RkQWLOEa/exec'

// Public URL to the agreement PDF to attach to consent emails.
// Host this file where it's publicly accessible (e.g. your web host or a public Drive link).
// If you place the agreement PDF in the `public/` folder, set its filename here.
// At runtime the app will build a public URL like `https://your-site/<filename>` and send
// that URL to the Apps Script which will fetch and attach the file.s
export const AGREEMENT_PDF_URL = '/Buddy_Tezz_UGC_Agreement.pdf'
export const AGREEMENT_PDF_NAME = 'Buddy_Tezz_UGC_Agreement.pdf'

// Willingness responses sheet (the spreadsheet you provided)
export const WILLINGNESS_SHEET_ID = '1mTrReLcWGxTbK8gp1BHIok-L6ElBsteZSR4M_R1adIw'

// WhatsApp message variants sent to creators (used to build click-to-chat links)
export const WHATSAPP_MESSAGES = {
  Hindi: `Hi, this is Priya from Buddy Tezz AI Automation Company �

I’ve shared the consent form, please read and confirm if you agree to work with us.

� For Hindi UGC Creators:

� What you need to do:
* Script will be provided (in Hindi) – follow it exactly
* Record video using mic (clear audio is must)
* Speak naturally with good expressions

━━━━━━━━━━━━━━━
� STRICT GUIDELINES (Must Follow)
━━━━━━━━━━━━━━━
* Vertical video (9:16)
* Good lighting & clean background
* Stable camera (no shaking)
* Face clearly visible
* No filters, effects, or watermark
* No product review / personal opinions
* Raw video only (no editing, no cuts, no music, no subtitles)
* High quality (HD)
Guidelines video - 
https://youtube.com/shorts/p8GF6EwB8SI?feature=share
━━━━━━━━━━━━━━━

� Submission:
* Upload in given Drive link
* Timeline: within 24 hours

� Payment:
* ₹500–₹1000 (based on performance & quality)

━━━━━━━━━━━━━━━
� DEMO VIDEOS (Watch Before Shooting)
━━━━━━━━━━━━━━━
https://drive.google.com/drive/folders/1s_22HlwBs9nP7x6nLkHbQQy3cnKPzHoL
━━━━━━━━━━━━━━━

If guidelines are not followed, revisions may be required.

For any questions, feel free to reach out.

Team Buddy Tezz Ai 🤖`,
  Vernac: `Hi, this is Priya from Buddy Tezz AI Automation Company �

I’ve shared the consent form—please read and confirm if you agree to work with us.

� What you need to do:
* Follow the script provided (no changes)
* Record video using mic (clear audio is must)
* Act natural & match script tone

� Shooting Guidelines:
* Vertical video (9:16)
* Good lighting & clean background
* Stable camera (no shake)
* Face clearly visible
* No filters, effects, or watermark

� Important:
* No product review / personal opinions
* Raw video only (no editing, no cuts, no music, no subtitles)
* High quality (HD)

� Submission:
* Upload in given Drive link (will be shared)
* Timeline: within 24 hours

� Payment:
* ₹500–₹1000 (based on performance & quality)

� Demo Videos (for reference):
Telugu:
https://drive.google.com/file/d/1kLidAjiqlouOkjUiyVTpA1pFjgdWpMAe/view?usp=drivesdk
https://drive.google.com/file/d/1GbZ17oz8cEUqqM4ApuxPyE5F3DurfuHp/view?usp=drive_link
https://drive.google.com/file/d/1nWZu2Cg61wLd_J47E7aQWLfGtXYgGYMr/view?usp=drivesdk

Tamil:
https://drive.google.com/file/d/1wWB2AzIIuVE4cz5R4N0wfrt8IHHAUldm/view?usp=drivesdk
https://drive.google.com/file/d/1K0tX0NehBeHBiP2DU2eZJ56G-uh06m73/view?usp=drivesdk
https://drive.google.com/file/d/1Pf4G5bS2UZ06C0hghuO6X1OcDowjhFvh/view?usp=drivesdk

Kannada:
https://drive.google.com/file/d/1goB-OliCE3pHJdSDmK8Qmx8_dA1jwdJ6/view?usp=drivesdk
https://drive.google.com/file/d/1NbJr_HiJlA6vw2GegCr1OFmGEQLRCHRS/view?usp=sharing
https://drive.google.com/file/d/1PfT7acZYMokcYA3dsQjoItkiSawZ3DBa/view?usp=sharing

Regards
Team Buddy Tezz AI🤖`,
}

export const WHATSAPP_PITCH = WHATSAPP_MESSAGES.Hindi

export const WHATSAPP_REMINDER_MESSAGES = {
  Hindi: `Hi, This is Priya from Buddy Tezz AI, 

just a quick follow-up on the consent email.

Please review the agreement and reply with your consent if interested. Also, make sure to fill out the form:
https://forms.gle/JZqW4Wf21c2MFFfGA

If you’ve already completed both, please ignore this message.

Looking forward to having you onboard!

Best regards,
Priya
Team Buddy Tezz AI`,
  Vernac: `Hi, This is Priya from Buddy Tezz AI, 

just a quick follow-up on the consent email.

Please review the agreement and reply with your consent if interested. Also, make sure to fill out the form:
https://forms.gle/JZqW4Wf21c2MFFfGA

If you’ve already completed both, please ignore this message.

Looking forward to having you onboard!

Best regards,
Priya
Team Buddy Tezz AI`,
}

export const WHATSAPP_REMINDER_PITCH = WHATSAPP_REMINDER_MESSAGES.Hindi

// Map each language to the consent email subject + body template.
// {{name}} is replaced with the creator's name.
export const CONSENT_TEMPLATES = {
  Tamil: {
    subject: 'Buddy Tezz AI – Creator Onboarding Consent',
    body: `Dear {{name}},

Please find the Buddy Tezz UGC Agreement attached for your review.

To proceed, kindly complete the following:

1. Review the agreement carefully
2. Reply to this email
3. Type: “I agree to the terms mentioned over the email”

💼 Work Overview
Paid, long-term collaboration opportunity.

🎯 Create short-form UGC videos based on provided scripts.

💰 Compensation
Performance-based, with growth opportunities based on quality and consistency.

⏳ Timeline
Video submission within 24 hours of script allocation.
Mic use is Mandatory

📌 Consistent quality can lead to higher payouts and ongoing work.

For any questions, feel free to reply.

Please fill this form and reply to this email with your consent here is the form link - https://forms.gle/JZqW4Wf21c2MFFfGA

Best regards,
Priya Badiwal
Buddy Tezz AI Team`,
  },
  Kannada: {
    subject: 'Buddy Tezz AI – Creator Onboarding Consent',
    body: `Dear {{name}},

Please find the Buddy Tezz UGC Agreement attached for your review.

To proceed, kindly complete the following:

1. Review the agreement carefully
2. Reply to this email
3. Type: “I agree to the terms mentioned over the email”

💼 Work Overview
Paid, long-term collaboration opportunity.

🎯 Create short-form UGC videos based on provided scripts.

💰 Compensation
Performance-based, with growth opportunities based on quality and consistency.

⏳ Timeline
Video submission within 24 hours of script allocation.
Mic use is Mandatory

📌 Consistent quality can lead to higher payouts and ongoing work.

For any questions, feel free to reply.

Please fill this form and reply to this email with your consent here is the form link - https://forms.gle/JZqW4Wf21c2MFFfGA

Best regards,
Priya Badiwal
Buddy Tezz AI Team`,
  },
  Default: {
    subject: 'Buddy Tezz AI – Creator Onboarding Consent',
    body: `Dear {{name}},

Please find the Buddy Tezz UGC Agreement attached for your review.

To proceed, kindly complete the following:

1. Review the agreement carefully
2. Reply to this email
3. Type: “I agree to the terms mentioned over the email”

💼 Work Overview
Paid, long-term collaboration opportunity.

🎯 Create short-form UGC videos based on provided scripts.

💰 Compensation
Performance-based, with growth opportunities based on quality and consistency.

⏳ Timeline
Video submission within 24 hours of script allocation.
Mic use is Mandatory

📌 Consistent quality can lead to higher payouts and ongoing work.

For any questions, feel free to reply.

Please fill this form and reply to this email with your consent here is the form link - https://forms.gle/JZqW4Wf21c2MFFfGA

Best regards,
Priya Badiwal
Buddy Tezz AI Team`,
  },
}
