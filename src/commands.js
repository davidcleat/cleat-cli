/**
 * The three commands. Each one takes everything it touches as an argument — the client,
 * where to write, the clock — so the tests can run them without a network or a wait.
 */
import { CleatTimeoutError } from "cleat-js";
import { EXIT } from "./exit-codes.js";
import { formatLines, formatMessage } from "./format.js";

/**
 * Resolve what the user typed after `--line` to a line id.
 *
 * A uuid is used as-is. Anything else is matched against the workspace's lines by
 * phone number (with or without a leading `+` or `1`) and by label, so
 * `--line "Staging sign-ups"` works. With no `--line` at all, a workspace with exactly
 * one active line uses that one.
 */
export async function resolveLineId(client, wanted) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (wanted && UUID.test(wanted)) return wanted;

  const lines = await client.listLines();

  if (!wanted) {
    const active = lines.filter((line) => line.status === "active");
    if (active.length === 1) return active[0].id;
    if (active.length === 0) {
      throw new Error("No active line in this workspace. Pass --line, or subscribe to one at https://cleat.so.");
    }
    throw new Error(
      `This workspace has ${active.length} active lines. Say which with --line, e.g. --line ${active[0].id}. Run "cleat lines" to see them.`,
    );
  }

  const digits = wanted.replace(/\D/g, "");
  const match = lines.find(
    (line) =>
      line.phone === digits ||
      line.phone === `1${digits}` ||
      line.label?.toLowerCase() === wanted.toLowerCase(),
  );
  if (!match) {
    throw new Error(`No line in this workspace matches "${wanted}". Run "cleat lines" to see them.`);
  }
  return match.id;
}

/** `cleat lines` */
export async function linesCommand({ client, out, json }) {
  const lines = await client.listLines();
  if (json) out(JSON.stringify(lines, null, 2));
  else for (const row of formatLines(lines)) out(row);
  return EXIT.OK;
}

/**
 * `cleat codes`
 *
 * Without `--follow`, the most recent messages, newest first — the same order the API
 * gives them. With `--follow`, it prints each message as it arrives and does not return;
 * with `--json` that is one JSON object per line, so it can be piped into `jq`.
 */
export async function codesCommand({ client, out, err, json, line, limit, follow, since, sleep, pollMs = 3000 }) {
  const lineId = await resolveLineId(client, line);

  if (!follow) {
    const messages = await client.listMessages(lineId, { limit });
    if (json) out(JSON.stringify(messages, null, 2));
    else if (messages.length === 0) out("No messages on this line yet.");
    else for (const message of messages) out(formatMessage(message));
    return EXIT.OK;
  }

  // `after` returns oldest first, so the last one seen is the next cursor.
  let cursor = since ?? new Date().toISOString();
  if (!json) err(`Following ${lineId} from ${cursor}. Ctrl-C to stop.`);

  for (;;) {
    const batch = await client.listMessages(lineId, { after: cursor, limit: 200 });
    for (const message of batch) {
      out(json ? JSON.stringify(message) : formatMessage(message));
    }
    if (batch.length > 0) cursor = batch[batch.length - 1].receivedAt;
    await sleep(pollMs);
  }
}

/**
 * `cleat wait`
 *
 * Prints the code and nothing else on stdout, so `CODE=$(cleat wait)` works. Progress
 * and errors go to stderr. Exits 124 if the timeout passes with nothing matching.
 */
export async function waitCommand({ client, out, err, json, line, timeoutSeconds, from, service, since, pollMs }) {
  const lineId = await resolveLineId(client, line);
  if (!json) err(`Waiting up to ${timeoutSeconds}s for a code on ${lineId}...`);

  try {
    const message = await client.waitForMessage(lineId, {
      timeoutMs: timeoutSeconds * 1000,
      ...(from !== undefined && { from }),
      ...(service !== undefined && { service }),
      ...(since !== undefined && { since }),
      ...(pollMs !== undefined && { pollMs }),
    });
    // Just the code, on one line, so it can be piped or captured.
    out(json ? JSON.stringify(message, null, 2) : message.code);
    return EXIT.OK;
  } catch (error) {
    if (error instanceof CleatTimeoutError) {
      err(error.message);
      return EXIT.TIMEOUT;
    }
    throw error;
  }
}
