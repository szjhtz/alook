export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || "").length)),
  );
  const header = headers
    .map((h, i) => h.padEnd(widths[i]))
    .join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  console.log(header);
  console.log(separator);
  rows.forEach((r) =>
    console.log(
      r
        .map((c, i) => (c || "").padEnd(widths[i]))
        .join("  "),
    ),
  );
}

export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
