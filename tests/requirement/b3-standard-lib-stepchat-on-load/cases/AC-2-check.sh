#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
VUE="$ROOT/apps/web/src/views/standard_lib/index.vue"
if grep -n 'v-if="chatReady"' "$VUE"; then
  echo "FAIL: StepChat still gated on chatReady"
  exit 1
fi
if grep -nE 'chatReady.*hits\.length' "$VUE"; then
  echo "FAIL: chatReady still tied to hits.length"
  exit 1
fi
cd "$ROOT/packages/core-engine"
npx vitest run test/standard-lib-stepchat-on-load.test.ts
