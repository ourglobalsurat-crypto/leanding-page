# Global Surat lead landing page

A mobile-first Meta ads landing page and lead desk for Global Surat. The public experience starts in English, with Hindi and Gujarati options—using familiar terms such as Google, WhatsApp, Ads, and Shopify in English—and guides visitors through one large, simple question at a time. Visitors first choose Lead Generation or D2C Growth, then see only the questions relevant to that path. Every question is managed from the protected admin panel and stored in Neon Postgres.

## What is included

- Public landing pages at `/` and `/contact`
- English, हिन्दी, and ગુજરાતી language switching
- One-question-at-a-time conditional lead form with separate Lead Generation and D2C Growth paths
- Large tap targets, path-aware progress, validation, consent, and a WhatsApp fallback
- UTM, source, campaign, referrer, language, and questionnaire-version capture
- Receipt-gated conversion page at `/thank-you` after a lead is successfully stored
- Google Tag Manager container `GTM-W44W95MN` on every route, with a CSP allowlist for it
- Deduplicated `dataLayer` and Meta Pixel lead-event hooks with an opaque event ID
- Authenticated admin dashboard at `/admin`
- Lead search, filters, status management, notes, detail view, and CSV export
- Draft-and-publish questionnaire builder with add, edit, hide, delete, and reorder controls
- Short text, long text, email, phone, number, date, dropdown, single choice, checkboxes, yes/no, and rating question types
- Versioned forms and answer snapshots, so old leads keep the exact question text and options they answered
- Neon Postgres persistence, server-side validation, signed sessions, password hashing, rate limits, honeypot protection, idempotent submissions, and security headers

## Local setup

Requires Node.js 20.9 or newer.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the values. Use the pooled Neon URL (`-pooler` hostname) for `DATABASE_URL`. If available, use a direct Neon URL for `DATABASE_URL_UNPOOLED`; schema setup prefers it.

3. Create the schema, seed the editable form, and create/update the admin account:

   ```bash
   npm run db:setup
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` for the landing page or `http://localhost:3000/admin` for the lead desk.

The setup script is idempotent. Running it again updates the configured admin password without deleting leads or published form data.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Neon Postgres connection used by the web application |
| `DATABASE_URL_UNPOOLED` | Optional direct Neon connection used for schema setup |
| `ADMIN_EMAIL` | Initial admin login email |
| `ADMIN_PASSWORD` | Initial admin login password; use a strong unique value |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign admin sessions and short-lived lead receipts |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Digits-only WhatsApp number including country code |
| `NEXT_PUBLIC_CONTACT_PHONE` | Display phone number |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Display contact email |

Never commit `.env.local`. The repository intentionally tracks only `.env.example`.

## Questionnaire workflow

Edits are saved to a draft and do not immediately affect live visitors. Select **Publish changes** when the draft is ready. Publishing archives the old version, makes the draft live atomically, and creates a new editable draft. Leads submitted from a recently archived form remain accepted for 24 hours so visitors already filling the form are not lost.

The first question selects either the `lead_generation` or `d2c_growth` path. Questions assigned to one path remain hidden from visitors on the other path; shared questions, including the required name and WhatsApp-number fields, appear in both. The admin questionnaire editor allows non-system questions to be assigned to **Both paths**, **Lead Generation only**, or **D2C Growth only**. Core selector and contact roles are protected so an edit cannot make the published flow impossible to submit.

Question keys should stay stable once they are used for important contact fields. The default `full_name`, `phone`, `email`, and `city` keys are also copied into searchable lead columns. Server-side validation independently reconstructs the selected path, rejects hidden or unrecognized answers, and validates every visible required question.

## Thank-you page and conversion tracking

A successful lead submission performs a full navigation to `/thank-you`. The API issues a signed, short-lived, `HttpOnly` receipt only after the lead has been stored. The thank-you page verifies that receipt on the server; a direct or expired visit is redirected to `/contact#growth-check`. The receipt contains no contact details, and the page is marked `noindex` and disallowed in `robots.txt`.

For tag-manager integrations, the page queues this event after receipt verification:

```js
{
  event: "generate_lead",
  event_id: "opaque-deduplication-id",
  growth_path: "lead_generation" // or "d2c_growth"
}
```

If a global Meta Pixel `fbq` function is present, the page also sends a Meta `Lead` event with the same event ID. A session marker prevents repeat emission when the visitor refreshes the page. Do not place access tokens, private keys, database credentials, phone numbers, names, or other lead data in analytics events.

### Google Tag Manager

Container `GTM-W44W95MN` loads on every route from the root layout in `src/app/layout.tsx`, using `next/script` with the `afterInteractive` strategy and the standard `<noscript>` iframe as the first element in `<body>`. The container ID is a public value and is hardcoded; change `GTM_CONTAINER_ID` in that file to point at a different container.

Because GTM loads after hydration, the `generate_lead` push above can land in `dataLayer` before the container initializes. That is safe: `dataLayer` is a queue, and GTM processes everything already in it on startup.

The Content Security Policy in `next.config.ts` allowlists only the Google origins GTM and GA4 need (`gtmScriptSrc`, `gtmImgSrc`, `gtmConnectSrc`, `gtmFrameSrc`). **Any other vendor tag added inside the container — Meta Pixel, Google Ads remarketing, a chat widget — will be blocked silently until its domains are added to those constants.** After publishing a new tag, check the browser console for CSP violations.

GTM Preview and Tag Assistant frame the site, so they are blocked by `frame-ancestors 'none'` and `X-Frame-Options: DENY`. Relax those two headers temporarily if you need to debug the container in a deployed environment, and restore them afterwards.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

For the browser flow, start the app and run:

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:e2e
```

On Windows PowerShell:

```powershell
$env:QA_BASE_URL = "http://localhost:3000"
npm run qa:e2e
```

The browser test submits and removes a synthetic lead, verifies admin login, updates a lead, creates and deletes a draft question, checks 1440/390/320 layouts, and writes ignored screenshots to `artifacts/qa`.

## Deployment

Vercel or another Node-compatible Next.js host can run the application. Add every environment variable above in the host and run `npm run db:setup` once when preparing a new database.

For an existing production installation, publish the branching questionnaire in this order:

1. Verify the production environment variables and, when practical, create a Neon branch or other recoverable database checkpoint. Never paste production values into source files or command history.
2. Run `npm run typecheck`, `npm run lint`, and `npm run build` against the release commit.
3. Deploy the compatible application code first. Confirm `/contact`, `/api/leads`, and the admin questionnaire page are healthy while the existing questionnaire remains published.
4. From a trusted environment configured with the production database variables, run:

   ```bash
   npm run db:publish-branching-form
   ```

5. Confirm that the first live question offers Lead Generation and D2C Growth, submit one test lead through each path, verify both appear in the admin lead desk, and verify each successful submission reaches `/thank-you`.

Do not run `db:publish-branching-form` before the compatible app deployment: older application code does not understand path-specific questions. The publishing command is idempotent. It archives the previous published and draft versions without deleting historical questions or leads, publishes the branching version atomically, and creates a fresh editable draft. Because public pages are dynamically rendered, a second deployment is not required after the publish command.

The optimized supplied logo and team photo live in `public/assets`; the large source originals are intentionally excluded from Git.

Before production traffic, rotate any database password that has been shared in chat or another non-secret channel and update the deployment environment variable.
