#!/bin/bash

# ==========================================
# 定时任务执行状态查看脚本
# ==========================================
# 查看最近 N 小时内 Pool Cache Lambda 的调用情况
#
# 用法:
#   ./check-cron-status.sh                    # 查看最近 24 小时
#   ./check-cron-status.sh -t 12              # 查看最近 12 小时
#   ./check-cron-status.sh -f PoolCache       # 只查看 PoolCache 相关
#   ./check-cron-status.sh --logs             # 同时显示最近的日志

# ========== 配置区域 ==========
TIME_RANGE_HOURS=24         # 查询时间范围（小时）
REGION="us-east-1"          # AWS 区域
PROFILE="tbbeta"            # AWS CLI Profile，留空则使用默认 profile
FILTER=""                   # Lambda 名称过滤器
# ==============================
# ringprod:06:21, failed 6
# tbbeta:14:30, failed 3
set -e

# 解析命令行参数
SHOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--time)
            TIME_RANGE_HOURS="$2"
            shift 2
            ;;
        -f|--filter)
            FILTER="$2"
            shift 2
            ;;
        -l|--logs)
            SHOW_LOGS=true
            shift
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  -t, --time <小时>       查询时间范围 (默认: 24 小时)"
            echo "  -f, --filter <关键词>   只查看包含关键词的 Lambda"
            echo "  -l, --logs              显示最近的执行日志"
            echo "  -r, --region <region>   AWS 区域 (默认: us-east-1)"
            echo "      --profile <profile> AWS CLI Profile"
            echo "  -h, --help              显示帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                           # 查看最近 24 小时的调用情况"
            echo "  $0 -t 12                     # 查看最近 12 小时"
            echo "  $0 -f FEWV2                  # 只查看 FEWV2 相关"
            echo "  $0 -f PoolCache --logs       # 查看 PoolCache 并显示日志"
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            echo "使用 -h 或 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 构建 AWS CLI 基础命令
AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
fi

# 计算时间范围
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    START_TIME=$(date -u -v-${TIME_RANGE_HOURS}H +%Y-%m-%dT%H:%M:%SZ)
else
    # Linux
    START_TIME=$(date -u -d "${TIME_RANGE_HOURS} hours ago" +%Y-%m-%dT%H:%M:%SZ)
fi

echo "=========================================="
echo "定时任务执行状态查看"
echo "=========================================="
echo "时间范围: 最近 $TIME_RANGE_HOURS 小时"
echo "开始时间: $START_TIME"
echo "结束时间: $END_TIME"
echo "AWS 区域: $REGION"
echo "AWS Profile: ${PROFILE:-默认}"
if [ -n "$FILTER" ]; then
    echo "过滤关键词: $FILTER"
fi
echo "=========================================="
echo ""

# 获取所有 Pool Cache Lambda 函数
echo "📋 正在查询 Lambda 函数..."
echo ""

ALL_LAMBDAS=$($AWS_CMD lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'PoolCache')].{Name:FunctionName,Desc:Description}" \
    --output json 2>/dev/null)

if [ -z "$ALL_LAMBDAS" ] || [ "$ALL_LAMBDAS" = "[]" ]; then
    echo "❌ 未找到任何 Pool Cache Lambda 函数"
    exit 1
fi

# 过滤并收集 Lambda 函数
declare -a LAMBDA_NAMES
declare -a LAMBDA_CHAINS
declare -a LAMBDA_PROTOS

while IFS= read -r line; do
    NAME=$(echo "$line" | jq -r '.Name')
    DESC=$(echo "$line" | jq -r '.Desc')
    
    # 应用用户过滤器
    if [ -n "$FILTER" ] && ! echo "$NAME$DESC" | grep -qi "$FILTER"; then
        continue
    fi
    
    # 提取 chain 和 protocol
    if echo "$NAME" | grep -qE '^PoolCache-Chain[0-9]+-[A-Za-z0-9]+$'; then
        CHAIN=$(echo "$NAME" | sed -E 's/PoolCache-Chain([0-9]+)-.*/\1/')
        PROTO=$(echo "$NAME" | sed -E 's/PoolCache-Chain[0-9]+-//')
    else
        CHAIN=$(echo "$DESC" | grep -oE 'Chain(Id)? [0-9]+' | grep -oE '[0-9]+' | head -1)
        PROTO=$(echo "$DESC" | grep -oE '(Protocol |-) ?[A-Za-z0-9]+$' | sed -E 's/(Protocol |- ?)//')
    fi
    
    LAMBDA_NAMES+=("$NAME")
    LAMBDA_CHAINS+=("${CHAIN:-N/A}")
    LAMBDA_PROTOS+=("${PROTO:-N/A}")
done < <(echo "$ALL_LAMBDAS" | jq -c '.[]')

if [ ${#LAMBDA_NAMES[@]} -eq 0 ]; then
    echo "❌ 未找到匹配的 Lambda 函数"
    exit 1
fi

# 获取每个 Lambda 的调用统计
echo "📊 正在获取调用统计..."
echo ""
echo "================================================================================"
printf "%-40s %-8s %-8s %-10s %-10s %s\n" "Lambda 函数" "Chain" "Protocol" "调用次数" "错误次数" "最后调用"
echo "================================================================================"

for i in "${!LAMBDA_NAMES[@]}"; do
    NAME="${LAMBDA_NAMES[$i]}"
    CHAIN="${LAMBDA_CHAINS[$i]}"
    PROTO="${LAMBDA_PROTOS[$i]}"
    
    # 获取调用次数
    INVOCATIONS=$($AWS_CMD cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value="$NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period $((TIME_RANGE_HOURS * 3600)) \
        --statistics Sum \
        --region $REGION \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null)
    
    if [ "$INVOCATIONS" = "None" ] || [ -z "$INVOCATIONS" ]; then
        INVOCATIONS="0"
    else
        INVOCATIONS=$(printf "%.0f" "$INVOCATIONS")
    fi
    
    # 获取错误次数
    ERRORS=$($AWS_CMD cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value="$NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period $((TIME_RANGE_HOURS * 3600)) \
        --statistics Sum \
        --region $REGION \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null)
    
    if [ "$ERRORS" = "None" ] || [ -z "$ERRORS" ]; then
        ERRORS="0"
    else
        ERRORS=$(printf "%.0f" "$ERRORS")
    fi
    
    # 获取最后调用时间
    LAST_INVOCATION=$($AWS_CMD logs describe-log-streams \
        --log-group-name "/aws/lambda/$NAME" \
        --order-by LastEventTime \
        --descending \
        --limit 1 \
        --region $REGION \
        --query 'logStreams[0].lastEventTimestamp' \
        --output text 2>/dev/null)
    
    if [ "$LAST_INVOCATION" = "None" ] || [ -z "$LAST_INVOCATION" ]; then
        LAST_TIME="无记录"
    else
        # 转换时间戳（毫秒）为可读格式
        if [[ "$OSTYPE" == "darwin"* ]]; then
            LAST_TIME=$(date -r $((LAST_INVOCATION / 1000)) "+%m-%d %H:%M")
        else
            LAST_TIME=$(date -d @$((LAST_INVOCATION / 1000)) "+%m-%d %H:%M")
        fi
    fi
    
    # 截断过长的名称
    SHORT_NAME="$NAME"
    if [ ${#SHORT_NAME} -gt 38 ]; then
        SHORT_NAME="${SHORT_NAME:0:35}..."
    fi
    
    # 显示状态
    if [ "$ERRORS" -gt 0 ]; then
        STATUS="❌"
    elif [ "$INVOCATIONS" -eq 0 ]; then
        STATUS="⚠️"
    else
        STATUS="✅"
    fi
    
    printf "%-40s %-8s %-8s %-10s %-10s %s %s\n" "$SHORT_NAME" "$CHAIN" "$PROTO" "$INVOCATIONS" "$ERRORS" "$LAST_TIME" "$STATUS"
done

echo "================================================================================"
echo ""
echo "图例: ✅ 正常  ⚠️ 无调用  ❌ 有错误"
echo ""

# 显示最近的执行日志
if [ "$SHOW_LOGS" = true ]; then
    echo ""
    echo "📝 最近的执行日志:"
    echo "================================================================================"
    
    for i in "${!LAMBDA_NAMES[@]}"; do
        NAME="${LAMBDA_NAMES[$i]}"
        CHAIN="${LAMBDA_CHAINS[$i]}"
        PROTO="${LAMBDA_PROTOS[$i]}"
        
        echo ""
        echo "--- $NAME (Chain $CHAIN - $PROTO) ---"
        
        # 获取最近的日志事件
        LOGS=$($AWS_CMD logs filter-log-events \
            --log-group-name "/aws/lambda/$NAME" \
            --start-time $(($(date +%s) - TIME_RANGE_HOURS * 3600))000 \
            --filter-pattern "?ERROR ?error ?Error ?WARN ?warn ?Warn ?SUCCESS ?success ?Success ?Got ?pools" \
            --limit 5 \
            --region $REGION \
            --query 'events[].message' \
            --output text 2>/dev/null | head -10)
        
        if [ -z "$LOGS" ]; then
            echo "  (无相关日志)"
        else
            echo "$LOGS" | while IFS= read -r log; do
                # 截断过长的日志
                if [ ${#log} -gt 100 ]; then
                    echo "  ${log:0:100}..."
                else
                    echo "  $log"
                fi
            done
        fi
    done
    
    echo ""
    echo "================================================================================"
fi

echo ""
echo "💡 提示:"
echo "  - 使用 -l 或 --logs 参数查看详细执行日志"
echo "  - 使用 -t 参数调整时间范围，如 -t 12 查看最近 12 小时"
echo "  - 使用 -f 参数过滤特定 Lambda，如 -f FEWV2"
