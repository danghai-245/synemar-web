#!/usr/bin/env bash
# Deploy synemar-web to GitHub Pages (repo: danghai-245/synemar-web).
#
# Usage: user pastes a GitHub classic token (scope: repo) into chat;
# the agent passes it TRANSIENTLY via env, never writing it to disk:
#   GITHUB_TOKEN='<pasted-token>' ./deploy.sh
#
# The script never stores the token: the push uses an inline URL
# (no remote is persisted in .git/config).
set -euo pipefail

OWNER="danghai-245"
REPO="synemar-web"
BRANCH="$(git branch --show-current)"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: set GITHUB_TOKEN env var (transient, do not save to disk)." >&2
  exit 1
fi

AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json")
API="https://api.github.com"

echo "==> 1/4 creating repo $OWNER/$REPO (if missing)"
CODE=$(curl -s -o /tmp/gh_create.json -w "%{http_code}" -X POST "${AUTH[@]}" \
  "$API/user/repos" \
  -d "{\"name\":\"$REPO\",\"description\":\"Synemar music visualizer as a web app — runs on any device (phone/desktop)\",\"private\":false,\"auto_init\":false}")
if [[ "$CODE" == "201" ]]; then
  echo "    repo created"
elif [[ "$CODE" == "422" ]]; then
  echo "    repo already exists, continuing"
else
  echo "    FAILED ($CODE):"; cat /tmp/gh_create.json; exit 1
fi

echo "==> 2/4 pushing $BRANCH (token used inline only, not persisted)"
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/$OWNER/$REPO.git" "$BRANCH"

echo "==> 3/4 enabling GitHub Pages (branch $BRANCH, root)"
CODE=$(curl -s -o /tmp/gh_pages.json -w "%{http_code}" -X POST "${AUTH[@]}" \
  "$API/repos/$OWNER/$REPO/pages" \
  -d "{\"source\":{\"branch\":\"$BRANCH\",\"path\":\"/\"}}")
if [[ "$CODE" == "201" ]]; then
  echo "    Pages enabled"
elif [[ "$CODE" == "409" ]]; then
  echo "    Pages already enabled, continuing"
else
  echo "    FAILED ($CODE):"; cat /tmp/gh_pages.json; exit 1
fi

echo "==> 4/4 waiting for Pages build"
for i in $(seq 1 30); do
  STATUS=$(curl -s "${AUTH[@]}" "$API/repos/$OWNER/$REPO/pages" | grep -o '"status":"[^"]*"' | head -1)
  echo "    attempt $i: $STATUS"
  if [[ "$STATUS" == *'"built"'* ]]; then break; fi
  sleep 10
done

URL="https://$OWNER.github.io/$REPO/"
echo ""
echo "DONE: $URL"
