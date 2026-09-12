#!/usr/bin/env bash
set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"
KEEP_BUCKET="routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe"
DRY_RUN="y"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --keep) KEEP_BUCKET="$2"; shift 2 ;;
    --yes) DRY_RUN="n"; shift 1 ;;
    *) shift ;;
  esac
done
: "${KEEP_BUCKET:=routingapistack-routingca-poolcachebucket3c1337d0e-2kapdiffybqe}"
if [[ -z "${KEEP_BUCKET}" ]]; then
  echo "KEEP_BUCKET 未设置或为空"
  exit 1
fi
aws s3api list-buckets --query 'Buckets[].Name' --output text --region "$REGION" --profile "$PROFILE" | tr '\t' '\n' | \
  grep -E '^routingapistack-.*poolcachebucket' | grep -v -F "$KEEP_BUCKET" | while IFS= read -r B; do
    LOC=$(aws s3api get-bucket-location --bucket "$B" --region "$REGION" --profile "$PROFILE" --query 'LocationConstraint' --output text 2>/dev/null || echo "us-east-1")
    if [[ "$LOC" == "None" || -z "$LOC" ]]; then LOC="us-east-1"; fi
    echo "Bucket: $B (region: $LOC)"
  done
echo ""
echo "以上为将要删除的候选 Buckets（保留: $KEEP_BUCKET）"
if [[ "$DRY_RUN" == "y" ]]; then
  echo "这是预览。若确认删除，请使用 --yes，并再次运行。"
  exit 0
fi
read -p "输入 YES 以确认删除上述 Buckets: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "已取消"
  exit 0
fi
SUCCESS=0
FAIL=0
aws s3api list-buckets --query 'Buckets[].Name' --output text --region "$REGION" --profile "$PROFILE" | tr '\t' '\n' | \
  grep -E '^routingapistack-.*poolcachebucket' | grep -v -F "$KEEP_BUCKET" | while IFS= read -r B; do
    LOC=$(aws s3api get-bucket-location --bucket "$B" --region "$REGION" --profile "$PROFILE" --query 'LocationConstraint' --output text 2>/dev/null || echo "us-east-1")
    if [[ "$LOC" == "None" || -z "$LOC" ]]; then LOC="us-east-1"; fi
    echo "清空并删除: $B ..."
    aws s3 rm "s3://$B" --recursive --region "$LOC" --profile "$PROFILE" >/dev/null 2>&1 || true
    if aws s3api delete-bucket --bucket "$B" --region "$LOC" --profile "$PROFILE" >/dev/null 2>&1; then
      echo "✅ 已删除: $B"
      SUCCESS=$((SUCCESS + 1))
    else
      echo "❌ 失败: $B"
      FAIL=$((FAIL + 1))
    fi
  done
echo "完成  成功: $SUCCESS  失败: $FAIL"
