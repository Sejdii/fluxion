# Fluxion

Fluxion measures whether a software team is getting faster, by showing trends in how pull requests move through review. It reads merged pull requests from GitHub through the `gh` CLI. Terms are defined in [GLOSSARY.md](GLOSSARY.md).

Status: early. Six metrics work so far: `fluxion pr prsMerged total <period>`, `fluxion pr prSize|comments|reviewers median|p90 <period>`, and `fluxion pr reviewWaitingTime|totalReviewTime median|p90 <period>` (hours; periods with fewer than 5 merged PRs flag the median as `low n` and show no p90). `fluxion pr explain <number>` shows the facts behind one pull request's values.

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

Periods: `daily`, `weekly` (ISO weeks, starting Monday and labelled by that Monday), `monthly`, `yearly` and `overall` (a single value over the whole range).

| Option | Meaning |
|--------|---------|
| `--since <date>` | First merge date, `YYYY-MM-DD` (default depends on the period, see below) |
| `--until <date>` | Last merge date, `YYYY-MM-DD` (default: today) |
| `--json` | Print JSON with the same rows as the table (never selected automatically, even when piped) |
| `--work-days <days>` | Measure review times in working time on these days: a range (`mon-fri`) or a list (`mon,wed,fri`) |
| `--work-hours <hours>` | Working hours as `HH:MM-HH:MM` |
| `--timezone <zone>` | IANA time zone the working hours are read in, e.g. `Europe/Warsaw` |

- Default range, ending at `--until`: `daily` 30 days, `weekly` 90 days, `monthly` the last 12 months, `yearly` the last 4 years (both counting the current one), `overall` everything.
- Pull requests are counted by UTC merge date. Both bounds are inclusive. Periods without merged PRs still appear, with `n` = 0 (and `-` instead of a value for median and p90).
- The unfinished period is marked `(in progress)` in the table and `"inProgress": true` in JSON.
- Repository selection: inside a git repository it is used; in a plain folder Fluxion scans downward for repositories (stopping at the first `.git`, skipping hidden folders and `node_modules`). `--repos a,b` (or a repeated flag) takes paths relative to the current folder instead.
- Several repositories are pooled: their merged PRs are combined before statistics, so a median is over all PRs, not an average of per-repository medians. If one repository fails, the command fails (exit `2`) and names it on stderr.
- `fluxion --help` and `fluxion pr --help` list the available metrics and statistics.
- Results go to stdout and errors to stderr. Exit codes: `0` success, `1` usage mistake, `2` data problem (`gh` missing or not logged in, no git repositories found, no GitHub remote).
- GitHub search returns at most 1000 pull requests per query; for larger ranges narrow `--since` and `--until`.

### Review time metrics

`reviewWaitingTime` and `totalReviewTime` are measured in **hours** (shown in the column header, rounded to 2 decimals) and support `median` and `p90`:

```bash
fluxion pr reviewWaitingTime median monthly --since 2026-01-01
```

```text
period   reviewWaitingTime (hours)  n
2026-01  18.15                      7
2026-06  0.22                       35
2026-07  3.39 (low n)               4
2026-10  -                          0
```

- The clock starts when the PR is ready for review (creation, or leaving draft); draft time is not counted.
- Waiting time ends at the first comment or review by a human reviewer (not the author, not a bot). A PR with no such response uses its merge as the first response, so its waiting time is its total review time.
- A period with fewer than 5 merged PRs is a low sample: the median is flagged `(low n)` and p90 shows `-`. `-` also means no merged PRs.
- A value of `0` means a response came at the moment the PR became ready.

#### Working time

By default review times count every hour of the clock. Pass any of `--work-days`, `--work-hours` or `--timezone` to measure `reviewWaitingTime` and `totalReviewTime` in working time instead. Missing flags default to Monday–Friday, `09:00-17:00` and this machine's time zone.

```bash
fluxion pr reviewWaitingTime median monthly --work-days mon-fri --work-hours 07:00-18:00 --timezone Europe/Warsaw
```

- Only working hours on working days count. Ready at 18:00 Monday and first comment at 08:00 Tuesday, with hours 07:00–18:00, is 1 hour.
- An activity outside working time counts as happening at the end of the last working hours before it. A PR that becomes ready outside working time starts counting at the next start of working hours.
- A duration with no working time is `0` and stays in the statistics.
- Hours are read in local wall-clock time, so a daylight-saving day can be an hour shorter or longer.
- The table starts with a `working time:` line and `--json` includes `workSchedule`, only when a schedule is set. Size, comments, reviewers and PRs merged are unaffected.
- Invalid input (hours that do not start before they end, an unknown time zone, an empty day list, a malformed time) is a usage error (exit `1`).
- `fluxion pr explain <number>` takes the same three flags (same defaults and validation). It then labels the first-response wait and the review-time values `(working time)`, adds a `working time:` line, and still shows the raw timestamps; `--json` includes `workSchedule` and `firstResponseWorkingHours` only when a schedule is set.
- `fluxion` (the dashboard) takes the same three flags (same defaults and validation, checked at startup) as the schedule it starts with. `/api/pr` accepts `workDays`, `workHours` and `timezone` query parameters that override it, applies the schedule to the selected and the previous range alike, answers an invalid value with a `400`, and echoes `workSchedule` only when one is set.
- The dashboard loads through a job so that a large repository does not hit a gateway timeout. `POST /api/pr/jobs` takes the same query parameters as `/api/pr`. A query that finishes within a second is answered like `/api/pr`; otherwise the answer is `202` with `{ jobId, progress: { fetchedMonths, totalMonths } }`. `GET /api/pr/jobs/<jobId>` answers `202` with the progress while the job runs, then the dashboard or the error, once. Cancel in the loading view stops waiting; the server finishes the fetch, so a retry reuses the months it cached.

### Size, comments and reviewers metrics

`prSize`, `comments` and `reviewers` are per-PR measures that support `median` and `p90`, with the same low-sample rules:

- `prSize` (lines): additions plus deletions, no exclusions.
- `comments`: human issue comments, inline review comments and non-empty review bodies, including the author's replies. Bots are excluded.
- `reviewers`: distinct humans other than the author who commented or submitted a review. People who were only asked to review do not count.
- Only the first 100 comments and reviews, and the first 20 inline review threads (20 comments each), of a PR are read.

### Explaining one pull request

`fluxion pr explain <number>` prints every metric's value for one pull request, with the facts behind them, so you can check a number by hand:

```bash
fluxion pr explain 35
```

```text
pull request #35 (merged)

facts
  ready for review   2026-11-21T15:40:26Z
  first response     2026-11-21T15:49:07Z (the merge)
  merged             2026-11-21T15:49:07Z
  comments counted   0
  reviewers counted  0

values
  prsMerged          1
  reviewWaitingTime  0.14 hours
  totalReviewTime    0.14 hours
  prSize             425 lines
  comments           0
  reviewers          0
```

- `--json` prints the same facts and values as JSON.
- `--repos <path>` picks the repository by relative path. It must resolve to exactly one repository: several (`--repos a,b`, a repeated flag, or a folder that holds several repositories) are a usage error (exit `1`).
- An unmerged pull request prints its facts and `not merged, no values`.
- A pull request number that does not exist in the repository is a data error (exit `2`).

## Development

```bash
pnpm test        # unit and integration tests with coverage
pnpm lint
pnpm typecheck
pnpm gate        # the full quality gate
```

Architecture decisions are in [docs/adr](docs/adr).
