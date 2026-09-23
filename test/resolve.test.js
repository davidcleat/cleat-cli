import assert from "node:assert/strict";
import test from "node:test";
import { resolveLineId } from "../src/commands.js";
import { LINE, RELEASED_LINE, SECOND_LINE, fakeClient } from "./fake.js";

test("a uuid is used as-is, without spending a request", async () => {
  const client = fakeClient();

  assert.equal(await resolveLineId(client, LINE.id), LINE.id);
  assert.equal(client.calls.listLines, 0);
});

test("a phone number matches with or without a plus, and with or without the country code", async () => {
  for (const wanted of ["+13055550100", "13055550100", "3055550100", "(305) 555-0100"]) {
    assert.equal(await resolveLineId(fakeClient({ lines: [LINE, SECOND_LINE] }), wanted), LINE.id, wanted);
  }
});

test("a label matches, ignoring case", async () => {
  assert.equal(await resolveLineId(fakeClient({ lines: [LINE, SECOND_LINE] }), "staging SIGN-UPS"), LINE.id);
});

test("with exactly one active line, --line can be left out", async () => {
  assert.equal(await resolveLineId(fakeClient({ lines: [LINE, RELEASED_LINE] }), undefined), LINE.id);
});

test("with several active lines, leaving --line out is an error that names one", async () => {
  await assert.rejects(
    () => resolveLineId(fakeClient({ lines: [LINE, SECOND_LINE] }), undefined),
    (err) => {
      assert.match(err.message, /2 active lines/);
      assert.match(err.message, /--line/);
      return true;
    },
  );
});

test("with no active line at all, the error points at where to get one", async () => {
  await assert.rejects(
    () => resolveLineId(fakeClient({ lines: [RELEASED_LINE] }), undefined),
    /No active line in this workspace/,
  );
});

test("something that matches nothing is an error that suggests cleat lines", async () => {
  await assert.rejects(() => resolveLineId(fakeClient({ lines: [LINE] }), "13105559999"), /Run "cleat lines"/);
});
