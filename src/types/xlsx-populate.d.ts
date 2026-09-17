/**
 * Minimal declarations for the small part of xlsx-populate this app uses.
 * The package ships no types and has no @types counterpart, so rather than
 * reaching for `any`, only the calls actually made are described here.
 */
declare module "xlsx-populate" {
  type CellValue = string | number | boolean | null;

  interface Cell {
    value(value: CellValue | CellValue[][]): Cell;
  }

  interface Range {
    style(name: string, value: unknown): Range;
  }

  interface Column {
    width(width: number): Column;
  }

  interface Sheet {
    name(name: string): Sheet;
    cell(address: string): Cell;
    range(address: string): Range;
    column(address: string): Column;
    freezePanes(column: number, row: number): Sheet;
  }

  interface Workbook {
    sheet(index: number): Sheet;
    /** Passing a password produces an AES-encrypted, password-protected file. */
    outputAsync(options?: { password?: string }): Promise<Buffer>;
  }

  const XlsxPopulate: {
    fromBlankAsync(): Promise<Workbook>;
    fromDataAsync(data: Buffer | Uint8Array): Promise<Workbook>;
  };

  export default XlsxPopulate;
}
