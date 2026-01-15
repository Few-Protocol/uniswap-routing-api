#!/bin/bash
set -e
REGION="us-east-1"
PROFILE="tbbeta"
AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
  AWS_CMD="aws --profile $PROFILE"
fi
STACKS=$($AWS_CMD cloudformation list-stacks --region "$REGION" --query "StackSummaries[?StackStatus=='CREATE_COMPLETE' || StackStatus=='UPDATE_COMPLETE' || StackStatus=='ROLLBACK_COMPLETE' || StackStatus=='UPDATE_ROLLBACK_COMPLETE'].StackName" --output text)
if [ -z "$STACKS" ]; then
  echo "未找到可删除的堆栈"
  exit 0
fi
echo "待选堆栈:"
for S in $STACKS; do
  echo "  - $S"
done
echo "选择删除方式:"
echo "  a) 删除全部"
echo "  b) 按名称包含过滤"
echo "  c) 取消"
read -p "请输入选项 (a/b/c): " DEL_CHOICE
case $DEL_CHOICE in
  a)
    TARGET_STACKS="$STACKS"
    ;;
  b)
    read -p "输入名称包含的关键字: " KEY
    TARGET_STACKS=""
    for S in $STACKS; do
      if [[ "$S" == *"$KEY"* ]]; then
        TARGET_STACKS="$TARGET_STACKS $S"
      fi
    done
    if [ -z "$TARGET_STACKS" ]; then
      echo "没有匹配的堆栈"
      exit 0
    fi
    ;;
  *)
    echo "操作已取消"
    exit 0
    ;;
esac
echo "确认删除以下堆栈:"
for S in $TARGET_STACKS; do
  echo "  - $S"
done
read -p "请输入 YES 以确认: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "操作已取消"
  exit 0
fi
read -p "是否先禁用终止保护 (y/N): " DISABLE_TP
read -p "是否自动清空堆栈内 S3 Buckets (y/N): " EMPTY_S3
SUCCESS=0
FAIL=0
for S in $TARGET_STACKS; do
  S_TO_DELETE="$S"
  if [[ "$S" == *"NestedStack"* ]]; then
    ROOT="${S%%-*}"
    echo "检测到嵌套栈，改为删除父栈 $ROOT"
    S_TO_DELETE="$ROOT"
  fi
  echo -n "删除 $S_TO_DELETE ... "
  if [ "$DISABLE_TP" = "y" ] || [ "$DISABLE_TP" = "Y" ]; then
    TP=$($AWS_CMD cloudformation describe-stacks --stack-name "$S_TO_DELETE" --region "$REGION" --query "Stacks[0].EnableTerminationProtection" --output text 2>/dev/null || echo "False")
    if [ "$TP" = "True" ]; then
      $AWS_CMD cloudformation update-termination-protection --stack-name "$S_TO_DELETE" --no-enable-termination-protection --region "$REGION" >/dev/null 2>&1 || true
    fi
  fi
  if [ "$EMPTY_S3" = "y" ] || [ "$EMPTY_S3" = "Y" ]; then
    BUCKETS=$($AWS_CMD cloudformation list-stack-resources --stack-name "$S_TO_DELETE" --region "$REGION" --query "StackResourceSummaries[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" --output text 2>/dev/null || echo "")
    for B in $BUCKETS; do
      echo "清空 Bucket s3://$B ..."
      $AWS_CMD s3 rm "s3://$B" --recursive >/dev/null 2>&1 || true
    done
  fi
  ERR=$($AWS_CMD cloudformation delete-stack --stack-name "$S_TO_DELETE" --region "$REGION" 2>&1)
  if [ $? -ne 0 ]; then
    echo "失败: $ERR"
    REASON=$($AWS_CMD cloudformation describe-stack-events --stack-name "$S_TO_DELETE" --region "$REGION" --query "StackEvents[?ResourceStatus=='DELETE_FAILED'][-1].ResourceStatusReason" --output text 2>/dev/null || echo "")
    if [ -n "$REASON" ] && [ "$REASON" != "None" ]; then
      echo "原因: $REASON"
    fi
    FAIL=$((FAIL + 1))
    continue
  fi
  STATUS=""
  COUNT=0
  while true; do
    STATUS=$($AWS_CMD cloudformation describe-stacks --stack-name "$S_TO_DELETE" --region "$REGION" --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "DELETE_COMPLETE")
    printf "\r状态: %s" "$STATUS"
    if [ "$STATUS" = "DELETE_COMPLETE" ]; then
      echo ""
      echo "已删除"
      SUCCESS=$((SUCCESS + 1))
      break
    fi
    if [ "$STATUS" = "DELETE_FAILED" ] || [ "$STATUS" = "ROLLBACK_COMPLETE" ] || [ "$STATUS" = "UPDATE_ROLLBACK_COMPLETE" ]; then
      echo ""
      echo "失败"
      REASON=$($AWS_CMD cloudformation describe-stack-events --stack-name "$S_TO_DELETE" --region "$REGION" --query "StackEvents[?ResourceStatus=='DELETE_FAILED'][-1].ResourceStatusReason" --output text 2>/dev/null || echo "")
      if [ -n "$REASON" ] && [ "$REASON" != "None" ]; then
        echo "原因: $REASON"
      fi
      FAIL=$((FAIL + 1))
      break
    fi
    COUNT=$((COUNT + 1))
    if [ $COUNT -gt 180 ]; then
      echo ""
      echo "等待超时，请稍后使用 describe-stacks 检查状态"
      break
    fi
    sleep 10
  done
done
echo "删除完成"
echo "  成功: $SUCCESS"
echo "  失败: $FAIL"
