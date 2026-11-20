#!/usr/bin/env bash
# Prints the next release version: calendar versioning YYYY.MM.DD.NN (NN = 01..99, the Nth release that day).
# Releases are git tags vYYYY.MM.DD.NN (the deploy skill creates them).
#   tools/next_version.sh          -> 2026.11.20.01
#   tools/next_version.sh --code   -> 2026112001   (Android versionCode: same digits, always increasing)
# Uses today's local date; looks at local tags (git fetch --tags first if other machines tag too).
set -euo pipefail
cd "$(dirname "$0")/.."
DAY="$(date +%Y.%m.%d)"
LAST="$(git tag -l "v$DAY.*" | sed "s/^v$DAY\.//" | grep -E '^[0-9]{2}$' | sort -n | tail -1 || true)"
N=$((10#${LAST:-0} + 1))
if [ "$N" -gt 99 ]; then echo "99 releases today already" >&2; exit 1; fi
V="$DAY.$(printf %02d "$N")"
if [ "${1:-}" = "--code" ]; then echo "${V//./}"; else echo "$V"; fi
