#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
if grep -n "/api/jobs" "$ROOT/apps/web/src/views/standard_lib/index.vue"; then
  echo "FAIL: standard_lib still binds /api/jobs"
  exit 1
fi
cd "$ROOT/packages/core-engine"
npx vitest run test/standard-lib-stepchat.test.ts
