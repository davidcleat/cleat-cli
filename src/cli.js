/**
 * Argument parsing and dispatch for `npx cleat`.
 *
 * Nothing here talks to the network directly: `main` builds a CleatClient and hands it
 * to a command, and every seam a test needs (the client, stdout, stderr, sleep) can be
 * replaced through the second argument.
 */
import { parseArgs } from "node:util";
import { CleatClient, CleatError } from "cleatapi";
import { codesCommand, linesCommand, waitCommand } from "./commands.js";
import { EXIT } from "./exit-codes.js";
import { describeError } from "./format.js";

const USAGE = `cleat — read the texts and codes that arrive on your own Cleat lines.

Usage:
  cleat lines [--json]
  cleat codes [--line <id|phone|label>] [--limit <n>] [--follow] [--since <iso>] [--json]
  cleat wait  [--line <id|phone|label>] [--timeout <seconds>] [--from <sender>]
              [--service <name>] [--since <iso>] [--json]

Commands:
  lines   The lines in your workspace, newest first.
  codes   Recent messages on one line. With --follow, print them as they arrive.
  wait    Block until a code arrives, print just the code, exit 124 on timeout.

Options:
  --line     Which line: its id, its phone number, or its label. With one active
             line in the workspace you can leave this out.
  --limit    How many messages to list, 1 to 200. Default 50 (the API's default).
  --follow   Keep polling and print each message as it arrives.
  --since    Only messages after this ISO 8601 moment. Default: now.
  --timeout  Seconds to wait. Default 120.
  --from     Only match this sender, e.g. a short code or a number.
  --service  Only match this service, by its id or name, e.g. facebook.
  --json     Machine-readable output. With --follow, one JSON object per line.
  --help     This text.
  --version  Print the version.

The API key comes from CLEAT_API_KEY. Create one in Cleat workspace settings; it
starts with clt_. CLEAT_BASE_URL points the CLI somewhere else, for development.

Exit codes: 0 ok, 1 error, 2 bad usage, 124 wait timed out.

Docs: https://cleat.so/for/developers`;

const VERSION = "0.1.0";

const OPTIONS = {
  line: { type: "string" },
  limit: { type: "string" },
  follow: { type: "boolean", default: false },
  since: { type: "string" },
  timeout: { type: "string" },
  from: { type: "string" },
  service: { type: "string" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false, short: "h" },
  version: { type: "boolean", default: false },
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run the CLI and resolve with the exit code. It never throws and never calls
 * process.exit itself, which is what makes it testable.
 *
 * @param {string[]} argv
 * @param {{
 *   client?: unknown,
 *   out?: (line: string) => void,
 *   err?: (line: string) => void,
 *   env?: Record<string, string | undefined>,
 *   sleep?: (ms: number) => Promise<void>,
 * }} [deps]
 * @returns {Promise<number>}
 */
export async function main(argv, deps = {}) {
  const out = deps.out ?? ((line) => process.stdout.write(`${line}\n`));
  const err = deps.err ?? ((line) => process.stderr.write(`${line}\n`));
  const env = deps.env ?? process.env;
  const sleep = deps.sleep ?? defaultSleep;

  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    err(error.message);
    err("");
    err(USAGE);
    return EXIT.USAGE;
  }

  const { values, positionals } = parsed;

  if (values.version) {
    out(VERSION);
    return EXIT.OK;
  }
  if (values.help || positionals.length === 0) {
    out(USAGE);
    return values.help ? EXIT.OK : EXIT.USAGE;
  }

  const [command, ...rest] = positionals;
  if (rest.length > 0) {
    err(`Unexpected argument "${rest[0]}".`);
    err("");
    err(USAGE);
    return EXIT.USAGE;
  }

  const limit = values.limit === undefined ? undefined : Number(values.limit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 200)) {
    err("--limit must be a whole number from 1 to 200.");
    return EXIT.USAGE;
  }

  const timeoutSeconds = values.timeout === undefined ? 120 : Number(values.timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    err("--timeout must be a number of seconds greater than zero.");
    return EXIT.USAGE;
  }

  let client = deps.client;
  if (!client) {
    if (!env.CLEAT_API_KEY) {
      err("No CLEAT_API_KEY in the environment.");
      err("Create an API key in Cleat workspace settings, then: export CLEAT_API_KEY=clt_...");
      return EXIT.ERROR;
    }
    client = new CleatClient({
      apiKey: env.CLEAT_API_KEY,
      // Point the CLI at a stub while you develop against it. Unset in normal use.
      ...(env.CLEAT_BASE_URL && { baseUrl: env.CLEAT_BASE_URL }),
    });
  }

  const shared = { client, out, err, json: values.json, line: values.line, sleep };

  try {
    switch (command) {
      case "lines":
        return await linesCommand(shared);
      case "codes":
        return await codesCommand({
          ...shared,
          ...(limit !== undefined && { limit }),
          follow: values.follow,
          ...(values.since !== undefined && { since: values.since }),
        });
      case "wait":
        return await waitCommand({
          ...shared,
          timeoutSeconds,
          ...(values.from !== undefined && { from: values.from }),
          ...(values.service !== undefined && { service: values.service }),
          ...(values.since !== undefined && { since: values.since }),
        });
      default:
        err(`Unknown command "${command}".`);
        err("");
        err(USAGE);
        return EXIT.USAGE;
    }
  } catch (error) {
    err(describeError(error));
    // A CleatError already says what to do about it; anything else may be a real bug.
    if (!(error instanceof CleatError) && !(error instanceof Error && error.message)) {
      err(String(error));
    }
    return EXIT.ERROR;
  }
}

export { EXIT, USAGE };
