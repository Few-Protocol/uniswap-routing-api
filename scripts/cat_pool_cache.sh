#!/usr/bin/env bash
set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"
BUCKET="routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe"
KEY=""
CHAIN="196"
PROTOCOL="V3"
PREFIX="poolCacheGzip.json"
OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    --key) KEY="$2"; shift 2 ;;
    --chain) CHAIN="$2"; shift 2 ;;
    --protocol) PROTOCOL="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [[ -z "${KEY}" ]]; then
  if [[ -n "${CHAIN}" && -n "${PROTOCOL}" ]]; then
    KEY="${PREFIX}-${CHAIN}-${PROTOCOL}"
  fi
fi
if [[ -z "${BUCKET}" || -z "${KEY}" ]]; then
  echo "missing --bucket and (--key or --chain --protocol)"
  exit 1
fi
CMD=(aws s3 cp "s3://${BUCKET}/${KEY}" -)
if [[ -n "${REGION}" ]]; then CMD+=("--region" "${REGION}"); fi
if [[ -n "${PROFILE}" ]]; then CMD+=("--profile" "${PROFILE}"); fi
if [[ -n "${OUT}" ]]; then
  "${CMD[@]}" | python3 -c 'import sys,zlib; sys.stdout.write(zlib.decompress(sys.stdin.buffer.read()).decode("utf-8"))' > "${OUT}"
else
  "${CMD[@]}" | python3 -c 'import sys,zlib; sys.stdout.write(zlib.decompress(sys.stdin.buffer.read()).decode("utf-8"))'
fi
