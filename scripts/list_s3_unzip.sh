#!/usr/bin/env bash
# Usage: ./list_s3_unzip.sh <filename> [--profile <profile>]
# Example: ./list_s3_unzip.sh poolCacheGzip.json-196-V2
#          ./list_s3_unzip.sh poolCacheGzip.json-1-V3 --profile ringprod

set -euo pipefail

REGION="us-east-1"
PROFILE="ringprod"
FILENAME=""

# Bucket mapping by profile
declare -A BUCKETS=(
  ["ringprod"]="routingapistack-routingca-poolcachebucket3c1337d0e-xhjxawoitnvr"
  ["tbbeta"]="routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe"
)

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    *) FILENAME="$1"; shift ;;
  esac
done

if [[ -z "$FILENAME" ]]; then
  echo "Usage: $0 <filename> [--profile <profile>]"
  echo "Example: $0 poolCacheGzip.json-196-V2"
  echo "         $0 poolCacheGzip.json-1-V3 --profile tbbeta"
  exit 1
fi

BUCKET="${BUCKETS[$PROFILE]:-}"
if [[ -z "$BUCKET" ]]; then
  echo "Error: Unknown profile '$PROFILE'. Supported: ringprod, tbbeta"
  exit 1
fi

echo "Fetching s3://$BUCKET/$FILENAME (profile: $PROFILE)"
aws s3 cp "s3://$BUCKET/$FILENAME" - --region "$REGION" --profile "$PROFILE" | \
  python3 -c "import sys,zlib,json; print(json.dumps(json.loads(zlib.decompress(sys.stdin.buffer.read())), indent=2))"
