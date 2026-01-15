#!/usr/bin/env bash
# Bucket: routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe

set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"
PREFIX=""
BUCKETS=()
# DEFAULT_BUCKETS=("routingapistack-routingc-poolcachebucket20a883daa-1e3c2gbw9fwzs" "routingapistack-routingc-poolcachebucket20a883daa-1jdxj5uikw2hz" "routingapistack-routingc-poolcachebucket20a883daa-1lwgiqvfvrdmk" "routingapistack-routingc-poolcachebucket20a883daa-1v5jxkwwuux6z" "routingapistack-routingc-poolcachebucket20a883daa-gm6q14cyf2r6" "routingapistack-routingc-poolcachebucket20a883daa-jukrkfsio6sp" "routingapistack-routingc-poolcachebucket20a883daa-zi6e7lii7qj0" "routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe" "routingapistack-routingca-poolcachebucketd80d665f-19d76ybo7317q" "routingapistack-routingca-poolcachebucketd80d665f-1b85bvzx4o1d7" "routingapistack-routingca-poolcachebucketd80d665f-1hhkdrp0a3rib" "routingapistack-routingca-poolcachebucketd80d665f-1r43a05tqyy0x" "routingapistack-routingca-poolcachebucketd80d665f-7ueogyzqq49" "routingapistack-routingca-poolcachebucketd80d665f-ae31g3b26hwu" "routingapistack-routingca-poolcachebucketd80d665f-qg8fwl38r0qj")
DEFAULT_BUCKETS=("routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    *) BUCKETS+=("$1"); shift ;;
  esac
done
if [[ ${#BUCKETS[@]} -eq 0 ]]; then
  BUCKETS=("${DEFAULT_BUCKETS[@]}")
fi
for bucket in "${BUCKETS[@]}"; do
  echo "Bucket: ${bucket}"
  PATH_PREFIX="s3://${bucket}"
  if [[ -n "${PREFIX}" ]]; then
    PATH_PREFIX="s3://${bucket}/${PREFIX}"
  fi
  if [[ -n "${REGION}" && -n "${PROFILE}" ]]; then
    aws s3 ls "${PATH_PREFIX}" --recursive --region "${REGION}" --profile "${PROFILE}"
  elif [[ -n "${REGION}" ]]; then
    aws s3 ls "${PATH_PREFIX}" --recursive --region "${REGION}"
  elif [[ -n "${PROFILE}" ]]; then
    aws s3 ls "${PATH_PREFIX}" --recursive --profile "${PROFILE}"
  else
    aws s3 ls "${PATH_PREFIX}" --recursive
  fi
done
