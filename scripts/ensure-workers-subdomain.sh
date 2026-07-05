#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

api_base="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/subdomain"
auth_header="Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

fail() {
  echo "$1" >&2
  exit 1
}

get_existing_subdomain() {
  local response
  response="$(curl -sS "${api_base}" -H "${auth_header}" -H "Content-Type: application/json" || true)"
  if [ -n "${response}" ] && echo "${response}" | jq -e '.success == true and (.result.subdomain | type == "string") and (.result.subdomain | length > 0)' >/dev/null; then
    echo "${response}" | jq -r '.result.subdomain'
    return 0
  fi
  return 1
}

assert_requested_matches_existing() {
  local existing="$1"
  if [ -n "${WORKERS_DEV_SUBDOMAIN:-}" ] && [ "${existing}" != "${WORKERS_DEV_SUBDOMAIN}" ]; then
    fail "Account already uses workers.dev subdomain '${existing}', but WORKERS_DEV_SUBDOMAIN is '${WORKERS_DEV_SUBDOMAIN}'. Cloudflare allows one subdomain per account and it cannot be changed via this API. Update the GitHub variable to '${existing}' or remove it."
  fi
}

is_globally_taken_error() {
  local response="$1"
  echo "${response}" | jq -r '.errors[]? | "\(.code) \(.message)"' | grep -Eqi 'already|taken|exists|in use|not available'
}

existing_subdomain=""
if existing_subdomain="$(get_existing_subdomain)"; then
  assert_requested_matches_existing "${existing_subdomain}"
  echo "workers.dev subdomain already registered: ${existing_subdomain}"
  exit 0
fi

if [ -z "${WORKERS_DEV_SUBDOMAIN:-}" ]; then
  fail "No workers.dev subdomain is registered for this account. Set WORKERS_DEV_SUBDOMAIN on the GitHub dev environment (globally unique; for example your handle), or register manually at https://dash.cloudflare.com/?to=/:account/workers/subdomain"
fi

put_response="$(curl -sS "${api_base}" \
  -X PUT \
  -H "${auth_header}" \
  -H "Content-Type: application/json" \
  -d "{\"subdomain\":\"${WORKERS_DEV_SUBDOMAIN}\"}")"

if echo "${put_response}" | jq -e '.success == true' >/dev/null; then
  echo "Registered workers.dev subdomain: $(echo "${put_response}" | jq -r '.result.subdomain')"
  exit 0
fi

# Account claimed a subdomain between GET and PUT (dashboard or a parallel deploy).
if echo "${put_response}" | jq -e '.errors[]? | select(.code == 10036)' >/dev/null; then
  if existing_subdomain="$(get_existing_subdomain)"; then
    assert_requested_matches_existing "${existing_subdomain}"
    echo "workers.dev subdomain already registered: ${existing_subdomain}"
    exit 0
  fi
  fail "This Cloudflare account already has a workers.dev subdomain, but it could not be read back. Check https://dash.cloudflare.com/?to=/:account/workers/subdomain"
fi

if is_globally_taken_error "${put_response}"; then
  fail "WORKERS_DEV_SUBDOMAIN '${WORKERS_DEV_SUBDOMAIN}' is not available. workers.dev names are globally unique across all Cloudflare accounts — choose a different value."
fi

echo "${put_response}" | jq -r '.errors[]? | "\(.code): \(.message)"' >&2 || echo "${put_response}" >&2
fail "Failed to register workers.dev subdomain '${WORKERS_DEV_SUBDOMAIN}'."
