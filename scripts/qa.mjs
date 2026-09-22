import path from "node:path";
import { mkdir } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: path.resolve(".env.local"), quiet: true });

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3000";
// Must match one entry in ADMIN_URL_SLUGS (src/lib/admin-routes.ts defaults to
// gsm-admin,fenil-admin when that variable is unset).
const adminSlug = process.env.QA_ADMIN_SLUG ?? "gsm-admin";
const outputDir = path.resolve("artifacts", "qa");
const errors = [];
const createdLeadIds = new Set();
const qaRunId = Date.now().toString(36);
const leadGenerationName = `QA Lead Generation ${qaRunId}`;
const d2cGrowthName = `QA D2C Growth ${qaRunId}`;
const seoName = `QA SEO ${qaRunId}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function watchPage(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${label} page: ${error.message}`));
}

function rememberCreatedLead(result) {
  if (typeof result?.leadId === "string") createdLeadIds.add(result.leadId);
}

function assertThankYouUrl(url, submittedName, submittedPhone) {
  const parsed = new URL(url);
  assert(parsed.pathname === "/thank-you", `Expected /thank-you, received ${parsed.pathname}.`);
  assert(parsed.search === "" && parsed.hash === "", "Thank-you URL must not contain query parameters or a hash.");
  assert(!url.includes(encodeURIComponent(submittedName)) && !url.includes(submittedName), "Thank-you URL exposes the submitted name.");
  assert(!url.includes(submittedPhone), "Thank-you URL exposes the submitted phone number.");
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "msedge" } : {}),
});

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const page = await desktopContext.newPage();
  watchPage(page, "desktop");

  const directThankYouContext = await browser.newContext();
  const directThankYouPage = await directThankYouContext.newPage();
  await directThankYouPage.goto(`${baseUrl}/thank-you`, { waitUntil: "domcontentloaded" });
  await directThankYouPage.waitForURL(`${baseUrl}/contact#growth-check`, { timeout: 15000 });
  await directThankYouContext.close();

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert((await page.title()).includes("Global Surat"), "Landing page title is incorrect.");
  assert(await page.getByRole("heading", { name: /Want more customers/ }).isVisible(), "English hero heading is not visible by default.");
  assert(await page.getByRole("heading", { name: /What would you like help with/ }).isVisible(), "English questionnaire is not visible above the fold.");
  assert(await page.evaluate(() => document.documentElement.lang === "en-IN"), "English is not the page's default language.");
  assert(
    JSON.stringify(await page.locator(".language-switch button").allTextContents()) === JSON.stringify(["English", "हिन्दी", "ગુજરાતી"]),
    "Language choices are not ordered English, Hindi, Gujarati.",
  );
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Desktop page has horizontal overflow.");
  assert(await page.evaluate(() => {
    const header = document.querySelector(".site-header")?.getBoundingClientRect();
    const logo = document.querySelector(".brand-link img")?.getBoundingClientRect();
    return Boolean(header && logo && logo.top >= header.top && logo.bottom <= header.bottom);
  }), "Desktop logo is clipped by the navbar.");
  await page.screenshot({ path: path.join(outputDir, "landing-header-desktop.png"), fullPage: false });
  await page.screenshot({ path: path.join(outputDir, "landing-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "हिन्दी" }).click();
  assert(await page.getByRole("heading", { name: /अपने बिज़नेस के लिए ज़्यादा/ }).isVisible(), "Hindi hero heading is not visible.");
  assert(await page.getByRole("heading", { name: /आपको किस काम में मदद चाहिए/ }).isVisible(), "Hindi questionnaire is not visible.");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Hindi page has horizontal overflow.");
  await page.screenshot({ path: path.join(outputDir, "landing-hindi.png"), fullPage: false });

  await page.getByRole("button", { name: "ગુજરાતી" }).click();
  assert(await page.getByRole("heading", { name: /તમારા બિઝનેસ માટે વધુ/ }).isVisible(), "Gujarati hero heading is not visible.");
  assert(await page.getByRole("heading", { name: /તમને કઈ બાબતમાં મદદ જોઈએ છે/ }).isVisible(), "Gujarati questionnaire is not visible.");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Gujarati page has horizontal overflow.");
  await page.screenshot({ path: path.join(outputDir, "landing-gujarati.png"), fullPage: false });

  await page.getByRole("button", { name: "English" }).click();

  // Start on Lead Generation, answer one branch-only question, then switch to
  // D2C. The stale Lead Generation answer must be pruned before submission.
  await page.getByRole("radio", { name: /Get more enquiries/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  assert(await page.getByRole("heading", { name: /What type of business do you operate/ }).isVisible(), "Lead Generation branch did not open.");
  await page.getByRole("radio", { name: /^B2B/ }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("radio", { name: /Grow online product sales/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  assert(await page.getByRole("heading", { name: /Share your website or online store link/ }).isVisible(), "D2C Growth branch did not open after switching paths.");
  assert((await page.locator(".step-count").textContent())?.trim() === "02 / 06", "D2C progress does not use the six-question visible path.");
  await page.getByPlaceholder(/yourstore\.com/).fill("https://qa-store.example");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Pre-launch \/ New Brand/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /₹1–3 lakh/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Enter your full name").fill(d2cGrowthName);
  await page.getByRole("button", { name: "Continue" }).click();
  const d2cPhone = "9876543210";
  await page.getByPlaceholder("Enter your WhatsApp number").fill(d2cPhone);
  await page.locator(".consent-row input").check();

  const d2cResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/leads") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Send my details/ }).click();
  const d2cResponse = await d2cResponsePromise;
  const d2cResult = await d2cResponse.json();
  rememberCreatedLead(d2cResult);
  assert(d2cResponse.status() === 201 && d2cResult.ok, `D2C lead submission failed with ${d2cResponse.status()}.`);

  const d2cAnswers = d2cResponse.request().postDataJSON()?.answers ?? {};
  assert(d2cAnswers.growth_path === "d2c_growth", "D2C submission has the wrong growth path.");
  assert(
    JSON.stringify(Object.keys(d2cAnswers).sort()) === JSON.stringify([
      "full_name",
      "growth_path",
      "monthly_ad_budget",
      "monthly_online_revenue",
      "phone",
      "website_url",
    ]),
    "D2C submission retained a hidden Lead Generation answer or omitted a visible answer.",
  );

  await page.waitForURL(`${baseUrl}/thank-you`, { timeout: 15000 });
  assertThankYouUrl(page.url(), d2cGrowthName, d2cPhone);
  await page.getByRole("heading", { name: "Your Details Have Been Received!" }).waitFor();
  assert(await page.getByText(/growth team will review your business details/).isVisible(), "Thank-you explanation is missing.");
  assert(await page.getByRole("link", { name: /Discuss My Growth Plan on WhatsApp/ }).isVisible(), "Thank-you WhatsApp CTA is missing.");
  await page.waitForFunction(() => window.dataLayer?.some((entry) => entry.event === "generate_lead"));
  const d2cConversionEvents = await page.evaluate(() =>
    window.dataLayer?.filter((entry) => entry.event === "generate_lead") ?? [],
  );
  assert(d2cConversionEvents.length === 1, "D2C conversion event was missing or emitted more than once.");
  assert(d2cConversionEvents[0]?.growth_path === "d2c_growth", "D2C conversion event has the wrong growth path.");
  assert(typeof d2cConversionEvents[0]?.event_id === "string", "D2C conversion event is missing its opaque event ID.");
  await page.screenshot({ path: path.join(outputDir, "thank-you-d2c.png"), fullPage: false });

  // Submit a fresh lead through the other branch so both server-side validation
  // paths, persistence, and thank-you redirects are exercised.
  await page.goto(`${baseUrl}/contact`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /Get more enquiries/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  assert((await page.locator(".step-count").textContent())?.trim() === "02 / 06", "Lead Generation progress does not use the six-question visible path.");
  await page.getByRole("radio", { name: /Both B2B and B2C/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Gujarat/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /worked with an agency/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Enter your full name").fill(leadGenerationName);
  await page.getByRole("button", { name: "Continue" }).click();
  const leadPhone = "9876543211";
  await page.getByPlaceholder("Enter your WhatsApp number").fill(leadPhone);
  await page.locator(".consent-row input").check();

  const leadResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/leads") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Send my details/ }).click();
  const leadResponse = await leadResponsePromise;
  const leadResult = await leadResponse.json();
  rememberCreatedLead(leadResult);
  assert(leadResponse.status() === 201 && leadResult.ok, `Lead Generation submission failed with ${leadResponse.status()}.`);

  const leadAnswers = leadResponse.request().postDataJSON()?.answers ?? {};
  assert(leadAnswers.growth_path === "lead_generation", "Lead Generation submission has the wrong growth path.");
  assert(
    JSON.stringify(Object.keys(leadAnswers).sort()) === JSON.stringify([
      "full_name",
      "growth_path",
      "lead_business_model",
      "lead_campaign_experience",
      "lead_target_location",
      "phone",
    ]),
    "Lead Generation submission omitted a visible answer or included a hidden D2C answer.",
  );

  await page.waitForURL(`${baseUrl}/thank-you`, { timeout: 15000 });
  assertThankYouUrl(page.url(), leadGenerationName, leadPhone);
  await page.getByRole("heading", { name: "Your Details Have Been Received!" }).waitFor();
  await page.waitForFunction(() => window.dataLayer?.some((entry) => entry.event === "generate_lead"));
  const leadConversionEvents = await page.evaluate(() =>
    window.dataLayer?.filter((entry) => entry.event === "generate_lead") ?? [],
  );
  assert(leadConversionEvents.length === 1, "Lead Generation conversion event was missing or emitted more than once.");
  assert(leadConversionEvents[0]?.growth_path === "lead_generation", "Lead Generation conversion event has the wrong growth path.");
  await page.screenshot({ path: path.join(outputDir, "thank-you-lead-generation.png"), fullPage: false });

  // The SEO path branches a second time, into its own Lead Generation and D2C
  // tracks. Start on the D2C track, answer a track-only question, then switch:
  // that stale answer must be pruned before submission, the same way a stale
  // path answer is.
  await page.goto(`${baseUrl}/contact`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /Rank higher on Google/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  assert(await page.getByRole("heading", { name: /What would you like SEO to help you achieve/ }).isVisible(), "SEO branch did not open on its goal question.");
  assert((await page.locator(".step-count").textContent())?.trim() === "02 / 08", "SEO progress does not use the eight-question visible path.");
  await page.getByRole("radio", { name: /Increase online sales/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder(/yourbusiness\.com/).fill("https://qa-seo.example");
  await page.getByRole("button", { name: "Continue" }).click();
  assert(await page.getByRole("heading", { name: /average monthly online sales/ }).isVisible(), "SEO D2C track did not open.");
  await page.getByRole("radio", { name: /^₹1–5 lakh/ }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("radio", { name: /Generate more leads/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  assert(await page.getByRole("heading", { name: /Where do you want to attract customers from/ }).isVisible(), "SEO Lead Generation track did not open after switching tracks.");
  await page.getByRole("radio", { name: /Multiple cities/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /we are currently doing SEO/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /₹25,000–₹50,000/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Enter your full name").fill(seoName);
  await page.getByRole("button", { name: "Continue" }).click();
  const seoPhone = "9876543212";
  await page.getByPlaceholder("Enter your WhatsApp number").fill(seoPhone);
  await page.locator(".consent-row input").check();

  const seoResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/leads") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Send my details/ }).click();
  const seoResponse = await seoResponsePromise;
  const seoResult = await seoResponse.json();
  rememberCreatedLead(seoResult);
  assert(seoResponse.status() === 201 && seoResult.ok, `SEO submission failed with ${seoResponse.status()}.`);

  const seoAnswers = seoResponse.request().postDataJSON()?.answers ?? {};
  assert(seoAnswers.growth_path === "seo", "SEO submission has the wrong growth path.");
  assert(seoAnswers.seo_goal === "lead_generation", "SEO submission has the wrong goal.");
  assert(
    JSON.stringify(Object.keys(seoAnswers).sort()) === JSON.stringify([
      "full_name",
      "growth_path",
      "phone",
      "seo_experience",
      "seo_goal",
      "seo_lead_target_location",
      "seo_monthly_budget",
      "seo_website_url",
    ]),
    "SEO submission kept an answer from the abandoned D2C track or omitted a visible answer.",
  );

  await page.waitForURL(`${baseUrl}/thank-you`, { timeout: 15000 });
  assertThankYouUrl(page.url(), seoName, seoPhone);
  await page.getByRole("heading", { name: "Your Details Have Been Received!" }).waitFor();
  await page.waitForFunction(() => window.dataLayer?.some((entry) => entry.event === "generate_lead"));
  const seoConversionEvents = await page.evaluate(() =>
    window.dataLayer?.filter((entry) => entry.event === "generate_lead") ?? [],
  );
  assert(seoConversionEvents.length === 1, "SEO conversion event was missing or emitted more than once.");
  assert(seoConversionEvents[0]?.growth_path === "seo", "SEO conversion event has the wrong growth path.");
  await page.screenshot({ path: path.join(outputDir, "thank-you-seo.png"), fullPage: false });

  await page.goto(`${baseUrl}/${adminSlug}/login`, { waitUntil: "networkidle" });
  await page.locator("#admin-email").fill(process.env.ADMIN_EMAIL);
  await page.locator("#admin-password").fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Open lead desk/ }).click();
  await page.waitForURL(`${baseUrl}/${adminSlug}`, { timeout: 15000 });
  await page.getByRole("heading", { name: "Lead pulse" }).waitFor();
  assert(await page.getByText(leadGenerationName, { exact: true }).isVisible(), "Lead Generation submission did not appear in the dashboard.");
  assert(await page.getByText(d2cGrowthName, { exact: true }).isVisible(), "D2C submission did not appear in the dashboard.");
  assert(await page.getByText(seoName, { exact: true }).isVisible(), "SEO submission did not appear in the dashboard.");
  await page.screenshot({ path: path.join(outputDir, "admin-dashboard.png"), fullPage: true });

  await page.getByRole("link", { name: `View ${leadGenerationName}` }).click();
  await page.waitForURL(new RegExp(`/${adminSlug}/leads/${leadResult.leadId}$`));
  await page.locator(".lead-status-select").selectOption("qualified");
  await page.getByLabel("Add an internal note").fill("Automated QA note: lead update works.");
  await page.getByRole("button", { name: /Save note/ }).click();
  await page.getByText(/lead update works/).waitFor();

  await page.goto(`${baseUrl}/${adminSlug}/questionnaire`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Questionnaire" }).waitFor();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByLabel("Question key").fill("qa_temporary_question");
  const questionTextArea = page.locator(".editor-copy-fields label").filter({ hasText: "Question text" }).locator("textarea");
  assert((await questionTextArea.count()) === 1, "Question text editor was not unique.");
  await questionTextArea.fill("QA temporary question");
  await page.getByRole("button", { name: /Save to draft/ }).click();
  await page.locator(".question-editor").waitFor({ state: "detached" });
  const tempRow = page.locator(".builder-row").filter({ hasText: "QA temporary question" });
  await tempRow.waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await tempRow.getByRole("button", { name: "Delete question" }).click();
  await page.getByText("Question deleted from the draft.").waitFor();
  await page.screenshot({ path: path.join(outputDir, "admin-questionnaire.png"), fullPage: true });

  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  watchPage(mobile, "mobile");
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "390px page has horizontal overflow.");
  const mobileOrder = await mobile.evaluate(() => {
    const form = document.querySelector(".form-column")?.getBoundingClientRect().top ?? 9999;
    const copy = document.querySelector(".hero-copy")?.getBoundingClientRect().top ?? 9999;
    return { form, copy };
  });
  assert(mobileOrder.form < mobileOrder.copy, "Mobile form is not placed before the long hero copy.");
  assert(await mobile.evaluate(() => {
    const header = document.querySelector(".site-header")?.getBoundingClientRect();
    const logo = document.querySelector(".brand-link img")?.getBoundingClientRect();
    return Boolean(header && logo && logo.top >= header.top && logo.bottom <= header.bottom);
  }), "Mobile logo is clipped by the navbar.");
  await mobile.screenshot({ path: path.join(outputDir, "landing-header-mobile.png"), fullPage: false });
  await mobile.screenshot({ path: path.join(outputDir, "landing-mobile-390.png"), fullPage: true });
  await mobileContext.close();

  const narrowContext = await browser.newContext({ viewport: { width: 320, height: 740 }, deviceScaleFactor: 1 });
  const narrow = await narrowContext.newPage();
  watchPage(narrow, "narrow");
  await narrow.goto(baseUrl, { waitUntil: "networkidle" });
  assert(await narrow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "320px page has horizontal overflow.");
  await narrowContext.close();

  assert(errors.length === 0, `Browser errors:\n${errors.join("\n")}`);
  console.log("Browser QA passed: both questionnaire branches, branch-switch pruning, private thank-you redirects, Neon persistence, admin login, lead updates, builder CRUD, and 1440/390/320 layouts.");
  console.log(`Screenshots: ${outputDir}`);
} finally {
  await browser.close();

  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (sql) {
    for (const leadId of createdLeadIds) {
      await sql.query(`DELETE FROM leads WHERE id = $1`, [leadId]);
    }
    await sql.query(
      `DELETE FROM questions
       WHERE question_key = 'qa_temporary_question'
         AND version_id IN (SELECT id FROM form_versions WHERE status = 'draft')`,
    );
  }
}
