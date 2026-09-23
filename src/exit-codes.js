/**
 * Exit codes, so a script can tell "no code arrived" from "your key is wrong".
 * These are part of the CLI's contract; do not renumber them.
 */
export const EXIT = {
  /** It worked. */
  OK: 0,
  /** Something went wrong: an API error, a line that does not exist, a network failure. */
  ERROR: 1,
  /** The command line itself was wrong. Usage was printed. */
  USAGE: 2,
  /** `cleat wait` reached its timeout with no matching code. Same code as GNU `timeout`. */
  TIMEOUT: 124,
};
