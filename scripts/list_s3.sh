#!/usr/bin/env bash
set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"
aws s3 ls --region "$REGION" --profile "$PROFILE" 2>&1 | grep -i pool | while IFS= read -r line; do
  bucket_name=$(echo "$line" | awk '{print $3}')
  if [[ -n "$bucket_name" ]]; then
    aws s3 ls "s3://$bucket_name/" --human-readable --region "$REGION" --profile "$PROFILE"
  fi
done
