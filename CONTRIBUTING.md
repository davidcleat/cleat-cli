# Contributing

Bug reports and pull requests are welcome.

- The CLI depends on `cleat-js`. Check both repos out side by side and `npm install`; the dependency is a path dependency (`file:../cleat-js`) and `cleat-js` needs `npm run build` once before the CLI can import it.
- `npm test` runs the suite. Every command takes its client, its output writers and its clock as arguments, so the tests use a fake client and never touch the network or sleep. Keep it that way: no test should need an API key.
- Keep the dependency count at one. Argument parsing is `node:util`'s `parseArgs`, not a library.
- `cleat wait` prints the code and nothing else on stdout. Progress and errors belong on stderr. Do not break that: people capture it with `$(...)`.
- Exit codes are a contract: 0 ok, 1 error, 2 bad usage, 124 wait timed out. Do not renumber them.
- Never commit a real API key or a real phone number. Fixtures use obviously fake values.
