#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x ".venv/bin/hpa" ]]; then
  bash scripts/install.sh
else
  exec .venv/bin/hpa web "$@"
fi
