import XlsxPopulate from "xlsx-populate";

/**
 * Turns rows of values into a password-protected .xlsx file.
 *
 * Two reasons this is a real Excel file rather than the CSV it replaces:
 *
 * 1. A .csv opens in whatever the machine has associated with it - often a
 *    text editor. A .xlsx opens in Excel, which is where this belongs.
 * 2. Office Open XML has a documented encryption format, so the file itself
 *    is AES-encrypted and Excel prompts for the password when it is opened.
 *    A plain CSV was readable by anyone who got hold of it; this is not.
 *
 * Values are written with `.value()`, never `.formula()`, so a cell beginning
 * with `=` or `+` is stored as text. A phone number reads as a phone number,
 * and a malicious answer cannot smuggle a formula into whoever opens the file.
 */
export async function toEncryptedXlsx(
  rows: (string | number | null)[][],
  password: string,
): Promise<Buffer> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const sheet = workbook.sheet(0);
  sheet.name("Leads");
  sheet.cell("A1").value(rows);

  const columnCount = rows[0]?.length ?? 0;
  if (columnCount > 0) {
    const lastColumn = String.fromCharCode("A".charCodeAt(0) + columnCount - 1);
    sheet.range(`A1:${lastColumn}1`).style("bold", true);
    // Leave the header visible while scrolling a long export.
    sheet.freezePanes(0, 1);
  }

  for (const [index, width] of [30, 20, 22, 18, 26, 16, 12, 14, 14, 30, 40].entries()) {
    if (index >= columnCount) break;
    sheet.column(String.fromCharCode("A".charCodeAt(0) + index)).width(width);
  }

  return workbook.outputAsync({ password });
}
