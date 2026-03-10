#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local. Create it from .env.local.example first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL in .env.local (needed only to apply schema)." >&2
  exit 1
fi

if [[ ! -f supabase/schema.sql ]]; then
  echo "Missing supabase/schema.sql" >&2
  exit 1
fi

cat supabase/schema.sql | docker run --rm -i postgres:16-alpine psql "$DATABASE_URL" -v ON_ERROR_STOP=1

echo "Schema applied successfully."

