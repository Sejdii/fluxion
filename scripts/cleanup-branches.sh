#!/bin/sh
# Delete LOCAL git branches that are:
#   1. merged into the base branch (or have no changes against it), or
#   2. squash/rebase-merged on GitHub: a merged PR exists whose head branch
#      name AND head commit match the local branch exactly (needs `gh`).
#      A branch with extra local commits after the PR head is kept.
# Remote branches are never touched.
#
# Usage: scripts/cleanup-branches.sh [-n] [-b BASE]
#   -n       dry run: only list what would be deleted
#   -b BASE  base branch (default: main)

set -eu

base=main
dry_run=0

while getopts "nb:h" opt; do
  case $opt in
    n) dry_run=1 ;;
    b) base=$OPTARG ;;
    *) echo "Usage: $0 [-n] [-b BASE]" >&2; exit 2 ;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || { echo "Not a git repository" >&2; exit 1; }
git show-ref --verify --quiet "refs/heads/$base" || { echo "Base branch '$base' not found" >&2; exit 1; }

current=$(git symbolic-ref --short -q HEAD || true)

# Branches checked out in any worktree cannot be deleted; skip them.
checked_out=$(git worktree list --porcelain | sed -n 's|^branch refs/heads/||p')

# "<head sha> <branch>" for merged PRs (squash merges included).
merged_prs=""
if command -v gh >/dev/null 2>&1; then
  if ! merged_prs=$(gh pr list --state merged --limit 1000 \
      --json headRefName,headRefOid --jq '.[] | "\(.headRefOid) \(.headRefName)"' 2>/dev/null); then
    echo "warning: could not query GitHub; squash-merged branches will be skipped" >&2
    merged_prs=""
  fi
else
  echo "warning: gh not installed; squash-merged branches will be skipped" >&2
fi

# `--merged` also covers branches with no commits beyond base.
merged_local=$(git for-each-ref --merged="$base" --format='%(refname:short)' refs/heads)

git for-each-ref --format='%(refname:short) %(objectname)' refs/heads |
while read -r branch sha; do
  [ "$branch" = "$base" ] && continue
  [ "$branch" = "$current" ] && continue

  if printf '%s\n' "$merged_local" | grep -Fxq -- "$branch"; then
    reason="merged"
  elif printf '%s\n' "$merged_prs" | grep -Fxq -- "$sha $branch"; then
    reason="squash-merged PR"
  else
    continue
  fi

  if printf '%s\n' "$checked_out" | grep -Fxq -- "$branch"; then
    echo "skip   $branch (checked out in a worktree)"
    continue
  fi

  if [ "$dry_run" -eq 1 ]; then
    echo "would delete $branch ($reason)"
  elif [ "$reason" = "merged" ]; then
    git branch -d -- "$branch"
  else
    # git can't see squash merges as merged, so -D is required; safety comes
    # from the exact head-commit match with the merged PR above.
    git branch -D -- "$branch"
  fi
done
