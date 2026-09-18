import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: ".env.local", quiet: true });
const base = process.env.QA_BASE_URL || "http://localhost:3000";
const slug = process.env.QA_ADMIN_SLUG || process.env.ADMIN_URL_SLUGS?.split(",")[0].trim() || "gsm-admin";
const output = path.resolve("artifacts/qa");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const privateResponse = await page.goto(`${base}/${slug}`);
  assert.equal(privateResponse.status(), 200);
  assert.ok(page.url().includes("/login"), "Anonymous users must be redirected to login");
  await page.locator("#admin-email").fill(process.env.ADMIN_EMAIL);
  await page.locator("#admin-password").fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Open lead desk", exact: true }).click();
  await page.waitForURL(`${base}/${slug}`, { timeout: 60000 });
  await page.getByRole("heading", { name: "Lead pulse" }).waitFor();
  await page.getByText("Dashboard ready", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.locator('.dashboard-stats article').count(), 4);
  assert.ok(await page.getByRole("heading", { name: "Which campaigns deliver?" }).isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: path.join(output, "dashboard-desktop.png"), fullPage: true });

  await page.getByLabel("Date range", { exact: true }).selectOption("today");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/range=today/);
  await page.getByText("Dashboard ready", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.getByRole("button", { name: "Hourly", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByText("View chart data", { exact: true }).click();
  assert.equal(await page.locator(".dashboard-data-table tbody tr").count(), 24);
  await page.getByRole("button", { name: "Daily", exact: true }).click();
  assert.equal(await page.locator(".dashboard-data-table tbody tr").count(), 1);

  await page.getByLabel("Date range", { exact: true }).selectOption("custom");
  await page.getByLabel("From", { exact: true }).fill("2026-01-03");
  await page.getByLabel("To", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Apply filters" }).click();
  assert.ok(await page.locator(".dashboard-page [role=alert]").isVisible());
  await page.getByLabel("To", { exact: true }).fill("2026-01-04");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/range=custom/);
  await page.getByText("Dashboard ready", { exact: true }).waitFor({ state: "attached" });
  assert.match(await page.locator(".dashboard-period").innerText(), /3 Jan 2026 to 4 Jan 2026/);
  await page.reload();
  assert.equal(await page.getByLabel("Date range", { exact: true }).inputValue(), "custom");

  const response = await page.goto(`${base}/${slug}?range=7d&source=qa-nonexistent-source&campaign=qa-nonexistent-campaign&status=qualified`);
  assert.equal(response.status(), 200);
  assert.equal(await page.locator(".dashboard-stats article strong").first().innerText(), "0");
  assert.ok(await page.getByText("No leads in this selection", { exact: true }).isVisible());
  assert.equal(await page.getByLabel("Source", { exact: true }).inputValue(), "qa-nonexistent-source");
  await page.screenshot({ path: path.join(output, "dashboard-empty.png"), fullPage: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForURL(`${base}/${slug}`);
  await page.getByText("Dashboard ready", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.getByLabel("Source", { exact: true }).inputValue(), "");
  await page.getByLabel("Date range", { exact: true }).selectOption("custom");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(await page.getByLabel("Date range", { exact: true }).inputValue(), "7d");
  await page.getByRole("button", { name: "Refresh dashboard", exact: true }).click();
  await page.getByText("Dashboard ready", { exact: true }).waitFor({ state: "attached" });

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll(".dashboard-page, .dashboard-page > *, .dashboard-main-charts > *")).filter((element) => element.getBoundingClientRect().right > window.innerWidth).map((element) => element.className));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Overflow at ${width}px: ${overflow.join(", ")}`);
  }
  await page.goto(`${base}/${slug}?range=custom&start=invalid&end=2026-09-18`);
  assert.ok(await page.locator(".dashboard-page [role=alert]").isVisible());
  assert.equal(await page.getByLabel("Date range", { exact: true }).inputValue(), "7d");
  const hidden = await context.request.get(`${base}/admin`);
  assert.equal(hidden.status(), 404);
  assert.deepEqual(errors, [], "Dashboard must not throw browser errors");
  console.log("PASS: authentication, dashboard rendering, presets, chart toggles, custom dates, validation, filter persistence, empty results, reset, responsive layouts, hidden admin route.");
} finally {
  await browser.close();
}
