#!/bin/bash

# ==========================================
# 指定 EventBridge 规则调度更新脚本
# ==========================================

# ========== 配置区域 ==========
RULE_NAME="RoutingAPIStack-RoutingCa-SchedulePoolCacheChainId1-j6SxQEEilCj4"
NEW_RATE="720"                 # 调度间隔（分钟）
REGION="us-east-1"           # AWS 区域
PROFILE="tbbeta"               # AWS CLI Profile，留空则使用默认 profile
# ==============================

set -e

AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
  AWS_CMD="aws --profile $PROFILE"
fi

echo "=========================================="
echo "EventBridge 规则调度更新"
echo "=========================================="
echo "规则名称: $RULE_NAME"
echo "新的调度: rate($NEW_RATE minutes)"
echo "AWS 区域: $REGION"
echo "AWS Profile: ${PROFILE:-默认}"
echo "=========================================="

echo ""
echo "获取修改前调度..."
BEFORE=$($AWS_CMD events describe-rule \
  --name "$RULE_NAME" \
  --region "$REGION" \
  --query "ScheduleExpression" \
  --output text 2>/dev/null || echo "获取失败")

echo "修改前: $BEFORE"
echo ""
echo "更新中..."

$AWS_CMD events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate($NEW_RATE minutes)" \
  --region "$REGION" \
  > /dev/null

echo "更新完成"

AFTER=$($AWS_CMD events describe-rule \
  --name "$RULE_NAME" \
  --region "$REGION" \
  --query "ScheduleExpression" \
  --output text 2>/dev/null || echo "获取失败")

echo "修改后: $AFTER"
