#!/bin/sh
set -eu

workspace=${1:?workspace is required}
shift
attempt=1
max_attempts=3

while ! npm ci --workspace "$workspace" "$@"; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "npm ci failed after ${max_attempts} attempts for workspace: ${workspace}" >&2
    exit 1
  fi

  delay=$((attempt * 10))
  echo "npm ci attempt ${attempt} failed for workspace ${workspace}; retrying in ${delay}s" >&2
  sleep "$delay"
  attempt=$((attempt + 1))
done
