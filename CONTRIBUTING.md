# Contributing

Bug reports and pull requests are welcome.

- The CLI depends on `cleatapi`, pinned to its GitHub repository over https. `npm install` fetches and builds it; nothing needs checking out beside this repo, and the lockfile is deliberately not committed because npm rewrites that dependency to `git+ssh`.
- `npm test` runs the suite. Every command takes its client, its output writers and its clock as arguments, so the tests use a fake client and never touch the network or sleep. Keep it that way: no test should need an API key.
- Keep the dependency count at one. Argument parsing is `node:util`'s `parseArgs`, not a library.
- `cleat wait` prints the code and nothing else on stdout. Progress and errors belong on stderr. Do not break that: people capture it with `$(...)`.
- Exit codes are a contract: 0 ok, 1 error, 2 bad usage, 124 wait timed out. Do not renumber them.
- Never commit a real API key or a real phone number. Fixtures use obviously fake values.
