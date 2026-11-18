# Fluxion

Fluxion measures whether a software team is getting faster, by showing trends in how pull requests move through review.

## Pull request lifecycle

**Merged PR**:
A pull request that was merged. It is the only kind of pull request that the v1 metrics describe.
_Avoid_: Closed PR, finished PR

**Ready for review**:
The moment a pull request first becomes open to review: its creation if it was opened as a regular pull request, otherwise the moment it left draft. It is the start of every review duration.
_Avoid_: Opened, created (for durations)

**Human reviewer**:
A person, other than the pull request's author, who comments on or reviews the pull request. Bots are never human reviewers. An account that no longer exists counts as a human.
_Avoid_: Participant, commenter

**First response**:
The first comment or review by a human reviewer after the pull request is ready for review. If there is none, the merge itself counts as the first response.
_Avoid_: First review, first comment

## Metrics

**Review waiting time**:
The time from ready for review to the first response of a merged PR.
_Avoid_: Time to first review, pickup time

**Total review time**:
The time from ready for review to the merge of a merged PR.
_Avoid_: Cycle time, lead time

**PRs merged**:
The number of pull requests merged in a period. It counts by merge date.
_Avoid_: Throughput

**PR size**:
The lines added plus the lines deleted in a merged PR, with no exclusions.
_Avoid_: Diff size, change size

**Comments**:
The number of human comments on a merged PR: issue comments, inline review comments and non-empty review bodies, including the author's replies.
_Avoid_: Discussion size

**Reviewers**:
The number of distinct human reviewers of a merged PR. A person who was asked to review but never responded does not count.
_Avoid_: Participants

## Reading metrics

**Period**:
A UTC calendar bucket (day, ISO week, month or year) that a merged PR belongs to by its merge date.
_Avoid_: Interval, window

**Single value**:
One statistic computed over the whole selected range instead of per period.
_Avoid_: Summary, total (unless it is a count)

**Median**:
The middle value of a set of merged PRs. It is the default statistic for every per-PR measure.
_Avoid_: Average, mean

**P90**:
The value that 90% of merged PRs stay at or below. It shows the slow tail that the median hides.
_Avoid_: Worst case, maximum
