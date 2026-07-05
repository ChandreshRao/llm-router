#!/usr/bin/env bash
# Generate ADMIN_TOKEN and ENCRYPTION_KEY for local dev or wrangler secret put.
set -euo pipefail

random_alnum() {
  local length="$1"
  LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$length"
}

admin_token="$(random_alnum 48)"
encryption_key="$(random_alnum 64)"

cat <<EOF
# ADMIN_TOKEN — used to sign in to the admin UI
${admin_token}

# ENCRYPTION_KEY — encrypts provider API keys in D1 (min ~32 chars)
${encryption_key}
EOF
