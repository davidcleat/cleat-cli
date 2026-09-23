/** A stand-in for CleatClient. No network, no waiting. */
import { CleatTimeoutError } from "cleat-js";

export const LINE = {
  id: "8f14e45f-ceea-4b6b-9d3c-2a1f0e7c5b10",
  phone: "13055550100",
  label: "Staging sign-ups",
  status: "active",
  createdAt: "2026-09-11T10:00:00.000Z",
};

export const SECOND_LINE = {
  id: "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9",
  phone: "13055550142",
  label: null,
  status: "active",
  createdAt: "2026-09-10T09:00:00.000Z",
};

export const RELEASED_LINE = { ...SECOND_LINE, id: "5f6e7d8c-9b0a-4132-8445-566778899aab", status: "released" };

export const MESSAGE = {
  id: "c9a7e0d2-5b1f-4e8a-9f3c-6d2b1a0e4f77",
  line: { id: LINE.id, phone: LINE.phone, label: LINE.label },
  from: "32665",
  body: "704118 is your Facebook confirmation code",
  code: "704118",
  receivedAt: "2026-09-11T10:02:41.000Z",
  service: { id: "facebook", name: "Facebook", color: "#0866FF" },
  contact: null,
  label: "Facebook",
};

export const CHATTY_MESSAGE = {
  id: "1b0c4d5e-6f70-4812-93a4-b5c6d7e8f901",
  line: { id: LINE.id, phone: LINE.phone, label: LINE.label },
  from: "+13105550142",
  body: "Hey,\nare we still\non for Thursday?",
  code: null,
  receivedAt: "2026-09-11T10:01:00.000Z",
  service: null,
  contact: null,
  label: null,
};

/**
 * @param {{ lines?: unknown[], messages?: unknown[], waitResult?: unknown, waitError?: Error }} setup
 */
export function fakeClient(setup = {}) {
  const calls = { listLines: 0, listMessages: [], waitForMessage: [] };
  return {
    calls,
    async listLines() {
      calls.listLines += 1;
      return setup.lines ?? [LINE];
    },
    async listMessages(lineId, options = {}) {
      calls.listMessages.push({ lineId, options });
      return setup.messages ?? [];
    },
    async waitForMessage(lineId, options = {}) {
      calls.waitForMessage.push({ lineId, options });
      if (setup.waitError) throw setup.waitError;
      return setup.waitResult ?? MESSAGE;
    },
  };
}

/** Collect stdout and stderr as arrays of lines. */
export function capture() {
  const stdout = [];
  const stderr = [];
  return { stdout, stderr, out: (line) => stdout.push(line), err: (line) => stderr.push(line) };
}

export const timeoutError = (ms = 120000) =>
  new CleatTimeoutError(`No matching code on line ${LINE.id} within ${ms}ms. Nothing was charged and the line is still listening.`);
