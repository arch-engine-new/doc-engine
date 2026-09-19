#!/usr/bin/env sh
set -e
DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
sh "$DIR/cases/AC-1-check.sh"
sh "$DIR/cases/AC-2-check.sh"
sh "$DIR/cases/AC-3-check.sh"
