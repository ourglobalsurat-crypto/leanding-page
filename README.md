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
- Authenticated admin dashboard at a private, non-`/admin` URL that 404s everywhere else
- Lead search, filters, status management, notes, detail view, and a password-protected Excel export
- Draft-and-publish questionnaire builder with add, edit, hide, delete, and reorder controls
- Short text, long text, email, phone, number, date, dropdown, single choice, checkboxes, yes/no, and rating question types
- Versioned forms and answer snapshots, so old leads keep the exact question text and options they answered
- Optional server-side forwarding of every stored lead into the external Leadgen CRM, with retries and idempotent delivery
- Neon Postgres persistence, server-side validation, signed sessions, password hashing, rate limits, honeypot protection, idempotent submissions, and security headers

## Performance dashboard

The admin overview supports Today, Yesterday, Last 7 days, Last 30 days, This month, and custom ranges of up to 90 calendar days. Source, campaign, and current lead status filters apply to every metric, chart, and recent-lead row. Filters persist in the URL; use Apply filters to update the report or the refresh button to fetch new submissions.

All date boundaries and hourly buckets use Asia/Kolkata (IST). Period comparisons use the preceding equal number of calendar days with the same filters. A period ending today includes a partial day, while its comparison contains full days. Qualification rate counts leads currently marked qualified or won, divided by selected leads; this is not a visitor conversion rate. The status chart shows current statuses, not historical stage transitions. Untagged campaigns are shown separately, and ad spend, CPL, and ROAS are not inferred from lead counts.

Dashboard checks:

```bash
npm run test:dashboard
npm run test:dashboard -- --database
npm run qa:dashboard
```

The optional database check uses read-only SQL fixtures and does not insert leads. Browser QA requires a running local app and the existing admin credentials in `.env.local`; it checks authentication, filters, date validation, chart views, empty results, and desktop/mobile layouts without modifying leads. Screenshots are saved under `artifacts/qa/`.

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

5. Open `http://localhost:3000` for the landing page, or `http://localhost:3000/gsm-admin` for the lead desk (see [Admin panel URLs](#admin-panel-urls) — `/admin` deliberately 404s).

The setup script is idempotent. Running it again updates the configured admin password without deleting leads or published form data.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Neon Postgres connection used by the web application |
| `DATABASE_URL_UNPOOLED` | Optional direct Neon connection used for schema setup |
| `ADMIN_EMAIL` | Initial admin login email |
| `ADMIN_PASSWORD` | Initial admin login password; use a strong unique value |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign admin sessions and short-lived lead receipts |
| `ADMIN_URL_SLUGS` | Optional. Comma-separated URL segments the admin panel answers on. Defaults to `gsm-admin,fenil-admin`. See [Admin panel URLs](#admin-panel-urls) |
| `LEAD_ENCRYPTION_PASSPHRASE` | Encrypts every lead's stored phone number and email address. Losing this permanently loses the ability to read them. See [Lead data encryption](#lead-data-encryption) |
| `LEAD_INDEX_PASSPHRASE` | Separate passphrase that only powers admin search by exact phone/email — cannot decrypt anything on its own. See [Lead data encryption](#lead-data-encryption) |
| `LEAD_EXPORT_REAL_PASSPHRASE` | Opens a lead export containing the real leads, and typed into "Add content" to produce one. See [Lead export and the decoy file](#lead-export-and-the-decoy-file) |
| `LEAD_EXPORT_DECOY_PASSPHRASE` | Opens the export that the plain **Export CSV** button produces, which contains invented leads |
| `CRM_LEAD_FORM_URL` | Optional. The Leadgen CRM connection link, including its `?form=` token. Set it to mirror every stored lead into the CRM; unset disables forwarding. See [External CRM forwarding](#external-crm-forwarding) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Digits-only WhatsApp number including country code |
| `NEXT_PUBLIC_CONTACT_PHONE` | Display phone number |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Display contact email |

Never commit `.env.local`. The repository intentionally tracks only `.env.example`.

## Admin panel URLs

The admin panel is not mounted at `/admin`. It answers at `/gsm-admin` and `/fenil-admin` (both render the identical panel), and every other path — including `/admin` itself — gets the site's ordinary 404, indistinguishable from a mistyped URL. This is implemented as a dynamic route segment (`src/app/[adminSlug]/`) that calls Next's `notFound()` for any segment not in the allowlist; see `src/lib/admin-routes.ts`.

**This is obscurity, not authentication.** The password login behind these URLs is still the real security boundary — a hard-to-guess path only cuts down automated bots that scan for a well-known `/admin`. Anyone who learns either URL still needs valid credentials to see anything. Do not treat this as a substitute for a strong password, and do not rely on it alone.

Change the two segments with `ADMIN_URL_SLUGS` (comma-separated), for example if either leaks:

```
ADMIN_URL_SLUGS=gsm-admin,fenil-admin
```

**Never put an admin URL in `robots.txt` and never link to it from the public site.** `robots.txt` is a public, unauthenticated file anyone can read at `/robots.txt` — a `Disallow` entry there publishes the exact path it names, to every visitor and every scraper, which defeats the purpose entirely. `src/app/robots.ts` deliberately excludes the admin paths for this reason. Likewise, no page in this repository links to the admin panel; share the URL with your team directly (bookmark it, don't paste it into a public doc), the same way you'd share a password.

## Lead data encryption

A lead's phone number and email address are stored only as AES-256-GCM ciphertext (`phone_enc`/`email_enc` on the `leads` table) — a stolen database backup contains no readable contact details. Name and city are stored as plain text on purpose: see "What isn't encrypted, and why" below. This is implemented in `src/lib/lead-crypto.ts`.

### Two passphrases, two different jobs

- `LEAD_ENCRYPTION_PASSPHRASE` encrypts and decrypts the field. This is what protects the data.
- `LEAD_INDEX_PASSPHRASE` computes a separate "blind index" — a keyed hash (HMAC-SHA256) of the normalized phone/email, stored alongside the ciphertext purely so the admin search box can find an exact match without decrypting anything to do it.

They're kept apart deliberately: leaking the index passphrase lets someone test guesses against the index (confirm whether a specific number is in your leads) but decrypts nothing. Leaking the encryption passphrase decrypts data but can't be used to search or enumerate what's stored. A single shared key would let a leak of either do both.

Both passphrases are stretched into real 256-bit keys via `scrypt` before use, so a memorable passphrase is still safe as the input. **If you ever lose both passphrases, every encrypted phone number and email address becomes permanently unreadable — there is no recovery path.** Back them up somewhere durable (a password manager), not only in `.env.local`.

### What isn't encrypted, and why

The admin search box does partial, "contains" matching ("Raj" finds "Rajesh") — that's how `name` and `city` search has always worked, and it stays exactly as it is because both remain plain text. A blind index only supports **exact** matches, so encrypting name/city would silently break that kind of search; encrypting phone/email instead narrows their search from "contains" to "exact, normalized match" — typing a complete phone number or email address finds the lead, typing the last 4 digits or a domain like `@gmail.com` does not. This trade-off is why phone/email were chosen for encryption and name/city were not: phone and email are what let someone actually contact or impersonate a real person, which is the sharper risk.

### Migrating an existing database

A fresh `npm run db:setup` already creates the encrypted columns — nothing further to do. A database created before this feature existed needs a one-time migration:

```bash
npm run db:migrate-encrypt-leads                  # dry run — reports what would change, writes nothing
npm run db:migrate-encrypt-leads -- --apply        # adds the columns and encrypts existing rows
```

It's safe to re-run: every step is `IF NOT EXISTS`/idempotent, and it only touches rows that don't have encrypted data yet. It deliberately does **not** drop the old plaintext `phone`/`email` columns — check that the admin panel shows the right phone number and email for a few real leads first, then drop them yourself:

```sql
ALTER TABLE leads DROP COLUMN phone, DROP COLUMN email;
```

Run `npm run test:lead-crypto` after changing anything in `src/lib/lead-crypto.ts` — it covers round-tripping, tamper detection, wrong-key/wrong-row decryption failures, and blind-index normalization.

## Lead export and the decoy file

The lead export is a **password-protected `.xlsx`**, not a CSV. Two reasons: a `.csv` opens in whatever the machine has associated with it (often a text editor), whereas `.xlsx` opens in Excel; and Office Open XML has a documented encryption format, so the file itself is AES-encrypted and **Excel asks for the password when the file is opened**. A plain CSV was readable by anyone who got hold of it. This is not.

There are two controls on the leads page, and neither mentions a key:

| Control | What happens |
| --- | --- |
| **Export CSV** | Downloads immediately, no prompt. The file opens with `LEAD_EXPORT_DECOY_PASSPHRASE` and contains invented leads. |
| **Add content** → `LEAD_EXPORT_REAL_PASSPHRASE` | The file opens with that passphrase and contains the real, decrypted leads. |
| **Add content** → anything else | The file opens with whatever was typed, contains invented leads, and the typed text is written into the sheet as content. |

There is deliberately **no error, ever** — no "wrong passphrase", no different status code, no different wait. A wrong entry produces a working file full of invented rows, indistinguishable from the decoy passphrase's. The two passphrases are compared in constant time and neither is ever written into the file.

The file is always locked with whatever was typed, so **every entry produces a file that opens**. Locking a wrong entry's file with something else would make it refuse to open, and "this file won't open" is itself the error message this design exists to avoid.

The decision is made server-side (`src/lib/export-unlock.ts`). Requesting `/api/admin/leads/export` directly, skipping the buttons, returns the decoy file rather than an error — a `405` there would be a signpost saying the real data sits behind something else.

### What the decoy file contains

Invented rows, generated in `src/lib/decoy-leads.ts`. **The only thing taken from the database is the number of leads**, so the file is a believable size; not one name, number, address, date or answer in it comes from a real record. Generation is deterministic, so exporting twice produces identical files — fresh random names on each download would itself be the tell.

The invented phone numbers are structurally valid Indian mobile numbers, which is what makes them believable and also means one could in principle belong to a real stranger. Nothing ever dials them, but they can be switched to an unassignable prefix if you would rather.

### Opening the file

**Excel, LibreOffice Calc and Apple Numbers** can open password-protected `.xlsx`. **Google Sheets cannot** — it has no way to prompt for the password, so uploading one of these files there will fail. Open it in Excel.

### What is not possible, and why

A button *inside the spreadsheet* that reveals the real data on a second passphrase is not something this can do safely:

- Doing it in-file needs a VBA macro, and Excel has blocked macros in files downloaded from the internet by default since 2022. Anyone receiving one would have to deliberately unblock it, and antivirus treats macro-enabled downloads as suspicious.
- More importantly, the real data would then have to be *inside* the file to be revealed — and anything inside the file can be extracted from it by unzipping, whatever the button does. A second lock drawn on top of data that is already in the file protects nothing.

So the second passphrase is entered in the admin panel, where the server can decide what to put in the file before it is ever built. The real data is simply never in the decoy file to begin with.

For the same reason, the export is not a downloadable script that prompts for a passphrase: a script that arrives from a website and asks to be run is the shape of malware, browsers and antivirus block it, and on Windows it would not run on a double-click anyway. The encrypted workbook gets the same "enter the key to unlock" behaviour natively, through Excel.

### What this does not cover

**The leads pages still show real phone numbers and email addresses on screen to anyone who is logged in.** This covers the one-click bulk export — the fastest way to walk off with everything — and nothing else. Someone with working admin credentials can still read the real data off `/leads`, or scrape it. Treat the decoy as a speed bump on bulk exfiltration, not as "the data is hidden now".

Keep `LEAD_EXPORT_REAL_PASSPHRASE` **different from `LEAD_ENCRYPTION_PASSPHRASE`**. The export passphrase gets typed into a web form and into Excel's password box; the key that protects every stored phone number and email should go in neither.

Run `npm run test:export-unlock` after touching any of this. It covers near-misses, empty and unset passphrases, the no-echo rule, that the workbook is genuinely encrypted rather than a plain zip, that a wrong password cannot open it, and that its contents never appear in the clear inside the file.

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

## External CRM forwarding

Every stored lead is also mirrored into the external Leadgen CRM at `leadgen.globalsurat.com`, so the sales team can work leads there instead of only in the lead desk. Set `CRM_LEAD_FORM_URL` to the connection link the CRM gives you — the one behind its **Send an enquiry** button, including the `?form=` token — and forwarding turns itself on. Leave it unset and nothing is sent anywhere; the lead desk is unaffected either way.

**The `?form=` token is a credential.** Anyone holding it can post leads into your CRM account. Keep it in `.env.local` and in your host's environment settings, never in a commit and never in client-side code. Rotate it in the CRM if it leaks.

### How it works

The CRM ships a browser connector (`assets/lead-form.js`) that draws its own enquiry form. This site deliberately does not use it. That script binds a capturing `submit` listener and calls `stopImmediatePropagation()`, which would break this app's own React submit handler, and it reads answers off mounted `<input name="...">` elements — but the public form asks one question at a time, so most inputs are unmounted by the last step. The CSP in `next.config.ts` would also block its request, because `connect-src` allows only `'self'` and the Google Tag Manager origins.

Instead `src/lib/crm-forward.ts` posts to the same JSON endpoint from the server, and `src/app/api/leads/route.ts` calls it inside Next's `after()` — **after** the lead is committed to Postgres and the visitor's response has been sent. The JSON endpoint (`website-leads.php`) is derived from the link you paste, exactly as the connector derives it from its own script URL.

Each send takes a fresh single-use challenge with a `GET`, then posts the lead. The lead's own UUID travels as the CRM's `request_id`, which is what the CRM deduplicates on, so the three retry attempts (1s and 4s apart, 15s timeout each) cannot create duplicate CRM records. Contact details fill the CRM's name, phone and email fields; every other answer goes into its per-question fields and is repeated in the enquiry body, with option ids rendered as their English labels. The lead's UUID is included as a **Lead ID** field so a CRM record can be matched back to the full answer history and notes in the lead desk.

### When it fails

The CRM is a mirror, never the system of record. A CRM that is slow, unreachable or misconfigured cannot fail a submission, delay the thank-you page, or lose a lead — the lead is already in the database before forwarding starts. After three failed attempts the server logs `CRM forwarding failed for lead <uuid>` with the lead's ID and no contact details; look that ID up in the lead desk and enter it in the CRM by hand. A lead with no name or no phone number is skipped without being sent, because the CRM rejects those.

> Forwarding puts a **second, unencrypted copy** of each lead's name, phone number and email address inside the CRM. That is the point of the integration, but it does mean the protection described in [Lead data encryption](#lead-data-encryption) covers this database only, not the CRM. Whoever can log into the CRM can read every forwarded lead's contact details.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run test:lead-crypto
npm run test:export-unlock
npm run test:crm-forward
```

`test:crm-forward` stubs the network — it never contacts the real CRM and never creates a CRM record.

For the browser flow, start the app and run:

```bash
QA_BASE_URL=http://localhost:3000 npm run qa:e2e
```

On Windows PowerShell:

```powershell
$env:QA_BASE_URL = "http://localhost:3000"
npm run qa:e2e
```

The browser test submits and removes a synthetic lead, verifies admin login, updates a lead, creates and deletes a draft question, checks 1440/390/320 layouts, and writes ignored screenshots to `artifacts/qa`. The admin URL it drives is `gsm-admin` by default; override with `QA_ADMIN_SLUG` if you changed `ADMIN_URL_SLUGS`.

> As of writing, this script fails on an unrelated pre-existing timing issue (`scripts/qa.mjs:116`, a Playwright/Chrome race on `response.json()` after a client-side redirect) — reproducible on a clean checkout with no changes at all. Not caused by anything in this repository's application code; needs its own fix.

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
