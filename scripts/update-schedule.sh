#!/bin/bash

# ==========================================
# EventBridge 规则调度时间更新脚本
# ==========================================
# 在下方配置参数，然后直接运行脚本即可

# ========== 配置区域 ==========
NEW_RATE="2880"              # 新的调度间隔（分钟），例如: 720 = 12小时, 60 = 1小时, 30 = 30分钟
REGION="us-east-1"          # AWS 区域
PROFILE="mgmt"              # AWS CLI Profile，留空则使用默认 profile
# ==============================

set -e

# 构建 AWS CLI 基础命令
AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
fi

echo "=========================================="
echo "EventBridge 规则调度时间更新脚本"
echo "=========================================="
echo "新的调度时间: rate($NEW_RATE minutes)"
echo "AWS 区域: $REGION"
echo "AWS Profile: ${PROFILE:-默认}"
echo "=========================================="

echo ""
echo "请选择操作:"
echo "  1) 更新 EventBridge 调度"
echo "  2) 删除 CloudFormation 堆栈"
echo "  3) 取消操作"
read -p "请输入选项 (1/2/3): " MAIN_CHOICE

case $MAIN_CHOICE in
    1)
        ;;
    2)
        STACKS=$($AWS_CMD cloudformation list-stacks \
            --region "$REGION" \
            --query "StackSummaries[?StackStatus=='CREATE_COMPLETE' || StackStatus=='UPDATE_COMPLETE' || StackStatus=='ROLLBACK_COMPLETE' || StackStatus=='UPDATE_ROLLBACK_COMPLETE'].StackName" \
            --output text)
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
                TP=$($AWS_CMD cloudformation describe-stacks \
                    --stack-name "$S_TO_DELETE" \
                    --region "$REGION" \
                    --query "Stacks[0].EnableTerminationProtection" \
                    --output text 2>/dev/null || echo "False")
                if [ "$TP" = "True" ]; then
                    $AWS_CMD cloudformation update-termination-protection \
                        --stack-name "$S_TO_DELETE" \
                        --no-enable-termination-protection \
                        --region "$REGION" >/dev/null 2>&1 || true
                fi
            fi
            if [ "$EMPTY_S3" = "y" ] || [ "$EMPTY_S3" = "Y" ]; then
                BUCKETS=$($AWS_CMD cloudformation list-stack-resources \
                    --stack-name "$S_TO_DELETE" \
                    --region "$REGION" \
                    --query "StackResourceSummaries[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" \
                    --output text 2>/dev/null || echo "")
                for B in $BUCKETS; do
                    echo "清空 Bucket s3://$B ..."
                    $AWS_CMD s3 rm "s3://$B" --recursive >/dev/null 2>&1 || true
                done
            fi
            ERR=$($AWS_CMD cloudformation delete-stack \
                --stack-name "$S_TO_DELETE" \
                --region "$REGION" 2>&1)
            if [ $? -ne 0 ]; then
                echo "失败: $ERR"
                REASON=$($AWS_CMD cloudformation describe-stack-events \
                    --stack-name "$S_TO_DELETE" \
                    --region "$REGION" \
                    --query "StackEvents[?ResourceStatus=='DELETE_FAILED'][-1].ResourceStatusReason" \
                    --output text 2>/dev/null || echo "")
                if [ -n "$REASON" ] && [ "$REASON" != "None" ]; then
                    echo "原因: $REASON"
                fi
                FAIL=$((FAIL + 1))
                continue
            fi
            STATUS=""
            COUNT=0
            while true; do
                STATUS=$($AWS_CMD cloudformation describe-stacks \
                    --stack-name "$S_TO_DELETE" \
                    --region "$REGION" \
                    --query "Stacks[0].StackStatus" \
                    --output text 2>/dev/null || echo "DELETE_COMPLETE")
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
                    REASON=$($AWS_CMD cloudformation describe-stack-events \
                        --stack-name "$S_TO_DELETE" \
                        --region "$REGION" \
                        --query "StackEvents[?ResourceStatus=='DELETE_FAILED'][-1].ResourceStatusReason" \
                        --output text 2>/dev/null || echo "")
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
        exit 0
        ;;
    *)
        echo "操作已取消"
        exit 0
        ;;
esac

# 列出所有匹配的 EventBridge 规则
echo ""
echo "📋 正在查找 Pool Cache 相关的 EventBridge 规则..."
echo ""

# 获取所有规则名称 (包含 SchedulePoolCache 或 ScheduleTokenListCache)
RULES=$($AWS_CMD events list-rules \
    --region "$REGION" \
    --query "Rules[?contains(Name, 'SchedulePoolCache') || contains(Name, 'ScheduleTokenListCache')].Name" \
    --output text)

if [ -z "$RULES" ]; then
    echo "❌ 未找到匹配的规则。请检查:"
    echo "   1. AWS 区域是否正确"
    echo "   2. AWS Profile 是否正确"
    echo "   3. CDK 堆栈是否已部署"
    echo "   4. 规则命名是否包含 'SchedulePoolCache'"
    exit 1
fi

# 创建临时文件存储修改前的状态
BEFORE_FILE=$(mktemp)
trap "rm -f $BEFORE_FILE" EXIT

# 显示修改前的状态，包含 Lambda 状态检查
echo "📊 修改前的规则状态:"
echo "============================================================================================================"
printf "%-65s %-22s %-10s %s\n" "规则名称" "当前调度" "状态" "Lambda目标"
echo "============================================================================================================"

VALID_RULES=""
INVALID_RULES=""

for RULE in $RULES; do
    # 获取调度表达式
    SCHEDULE=$($AWS_CMD events describe-rule \
        --name "$RULE" \
        --region "$REGION" \
        --query "ScheduleExpression" \
        --output text 2>/dev/null || echo "获取失败")
    
    # 获取规则状态
    RULE_STATE=$($AWS_CMD events describe-rule \
        --name "$RULE" \
        --region "$REGION" \
        --query "State" \
        --output text 2>/dev/null || echo "UNKNOWN")
    
    # 获取目标 Lambda ARN
    TARGET_ARN=$($AWS_CMD events list-targets-by-rule \
        --rule "$RULE" \
        --region "$REGION" \
        --query "Targets[0].Arn" \
        --output text 2>/dev/null || echo "")
    
    # 检查 Lambda 是否存在
    LAMBDA_STATUS="❓"
    LAMBDA_NAME=""
    if [ -n "$TARGET_ARN" ] && [ "$TARGET_ARN" != "None" ]; then
        # 从 ARN 提取函数名
        LAMBDA_NAME=$(echo "$TARGET_ARN" | sed 's/.*:function://')
        
        # 检查 Lambda 是否存在
        if $AWS_CMD lambda get-function \
            --function-name "$LAMBDA_NAME" \
            --region "$REGION" \
            > /dev/null 2>&1; then
            LAMBDA_STATUS="✅ $LAMBDA_NAME"
            VALID_RULES="$VALID_RULES $RULE"
        else
            LAMBDA_STATUS="❌ 不存在: $LAMBDA_NAME"
            INVALID_RULES="$INVALID_RULES $RULE"
        fi
    else
        LAMBDA_STATUS="❌ 无目标"
        INVALID_RULES="$INVALID_RULES $RULE"
    fi
    
    # 保存到临时文件
    echo "$RULE|$SCHEDULE" >> "$BEFORE_FILE"
    
    # 截断显示
    RULE_DISPLAY="${RULE:0:63}"
    LAMBDA_DISPLAY="${LAMBDA_STATUS:0:40}"
    printf "%-65s %-22s %-10s %s\n" "$RULE_DISPLAY" "$SCHEDULE" "$RULE_STATE" "$LAMBDA_DISPLAY"
done
echo "============================================================================================================"

# 显示统计
VALID_COUNT=$(echo $VALID_RULES | wc -w | tr -d ' ')
INVALID_COUNT=$(echo $INVALID_RULES | wc -w | tr -d ' ')

echo ""
echo "📈 统计:"
echo "   ✅ 有效规则 (Lambda 存在): $VALID_COUNT"
echo "   ❌ 无效规则 (Lambda 不存在或无目标): $INVALID_COUNT"

# 如果有无效规则，提示用户
if [ -n "$INVALID_RULES" ]; then
    echo ""
    echo "⚠️  发现无效规则！这些可能是旧部署遗留的:"
    for RULE in $INVALID_RULES; do
        echo "   - $RULE"
    done
    echo ""
    echo "💡 如需删除无效规则，运行:"
    for RULE in $INVALID_RULES; do
        echo "   $AWS_CMD events delete-rule --name \"$RULE\" --region $REGION --force"
    done
fi

echo ""

# 询问用户要更新哪些规则
echo "请选择要更新的规则:"
echo "  1) 仅更新有效规则 (推荐)"
echo "  2) 更新所有规则"
echo "  3) 取消操作"
read -p "请输入选项 (1/2/3): " CHOICE

case $CHOICE in
    1)
        if [ -z "$VALID_RULES" ]; then
            echo "没有有效规则可更新"
            exit 0
        fi
        UPDATE_RULES="$VALID_RULES"
        ;;
    2)
        UPDATE_RULES="$RULES"
        ;;
    *)
        echo "操作已取消"
        exit 0
        ;;
esac

echo ""
echo "🔄 开始更新规则..."
echo ""

# 更新每个规则
SUCCESS_COUNT=0
FAIL_COUNT=0

for RULE in $UPDATE_RULES; do
    echo -n "  更新 $RULE ... "
    
    if $AWS_CMD events put-rule \
        --name "$RULE" \
        --schedule-expression "rate($NEW_RATE minutes)" \
        --region "$REGION" \
        > /dev/null 2>&1; then
        echo "✅ 成功"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ 失败"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

echo ""
echo "=========================================="
echo "更新完成!"
echo "  成功: $SUCCESS_COUNT"
echo "  失败: $FAIL_COUNT"
echo "=========================================="

# 显示修改后的状态对比
echo ""
echo "📊 修改前后对比:"
echo "--------------------------------------------------------------------------------------"
printf "%-60s %-20s %-20s\n" "规则名称" "修改前" "修改后"
echo "--------------------------------------------------------------------------------------"

for RULE in $UPDATE_RULES; do
    # 从临时文件读取修改前的值
    BEFORE=$(grep "^$RULE|" "$BEFORE_FILE" | cut -d'|' -f2)
    
    AFTER=$($AWS_CMD events describe-rule \
        --name "$RULE" \
        --region "$REGION" \
        --query "ScheduleExpression" \
        --output text 2>/dev/null || echo "获取失败")
    
    # 截断规则名称以便显示
    RULE_DISPLAY="${RULE:0:58}"
    printf "%-60s %-20s %-20s\n" "$RULE_DISPLAY" "$BEFORE" "$AFTER"
done
echo "--------------------------------------------------------------------------------------"

echo ""
echo "💡 提示: 如需恢复原来的调度时间，修改脚本顶部的 NEW_RATE 值后重新运行"
echo "   或者重新部署 CDK 堆栈: cdk deploy"
