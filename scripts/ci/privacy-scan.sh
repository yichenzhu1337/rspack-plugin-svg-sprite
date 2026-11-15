#!/usr/bin/env bash
# Pull request check: scan the PR title, description, commits and added lines for personal
# information. The patterns come from the PERSONAL_GUARD_DENY secret and never appear in this
# repository or in the logs: the output names where a match is, never the matched text.
#
# Env: DENY (the secret), BASE_SHA, PR_TITLE, PR_BODY.
set -euo pipefail

# Colors only on a TTY or in CI, never with NO_COLOR.
if [ -z "${NO_COLOR:-}" ] && { [ -t 1 ] || [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; }; then
  GREEN=$'\033[32m' RED=$'\033[31m' DIM=$'\033[2m' OFF=$'\033[0m'
else
  GREEN='' RED='' DIM='' OFF=''
fi

summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"; fi
}

if [ -z "${DENY:-}" ]; then
  echo "::error::❌ The PERSONAL_GUARD_DENY secret is not set."
  summary $'## 🔒 Privacy scan\n\n> [!CAUTION]\n> The `PERSONAL_GUARD_DENY` secret is not set, so nothing was scanned.'
  exit 1
fi

found=0
locations=()
report() {
  echo "::error::❌ Personal-information match in $1"
  locations+=("$1")
  found=1
}
scan_text() {
  if printf '%s\n' "$2" | grep -q -i -E -- "$DENY"; then report "$1"; fi
}

if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::group::Privacy scan"; fi
scan_text "the PR title" "${PR_TITLE:-}"
scan_text "the PR description" "${PR_BODY:-}"

commits=0
for sha in $(git rev-list "$BASE_SHA..HEAD"); do
  commits=$((commits + 1))
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
lines=$(wc -l < "$added" | tr -d ' ')
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::endgroup::"; fi

echo "${DIM}scanned the PR title and description, $commits commit(s) and $lines added line(s)${OFF}"

if [ "$found" -ne 0 ]; then
  summary "$(
    printf '## 🔒 Privacy scan\n\n'
    printf '> [!CAUTION]\n> %s place(s) in this pull request match the personal-information guard. The matched text is not shown.\n\n' "${#locations[@]}"
    printf '### 🔍 Where\n\n'
    printf -- '- `%s`\n' "${locations[@]}"
    printf '\n### 🛠️ How to fix\n\n'
    printf 'Remove the flagged content and push again. For a commit message or author, rewrite the commit.\n'
  )"
  echo "${RED}❌ Remove the flagged content and push again.${OFF}"
  exit 1
fi
summary "$(printf '## 🔒 Privacy scan\n\n> [!TIP]\n> No personal information found in the PR title, description, %s commit(s) or %s added line(s).' "$commits" "$lines")"
echo "${GREEN}✅ privacy scan passed${OFF}"
