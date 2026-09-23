/** Turning API objects into lines of text. */

/** Pad a column to a width, without touching the last one. */
function pad(value, width) {
  return String(value).padEnd(width, " ");
}

/**
 * A plain aligned table, as an array of rows. No box drawing, so the output stays
 * easy to cut up with `awk` and `cut`.
 */
export function table(headers, rows) {
  const widths = headers.map((header, i) =>
    Math.max(String(header).length, ...rows.map((row) => String(row[i] ?? "").length)),
  );
  const render = (cells) =>
    cells
      .map((cell, i) => (i === cells.length - 1 ? String(cell ?? "") : pad(cell ?? "", widths[i])))
      .join("  ")
      .trimEnd();
  return [render(headers), ...rows.map(render)];
}

/** One row per line of the workspace, as an array of ready-to-print strings. */
export function formatLines(lines) {
  if (lines.length === 0) {
    return ["No lines in this workspace. Subscribe to one at https://cleat.so."];
  }
  return table(
    ["PHONE", "STATUS", "LABEL", "ID"],
    lines.map((line) => [`+${line.phone}`, line.status, line.label ?? "-", line.id]),
  );
}

/**
 * One line per message: when it arrived, who it looks like it is from, then the code
 * if Cleat found one, else the text itself on one line.
 */
export function formatMessage(message) {
  const who = message.label ?? message.from;
  const what = message.code ?? message.body.replace(/\s+/g, " ").trim();
  return [message.receivedAt, who, what].join("  ");
}

/** A short sentence for an error, without a stack trace. */
export function describeError(err) {
  if (!err) return "Unknown error.";
  const status = typeof err.status === "number" ? ` (HTTP ${err.status})` : "";
  return `${err.message}${status}`;
}
