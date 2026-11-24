/**
 * RFC-4180 field escaping with spreadsheet formula-injection protection.
 * Quotes when the value contains ", comma, or newline, and neutralizes leading
 * =, +, -, @, tab, or CR (which Excel/Sheets would evaluate as a formula) by
 * prefixing a single quote.
 */
export function csvEscape(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV document (CRLF line endings) from headers + rows. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}
