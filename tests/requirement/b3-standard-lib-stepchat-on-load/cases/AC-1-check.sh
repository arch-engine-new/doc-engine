#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/packages/core-engine"
npx vitest run test/standard-lib-stepchat-on-load.test.ts
