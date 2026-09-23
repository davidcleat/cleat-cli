# cleatapi-cli

A command line tool for your own [Cleat](https://cleat.so) lines: list them, stream the codes that arrive, or block until one does.

```sh
CODE=$(cleat wait --line "Staging sign-ups" --timeout 120)
```

One dependency, [`cleatapi`](https://github.com/davidcleat/cleat-js). Node 20 or newer.

## What Cleat is

Cleat rents ID-verified US mobile numbers that receive SMS and 2FA codes, and transcripts of incoming calls. A line is $24.99 a month or $249.90 a year.

It is **receive-only**: a line cannot send a text, place a call, or reach 911. So this tool only reads — there is no `cleat send`, because there is no send endpoint. A line belongs to one identity-verified owner, and teammates in the same workspace read the same inbox at no extra cost. Codes arrive in a web inbox, by email, on Telegram, by signed webhook, through the REST API, and via an MCP server. This tool uses the REST API.

Cleat is for your own accounts, or your company's: the cloud console, the registrar, the payment processor, and the sign-up and login flows you test in staging.

## Install

```sh
npm install -g cleatapi-cli
cleat lines
```

The package is `cleatapi-cli` and it installs two names for the same command, `cleat` and `cleatapi`. The bare name `cleat` on npm belongs to an unrelated command line tool published in 2015, so `npx cleat` would run that instead of this.

Until the first release lands on npm, run it from this repository:

```sh
npx github:davidcleat/cleat-cli lines
```

## Use it

```sh
export CLEAT_API_KEY=clt_your_key_here

# The lines in your workspace.
cleat lines

# Recent messages on a line.
cleat codes --line 8f14e45f-ceea-4b6b-9d3c-2a1f0e7c5b10

# Print each message as it arrives, until you stop it.
cleat codes --follow

# Block until a code arrives, print just the code.
cleat wait --timeout 120
```

`cleat lines` prints:

```
PHONE          STATUS  LABEL              ID
+13055550100   active  Staging sign-ups   8f14e45f-ceea-4b6b-9d3c-2a1f0e7c5b10
```

### Scripting with it

`cleat wait` writes the code, and only the code, to stdout. Progress notes and errors go to stderr, so capturing the output gives you a clean value:

```sh
if CODE=$(cleat wait --line "Staging sign-ups" --timeout 180); then
  echo "Got $CODE"
else
  echo "Nothing arrived (exit $?)" >&2
fi
```

Exit codes are part of the contract:

| Code | Meaning |
|---|---|
| 0 | It worked |
| 1 | An error: bad key, no such line, network trouble |
| 2 | The command line was wrong. Usage was printed |
| 124 | `cleat wait` timed out with no matching code. The same code GNU `timeout` uses |

`--json` works on every command. With `cleat codes --follow --json` it emits one JSON object per line, which pipes straight into `jq`:

```sh
cleat codes --follow --json | jq -r '.code // .body'
```

### Naming a line

`--line` takes a line id, a phone number, or a label, so you do not have to paste a uuid:

```sh
cleat wait --line 13055550100
cleat wait --line "+1 (305) 555-0100"
cleat wait --line "Staging sign-ups"
```

If the workspace has exactly one active line, you can leave `--line` out entirely.

### All the options

```
cleat lines [--json]
cleat codes [--line <id|phone|label>] [--limit <n>] [--follow] [--since <iso>] [--json]
cleat wait  [--line <id|phone|label>] [--timeout <seconds>] [--from <sender>]
            [--service <name>] [--since <iso>] [--json]
```

| Option | Meaning |
|---|---|
| `--line` | Which line: its id, its phone number, or its label |
| `--limit` | How many messages to list, 1 to 200. The API defaults to 50 |
| `--follow` | Keep polling and print each message as it arrives |
| `--since` | Only messages after this ISO 8601 moment. Default: now |
| `--timeout` | Seconds `cleat wait` will wait. Default 120 |
| `--from` | Only match this sender. Case-insensitive, a leading `+` is optional |
| `--service` | Only match this service, by id or name, e.g. `facebook` |
| `--json` | Machine-readable output |

`cleat wait` only looks at messages that arrive **after** it starts, so a code already in the inbox is not mistaken for a fresh one. Pass `--since` to change that. It polls every 3 seconds, which stays well inside the API's 120 requests a minute.

## How to get an API key

1. Create a Cleat account at [cleat.so](https://cleat.so) and subscribe to a line.
2. Verify your identity once, as the line's owner. Until you do, the line runs and keeps every text it receives, but nothing can be read and this tool will report a `403`.
3. In **workspace settings**, create an API key. It starts with `clt_` and is shown once, so copy it then. Put it in `CLEAT_API_KEY`.

A key belongs to one workspace. You can narrow it when you create it: to named lines, and to a date it stops working — which is what makes a key safe to put in a CI secret. A line outside a key's scope reports "not found", exactly like a line in another workspace, so if `cleat lines` shows fewer lines than you expect, check the key's scope.

## Limits worth knowing

- **Receive-only.** No outbound texts, no outbound calls, no 911.
- **US numbers only.**
- **The owner verifies their identity once.** Nothing can be read before that.
- **One line is one subscription** with one verified owner. Cleat is not built for pools of numbers, load testing, or bulk sign-ups.
- **A call is not live.** An automated call that reads a code out is transcribed and arrives afterwards as an ordinary message: the transcript in the body, the calling number as the sender. Nothing marks it as a call.
- **The code is best effort.** Cleat extracts it for display and it can be missing, in which case `cleat codes` shows the text itself. When the exact characters matter, use `--json` and read `body`.
- **120 requests a minute per key.**
- **Whether a given service accepts the number is up to that service.** Most services that refuse VoIP accept a real mobile line, but nobody can promise you a particular one will.

## Development

```sh
git clone https://github.com/davidcleat/cleat-cli.git
cd cleat-cli && npm install && npm test
```

`npm install` fetches `cleatapi` from its own repository and builds it, so nothing has to be checked out beside this. The lockfile is not committed: npm rewrites a GitHub dependency to `git+ssh`, which fails for anyone without SSH keys on GitHub. Every command takes its client, its output writers and its clock as arguments, so the tests use a fake client: no network, no sleeping, no API key.

`CLEAT_BASE_URL` points the CLI at another host, which is how you drive it against a local stub of the API.

## Links

- [cleat.so](https://cleat.so)
- [cleat.so/for/developers](https://cleat.so/for/developers) — the API reference and the webhook contract
- [`cleatapi`](https://github.com/davidcleat/cleat-js) — the TypeScript client this is built on

## License

MIT. See [LICENSE](./LICENSE).
