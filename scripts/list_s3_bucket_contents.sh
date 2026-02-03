#!/usr/bin/env bash
# 列出指定 bucket 中的 pool cache 文件（使用预配置 bucket，速度快）
#
# Usage:
#   ./list_s3_bucket_contents.sh                    # 使用 tbbeta (默认)
#   ./list_s3_bucket_contents.sh --profile ringprod # 使用 ringprod
#   ./list_s3_bucket_contents.sh --prefix poolCacheGzip.json-196  # 按前缀过滤
#
# Buckets:
#   tbbeta:   routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe
#   ringprod: routingapistack-routingca-poolcachebucket3c1337d0e-xhjxawoitnvr

set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"
PREFIX=""
BUCKETS=()

# tbbeta buckets
TBBETA_BUCKETS=("routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe")

# ringprod buckets
RINGPROD_BUCKETS=("routingapistack-routingca-poolcachebucket3c1337d0e-xhjxawoitnvr")

DEFAULT_BUCKETS=("${TBBETA_BUCKETS[@]}")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    *) BUCKETS+=("$1"); shift ;;
  esac
done

# Select default buckets based on profile if no buckets specified
if [[ ${#BUCKETS[@]} -eq 0 ]]; then
  case "$PROFILE" in
    ringprod) BUCKETS=("${RINGPROD_BUCKETS[@]}") ;;
    tbbeta)   BUCKETS=("${TBBETA_BUCKETS[@]}") ;;
    *)        BUCKETS=("${DEFAULT_BUCKETS[@]}") ;;
  esac
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
