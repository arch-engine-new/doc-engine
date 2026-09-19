#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/packages/core-engine"
npx vitest run test/standard-lib-stepchat.test.ts test/agent-connect.test.ts
