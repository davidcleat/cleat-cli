import assert from "node:assert/strict";
import test from "node:test";
import { EXIT, main } from "../src/cli.js";
import { CHATTY_MESSAGE, LINE, MESSAGE, RELEASED_LINE, SECOND_LINE, capture, fakeClient, timeoutError } from "./fake.js";

/** Run the CLI with a fake client and a key in the environment. */
async function run(argv, setup = {}, extra = {}) {
  const io = capture();
  const client = setup.client ?? fakeClient(setup);
  const code = await main(argv, {
    client,
    out: io.out,
    err: io.err,
    env: { CLEAT_API_KEY: "clt_test_key_not_a_real_key" },
    sleep: async () => {},
    ...extra,
  });
  return { code, client, stdout: io.stdout, stderr: io.stderr };
}

test("cleat with no command prints usage and exits 2", async () => {
  const { code, stdout } = await run([]);

  assert.equal(code, EXIT.USAGE);
  assert.match(stdout.join("\n"), /Usage:/);
});

test("--help exits 0 and mentions every command", async () => {
  const { code, stdout } = await run(["--help"]);

  assert.equal(code, EXIT.OK);
  const text = stdout.join("\n");
  for (const command of ["cleat lines", "cleat codes", "cleat wait"]) {
    assert.match(text, new RegExp(command.replace(" ", "\\s+")));
  }
});

test("an unknown command exits 2 and says which one", async () => {
  const { code, stderr } = await run(["send"]);

  assert.equal(code, EXIT.USAGE);
  assert.match(stderr.join("\n"), /Unknown command "send"/);
});

test("an unknown flag exits 2", async () => {
  const { code } = await run(["lines", "--colour"]);

  assert.equal(code, EXIT.USAGE);
});

test("a missing CLEAT_API_KEY is reported before anything is attempted", async () => {
  const io = capture();

  const code = await main(["lines"], { out: io.out, err: io.err, env: {} });

  assert.equal(code, EXIT.ERROR);
  assert.match(io.stderr.join("\n"), /CLEAT_API_KEY/);
  assert.match(io.stderr.join("\n"), /workspace settings/);
});

test("cleat lines prints a table with the phone, status, label and id", async () => {
  const { code, stdout } = await run(["lines"], { lines: [LINE, SECOND_LINE, RELEASED_LINE] });

  assert.equal(code, EXIT.OK);
  assert.match(stdout[0], /PHONE\s+STATUS\s+LABEL\s+ID/);
  assert.match(stdout[1], /\+13055550100\s+active\s+Staging sign-ups\s+8f14e45f/);
  // A line with no label shows a dash rather than the word "null".
  assert.match(stdout[2], /\+13055550142\s+active\s+-\s+0a1b2c3d/);
  // Released lines are still listed, so an id in your records still resolves.
  assert.match(stdout[3], /released/);
});

test("cleat lines --json prints the API objects unchanged", async () => {
  const { code, stdout } = await run(["lines", "--json"], { lines: [LINE] });

  assert.equal(code, EXIT.OK);
  assert.deepEqual(JSON.parse(stdout.join("\n")), [LINE]);
});

test("an empty workspace says so instead of printing an empty table", async () => {
  const { stdout } = await run(["lines"], { lines: [] });

  assert.match(stdout.join("\n"), /No lines in this workspace/);
});

test("cleat codes lists recent messages and folds a multi-line text onto one line", async () => {
  const { code, stdout } = await run(["codes", "--line", LINE.id], { messages: [MESSAGE, CHATTY_MESSAGE] });

  assert.equal(code, EXIT.OK);
  assert.equal(stdout[0], "2026-09-11T10:02:41.000Z  Facebook  704118");
  // No code found, so the body is shown, with its newlines collapsed.
  assert.equal(stdout[1], "2026-09-11T10:01:00.000Z  +13105550142  Hey, are we still on for Thursday?");
});

test("cleat codes --json prints an array, and with --follow one object per line", async () => {
  const listed = await run(["codes", "--line", LINE.id, "--json"], { messages: [MESSAGE, CHATTY_MESSAGE] });
  assert.equal(JSON.parse(listed.stdout.join("\n")).length, 2);

  // --follow never returns, so stop it from the sleep between polls.
  const io = capture();
  const client = fakeClient({ messages: [MESSAGE] });
  let polls = 0;
  const code = await main(["codes", "--line", LINE.id, "--json", "--follow"], {
    client,
    out: io.out,
    err: io.err,
    env: { CLEAT_API_KEY: "clt_test_key_not_a_real_key" },
    sleep: async () => {
      if (++polls >= 2) throw new Error("stopped by the test");
    },
  });
  assert.equal(code, EXIT.ERROR);

  assert.ok(io.stdout.length >= 2);
  for (const line of io.stdout) assert.equal(JSON.parse(line).id, MESSAGE.id);
  // Nothing chatty on stdout in --json mode, so the stream stays parseable.
  assert.equal(io.stdout.every((line) => line.startsWith("{")), true);
});

test("--follow walks the cursor forward from the newest receivedAt", async () => {
  const io = capture();
  const client = fakeClient({ messages: [MESSAGE] });
  let polls = 0;
  await main(["codes", "--line", LINE.id, "--follow"], {
    client,
    out: io.out,
    err: io.err,
    env: { CLEAT_API_KEY: "clt_test_key_not_a_real_key" },
    sleep: async () => {
      if (++polls >= 2) throw new Error("stopped by the test");
    },
  });

  assert.equal(client.calls.listMessages[1].options.after, MESSAGE.receivedAt);
});

test("--limit is validated against the API's 1..200 before a request is made", async () => {
  for (const bad of ["0", "201", "half"]) {
    const { code, stderr, client } = await run(["codes", "--limit", bad]);
    assert.equal(code, EXIT.USAGE, `--limit ${bad} should be a usage error`);
    assert.match(stderr.join("\n"), /--limit must be a whole number from 1 to 200/);
    assert.equal(client.calls.listMessages.length, 0);
  }

  const ok = await run(["codes", "--line", LINE.id, "--limit", "200"]);
  assert.equal(ok.code, EXIT.OK);
  assert.equal(ok.client.calls.listMessages[0].options.limit, 200);
});

test("cleat wait prints only the code on stdout, so it can be piped", async () => {
  const { code, stdout, stderr } = await run(["wait", "--line", LINE.id]);

  assert.equal(code, EXIT.OK);
  assert.deepEqual(stdout, ["704118"]);
  // The progress note goes to stderr, where it cannot pollute the captured value.
  assert.match(stderr.join("\n"), /Waiting up to 120s/);
});

test("cleat wait --timeout is passed through in milliseconds", async () => {
  const { client } = await run(["wait", "--line", LINE.id, "--timeout", "45"]);

  assert.equal(client.calls.waitForMessage[0].options.timeoutMs, 45000);
});

test("cleat wait exits 124 on timeout and says so on stderr, not stdout", async () => {
  const { code, stdout, stderr } = await run(["wait", "--line", LINE.id, "--timeout", "30"], {
    waitError: timeoutError(30000),
  });

  assert.equal(code, 124);
  assert.equal(code, EXIT.TIMEOUT);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join("\n"), /No matching code/);
});

test("cleat wait --json prints the whole message", async () => {
  const { code, stdout } = await run(["wait", "--line", LINE.id, "--json"]);

  assert.equal(code, EXIT.OK);
  assert.deepEqual(JSON.parse(stdout.join("\n")), MESSAGE);
});

test("--from and --service are handed to the client", async () => {
  const { client } = await run(["wait", "--line", LINE.id, "--from", "32665", "--service", "facebook"]);

  assert.equal(client.calls.waitForMessage[0].options.from, "32665");
  assert.equal(client.calls.waitForMessage[0].options.service, "facebook");
});

test("--timeout must be a positive number", async () => {
  for (const bad of ["0", "-5", "soon"]) {
    const { code } = await run(["wait", "--timeout", bad]);
    assert.equal(code, EXIT.USAGE, `--timeout ${bad} should be a usage error`);
  }
});

test("an API error is reported as a sentence with its status, and exits 1", async () => {
  const failing = {
    async listLines() {
      const err = new Error("This API key has expired.");
      err.status = 401;
      err.code = "key_expired";
      throw err;
    },
  };
  const { code, stderr } = await run(["lines"], { client: failing });

  assert.equal(code, EXIT.ERROR);
  assert.equal(stderr.join("\n"), "This API key has expired. (HTTP 401)");
});
