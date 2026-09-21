#!/usr/bin/env bash
# 列出所有 pool cache buckets 及其内容（自动发现所有 pool buckets）
#
# Usage:
#   ./list_s3.sh                    # 使用 ringprod (默认)
#   ./list_s3.sh --profile tbbeta   # 使用 tbbeta
#
# 注意: 此脚本会遍历所有 pool buckets，较慢。
#       如需直接访问已知 bucket，请用 list_s3_bucket_contents.sh

set -euo pipefail
REGION="us-east-1"
PROFILE="ringprod"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    *) shift ;;
  esac
done
aws s3 ls --region "$REGION" --profile "$PROFILE" 2>&1 | grep -i pool | while IFS= read -r line; do
  bucket_name=$(echo "$line" | awk '{print $3}')
  if [[ -n "$bucket_name" ]]; then
    aws s3 ls "s3://$bucket_name/" --human-readable --region "$REGION" --profile "$PROFILE"
  fi
done
