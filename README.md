# Buddy Tezz AI — Creator Outreach Dashboard

A free, no-cost dashboard that reads your Google Form response sheet live and gives you
one-click actions for WhatsApp outreach and consent emails — replacing the manual
copy-paste workflow.

## What it does

- Pulls creators from your response sheet in real time (sorted/filterable by language)
- **WhatsApp**: generates a pre-filled `wa.me` click-to-chat link per creator — one click
  opens WhatsApp with your message already typed, no manual number lookup/copy-paste. You
  can choose the Hindi or Vernac message per creator before sending.
- **Email**: one click sends the correct consent email (templated per language) via Gmail,
  for free, through a small Google Apps Script
- Tracks each creator's stage (New → WhatsApp sent → Agreed → Consent sent) locally in your browser

> Why not fully automated WhatsApp? WhatsApp Business API providers (Wati, Interakt,
> Twilio) all charge per message, and unofficial bots risk getting your number banned.
> The `wa.me` link approach is 100% free, official, and reduces each send to one click.

## Setup (one-time, ~10 minutes)

### 1. Share your Google Sheet
Open your response sheet → Share → "Anyone with the link" → Viewer.
(Read-only access — no one can edit it.)

### 2. Configure the dashboard
Edit `src/config.js`:
- `SHEET_ID` — already filled in from your sheet URL
- `SHEET_NAME` — set this to your response tab's exact name (e.g. "Form Responses 1")
- `WHATSAPP_PITCH` — the follow-up message sent over WhatsApp
- `WHATSAPP_MESSAGES` — the Hindi and Vernac WhatsApp message variants shown in the dashboard
- `CONSENT_TEMPLATES` — one email template per language (Tamil, Kannada, Default, …)

### 3. Set up free email sending (Google Apps Script)
1. Go to https://script.google.com → New project
2. Replace the code with the contents of `apps-script/Code.gs`
3. Deploy → New deployment → type "Web app" → Execute as **Me**, Access **Anyone**
4. Copy the deployment URL → paste into `APPS_SCRIPT_URL` in `src/config.js`

This uses your own Gmail account's free sending quota (no third-party cost).

## Run locally

```bash
npm install
npm run dev
```

## Build for deployment

```bash
npm run build
```
Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages — all free tiers).

## Notes on Phase 2 (Instagram discovery/outreach)

Instagram actively blocks automated DMs and scraping; doing this for free without risking
an account ban isn't realistic. The lower-risk free path is to drive creators to comment
on a post and use Instagram's own "auto-reply to comments" feature (in Meta Business Suite,
free) to DM them your hiring-form link automatically.
