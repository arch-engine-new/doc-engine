#!/usr/bin/env sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/packages/agent-runtime"
npx vitest run test/arch-chat-fallback.test.ts
