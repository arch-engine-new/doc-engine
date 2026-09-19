#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
VUE="$ROOT/apps/web/src/views/standard_lib/index.vue"
if grep -n "/api/jobs" "$VUE"; then
  echo "FAIL: standard_lib still binds /api/jobs"
  exit 1
fi
if ! grep -q 'pack:\${packId' "$VUE"; then
  echo "FAIL: missing pack-scoped trace"
  exit 1
fi
cd "$ROOT/packages/core-engine"
npx vitest run test/standard-lib-stepchat-on-load.test.ts test/standard-lib-stepchat.test.ts
