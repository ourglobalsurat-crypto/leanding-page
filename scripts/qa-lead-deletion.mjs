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
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let mode = "error";
  const deletionRequests = [];
  // Never forward a deletion request to the real database. SQL is tested separately
  // against temporary tables by test:lead-deletion -- --database.
  await context.route("**/api/admin/leads", async (route) => {
    assert.equal(route.request().method(), "DELETE");
    const payload = route.request().postDataJSON();
    assert.equal(payload.confirmed, true);
    deletionRequests.push(payload.ids);
    if (mode === "error") return route.fulfill({ status: 503, json: { ok: false, message: "Test failure: no records were removed." } });
    if (mode === "network") return route.abort("failed");
    return route.fulfill({ status: 200, json: { ok: true, deletedIds: payload.ids, deletedCount: payload.ids.length } });
  });
  await page.goto(`${base}/${slug}/leads`);
  await page.locator("#admin-email").fill(process.env.ADMIN_EMAIL);
  await page.locator("#admin-password").fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Open lead desk", exact: true }).click();
  await page.waitForURL(`${base}/${slug}`);
  await page.goto(`${base}/${slug}/leads`);
  const rows = page.locator(".leads-table tbody tr");
  const initialCount = await rows.count();
  assert.ok(initialCount >= 2, "Browser QA needs at least two existing leads for read-only selection testing");
  const detailHref = await rows.first().getByRole("link").getAttribute("href");
  assert.ok(await page.getByRole("button", { name: "Delete selected", exact: true }).isDisabled());
  await rows.first().getByRole("checkbox").check();
  assert.ok(await page.locator("thead input[type=checkbox]").evaluate((input) => input.indeterminate));
  await page.getByRole("button", { name: "Clear selection" }).click();
  await page.locator("thead input[type=checkbox]").check();
  assert.equal(await page.locator("tbody input:checked").count(), initialCount);
  await page.getByRole("button", { name: `Delete selected (${initialCount})`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  assert.match(await dialog.innerText(), new RegExp(`Permanently delete ${initialCount} leads`));
  assert.ok(await dialog.getByRole("button", { name: "Cancel", exact: true }).evaluate((button) => button === document.activeElement));
  await page.screenshot({ path: path.join(output, "lead-delete-confirm-desktop.png"), fullPage: false });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(deletionRequests.length, 0);
  await page.getByRole("button", { name: "Clear selection" }).click();
  await rows.first().locator(".lead-delete-icon").click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal(deletionRequests.length, 0);

  await rows.nth(0).getByRole("checkbox").check();
  await rows.nth(1).getByRole("checkbox").check();
  const expected = [];
  for (const row of [rows.nth(0), rows.nth(1)]) expected.push((await row.getByRole("link").getAttribute("href")).split("/").pop());
  await page.getByRole("button", { name: "Delete selected (2)", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete 2 leads permanently", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await rows.count(), initialCount);
  assert.deepEqual(deletionRequests[0], expected);
  mode = "network";
  await dialog.getByRole("button", { name: "Delete 2 leads permanently", exact: true }).click();
  await page.getByText(/Connection interrupted/).waitFor();
  assert.equal(await rows.count(), initialCount);
  mode = "success";
  await dialog.getByRole("button", { name: "Delete 2 leads permanently", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "2 leads permanently deleted" }).waitFor();
  assert.equal(await rows.count(), initialCount - 2);
  assert.equal(await page.locator("tbody input:checked").count(), 0);
  await page.reload();
  assert.equal(await rows.count(), initialCount, "Mocked deletion must leave actual records untouched");

  await rows.first().getByRole("checkbox").check();
  await page.getByLabel("Filter by status").selectOption("new");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.waitForURL(/status=new/);
  assert.equal(await page.locator("tbody input:checked").count(), 0);
  await page.goto(`${base}${detailHref}`);
  await page.getByRole("button", { name: "Delete lead", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete 1 lead permanently", exact: true }).click();
  await page.waitForURL(`${base}/${slug}/leads`);
  assert.equal(await rows.count(), initialCount);

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await rows.first().locator(".lead-delete-icon").click();
  await page.screenshot({ path: path.join(output, "lead-delete-confirm-mobile.png"), fullPage: false });
  assert.ok(await dialog.evaluate((element) => element.getBoundingClientRect().right <= innerWidth));
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log("PASS: selection, select-all, cancellation, Escape, safe initial focus, API/network errors, bulk success, filter reset, detail deletion redirect, mobile layout. All DELETE requests were intercepted; existing leads were preserved.");
} finally {
  await browser.close();
}
