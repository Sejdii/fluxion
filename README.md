# Fluxion

Fluxion measures whether a software team is getting faster, by showing trends in how pull requests move through review. It reads merged pull requests from GitHub through the `gh` CLI. Terms are defined in [GLOSSARY.md](GLOSSARY.md).

Status: early. Three metrics work so far: `fluxion pr prsMerged total monthly`, and `fluxion pr reviewWaitingTime|totalReviewTime median|p90 monthly` (hours; periods with fewer than 5 merged PRs flag the median as `low n` and show no p90).

## Setup

Requirements: Node.js 26+, [pnpm](https://pnpm.io) 12, [git](https://git-scm.com) and the [GitHub CLI](https://cli.github.com) (`gh`).

```bash
gh auth login        # once
git clone https://github.com/Sejdii/fluxion.git
cd fluxion
pnpm install
```

## Link the command

Fluxion analyses the git repository you run it in, so you need to call it from other repositories. Link it globally:

```bash
pnpm setup                                 # once; adds pnpm's global bin directory to PATH
pnpm add --global link:./packages/cli      # run from the clone
fluxion --help
```

Open a new shell after `pnpm setup`. The link points at your clone, so edits take effect immediately. (`pnpm link --global` no longer exists in recent pnpm versions.) To remove it: `pnpm remove --global @fluxion/cli`. Inside the clone you can also use `pnpm fluxion <args>`.

## Usage

Run it inside a repository that has a GitHub remote:

```bash
fluxion pr prsMerged total monthly
```

```text
period   prsMerged  n
2026-09  0          0
2026-10  4          4
2026-11  1          1
```

Grammar: `fluxion <family> <metric> <statistic> <period>`

| Option | Meaning |
|--------|---------|
| `--since <date>` | First merge date, `YYYY-MM-DD` (default: 90 days ago) |
| `--until <date>` | Last merge date, `YYYY-MM-DD` (default: today) |

- Pull requests are counted by UTC merge date. Months without merged PRs still appear, with `n` = 0.
- `fluxion --help` and `fluxion pr --help` list the available metrics and statistics.
- Results go to stdout and errors to stderr. Exit codes: `0` success, `1` usage mistake, `2` data problem (`gh` missing or not logged in, not a git repository, no GitHub remote).
- GitHub search returns at most 1000 pull requests per query; for larger ranges narrow `--since` and `--until`.

## Development

```bash
pnpm test        # unit and integration tests with coverage
pnpm lint
pnpm typecheck
pnpm gate        # the full quality gate
```

Architecture decisions are in [docs/adr](docs/adr).
