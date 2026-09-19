#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/packages/agent-runtime"
npx vitest run --config vitest.config.ts test/unconfigured-llm.test.ts
cd "$ROOT/packages/core-engine"
npx vitest run test/http-adapter.test.ts -t "memory POST /api/chat without llm.json"
