#!/usr/bin/env bash
# Pull request check: scan the PR title, description, commits and added lines for personal
# information. The patterns come from the PERSONAL_GUARD_DENY secret and never appear in this
# repository or in the logs: the output names where a match is, never the matched text.
#
# Env: DENY (the secret), BASE_SHA, PR_TITLE, PR_BODY.
set -euo pipefail

if [ -z "${DENY:-}" ]; then
  echo "::error::The PERSONAL_GUARD_DENY secret is not set."
  exit 1
fi

found=0
report() {
  echo "::error::Personal-information match in $1"
  found=1
}
scan_text() {
  if printf '%s\n' "$2" | grep -q -i -E -- "$DENY"; then report "$1"; fi
}

scan_text "the PR title" "${PR_TITLE:-}"
scan_text "the PR description" "${PR_BODY:-}"

for sha in $(git rev-list "$BASE_SHA..HEAD"); do
  scan_text "commit ${sha:0:8} (message)" "$(git show -s --format=%B "$sha")"
  scan_text "commit ${sha:0:8} (author or committer)" "$(git show -s --format='%an %ae %cn %ce' "$sha")"
done

added=$(mktemp)
git diff -U0 --no-color "$BASE_SHA...HEAD" | awk '
  /^\+\+\+ / { file = substr($0, 7); next }
  /^@@/      { split($3, range, ","); line = substr(range[1], 2) + 0; next }
  /^\+/      { print file ":" line ":" substr($0, 2); line++ }
' > "$added"
while IFS= read -r location; do
  report "$location"
done < <(grep -i -E -- "$DENY" "$added" | cut -d: -f1,2 || true)

if [ "$found" -ne 0 ]; then
  echo "Remove the flagged content and push again."
  exit 1
fi
echo "privacy scan passed"
