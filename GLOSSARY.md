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

**Work schedule**:
The working weekdays, the daily working hours and the time zone they are read in. It is optional: without one, review durations count every hour of the clock. It applies to every pooled repository of a query. For now it is set on the `metric` command only; the dashboard does not use it yet.
_Avoid_: Business hours, office hours, calendar

**Working time**:
The part of a review duration that falls inside the work schedule. Time outside the working hours or on non-working days is skipped, and an activity outside working time counts as happening at the end of the last working hours before it. Review waiting time and total review time are measured in working time whenever a work schedule is set.
_Avoid_: Business time

**PRs merged**:
The number of pull requests merged in a period. It counts by merge date.
_Avoid_: Throughput

**PR size**:
The lines added plus the lines deleted in a merged PR, with no exclusions.
_Avoid_: Diff size, change size

**Comments**:
The number of human comments on a merged PR: issue comments, inline review comments and non-empty review bodies, including the author's replies. The number of comments in a period is the sum over the merged PRs of that period.
_Avoid_: Discussion size

**Reviewers**:
The number of distinct human reviewers of a merged PR. A person who was asked to review but never responded does not count.
_Avoid_: Participants

## Reading metrics

**Period**:
A UTC calendar bucket (day, ISO week, month or year) that a merged PR belongs to by its merge date.
_Avoid_: Interval, window

**Range**:
The span of dates, from a first day to a last day inclusive, that the dashboard analyses. A range can be chosen as whole calendar years, in which case a current year that has not ended runs only to today.
_Avoid_: Window, date filter

**Low sample**:
A period with fewer than 5 merged PRs. Its median is shown but flagged, and its p90 is not shown, because with so few PRs the p90 is just the largest one.
_Avoid_: Insufficient data, small n

**Single value**:
One statistic computed over the whole selected range instead of per period.
_Avoid_: Summary, total (unless it is a count)

**Median**:
The middle value of a set of merged PRs. It is the default statistic for every per-PR measure.
_Avoid_: Average, mean

**P90**:
The value that 90% of merged PRs stay at or below. It shows the slow tail that the median hides.
_Avoid_: Worst case, maximum

**Previous range**:
The range of the same length that ends the day before the selected range starts. It is the baseline that the change is measured against.
_Avoid_: Previous period (a period is a day, week, month or year bucket), prior window

**Change**:
The percent difference of a statistic between the selected range and the previous range. It is not shown when either range is a low sample or the previous value is zero.
_Avoid_: Trend, delta, growth
