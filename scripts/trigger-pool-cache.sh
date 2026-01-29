#!/bin/bash

# ==========================================
# Pool Cache Lambda 手动触发脚本
# ==========================================
# 用于手动触发 pool cache cron job，立即更新 S3 中的池子缓存
#
# 用法:
#   ./trigger-pool-cache.sh                           # 列出所有可用的 Lambda
#   ./trigger-pool-cache.sh -c 1                      # 触发 chainId=1 的所有协议
#   ./trigger-pool-cache.sh -c 1 -p FEWV2             # 触发 chainId=1, protocol=FEWV2
#   ./trigger-pool-cache.sh -c 1 -p V3                # 触发 chainId=1, protocol=V3
#   ./trigger-pool-cache.sh --list                    # 仅列出所有 Lambda，不触发

# ========== 配置区域 ==========
REGION="us-east-1"          # AWS 区域
PROFILE="tbbeta"            # AWS CLI Profile，留空则使用默认 profile
# ==============================

set -e

# 解析命令行参数
CHAIN_ID=""
PROTOCOL=""
LIST_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--chainid)
            CHAIN_ID="$2"
            shift 2
            ;;
        -p|--protocol)
            PROTOCOL="$2"
            shift 2
            ;;
        -l|--list)
            LIST_ONLY=true
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
            echo "  -c, --chainid <id>      指定 chainId (例如: 1, 137, 42161)"
            echo "  -p, --protocol <proto>  指定协议 (例如: V2, V3, V4, FEWV2)"
            echo "  -l, --list              仅列出所有 Lambda，不触发"
            echo "  -r, --region <region>   AWS 区域 (默认: us-east-1)"
            echo "      --profile <profile> AWS CLI Profile"
            echo "  -h, --help              显示帮助信息"
            echo ""
            echo "示例:"
            echo "  $0 --list                    # 列出所有 pool cache Lambda"
            echo "  $0 -c 1                      # 触发 chainId=1 的所有协议"
            echo "  $0 -c 1 -p FEWV2             # 触发 chainId=1, protocol=FEWV2"
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

echo "=========================================="
echo "Pool Cache Lambda 手动触发脚本"
echo "=========================================="
echo "AWS 区域: $REGION"
echo "AWS Profile: ${PROFILE:-默认}"
if [ -n "$CHAIN_ID" ]; then
    echo "Chain ID: $CHAIN_ID"
fi
if [ -n "$PROTOCOL" ]; then
    echo "Protocol: $PROTOCOL"
fi
echo "=========================================="
echo ""

# 列出所有 pool cache Lambda 函数
echo "📋 正在查找 Pool Cache Lambda 函数..."
echo ""

# 获取所有 pool cache Lambda 函数（包含名称和描述）
# 支持两种命名格式:
#   - 旧格式 (被截断): RoutingAPIStack-RoutingCa-PoolCacheLambdaChainId1P-xxx
#   - 新格式: PoolCache-Chain1-FEWV2
ALL_LAMBDAS=$($AWS_CMD lambda list-functions --region $REGION \
    --query "Functions[?contains(FunctionName, 'PoolCache')].{Name:FunctionName,Desc:Description}" \
    --output json 2>/dev/null)

if [ -z "$ALL_LAMBDAS" ] || [ "$ALL_LAMBDAS" = "[]" ]; then
    echo "❌ 未找到任何 Pool Cache Lambda 函数"
    echo ""
    echo "提示: 请检查:"
    echo "  1. AWS Profile 和 Region 是否正确"
    echo "  2. Lambda 函数是否已部署"
    exit 1
fi

# 根据 chainId 和 protocol 过滤
# Description 格式: "Pool Cache Lambda for Chain with ChainId X and Protocol Y"
declare -a LAMBDA_ARRAY
declare -a LAMBDA_INFO

while IFS= read -r line; do
    NAME=$(echo "$line" | jq -r '.Name')
    DESC=$(echo "$line" | jq -r '.Desc')
    
    # 尝试从函数名提取 chainId 和 protocol (新格式: PoolCache-Chain1-FEWV2)
    if echo "$NAME" | grep -qE '^PoolCache-Chain[0-9]+-[A-Za-z0-9]+$'; then
        EXTRACTED_CHAIN=$(echo "$NAME" | sed -E 's/PoolCache-Chain([0-9]+)-.*/\1/')
        EXTRACTED_PROTO=$(echo "$NAME" | sed -E 's/PoolCache-Chain[0-9]+-//')
    else
        # 从 Description 中提取 (旧格式)
        # Description 格式: "Pool Cache Lambda for Chain X - Y" 或 "Pool Cache Lambda for Chain with ChainId X and Protocol Y"
        EXTRACTED_CHAIN=$(echo "$DESC" | grep -oE 'Chain(Id)? [0-9]+' | grep -oE '[0-9]+')
        EXTRACTED_PROTO=$(echo "$DESC" | grep -oE '(Protocol |-) ?[A-Za-z0-9]+$' | sed -E 's/(Protocol |- ?)//')
    fi
    
    # 检查是否匹配过滤条件
    MATCH=true
    if [ -n "$CHAIN_ID" ] && [ "$EXTRACTED_CHAIN" != "$CHAIN_ID" ]; then
        MATCH=false
    fi
    if [ -n "$PROTOCOL" ] && [ "$EXTRACTED_PROTO" != "$PROTOCOL" ]; then
        MATCH=false
    fi
    
    if [ "$MATCH" = true ]; then
        LAMBDA_ARRAY+=("$NAME")
        LAMBDA_INFO+=("Chain: $EXTRACTED_CHAIN, Protocol: $EXTRACTED_PROTO")
    fi
done < <(echo "$ALL_LAMBDAS" | jq -c '.[]')

if [ ${#LAMBDA_ARRAY[@]} -eq 0 ]; then
    echo "❌ 未找到匹配的 Lambda 函数"
    echo ""
    echo "提示: 请检查:"
    echo "  1. chainId 和 protocol 参数是否正确"
    echo "  2. 使用 --list 查看所有可用的 Lambda"
    exit 1
fi

# 显示找到的 Lambda
echo "找到以下 Lambda 函数:"
echo "----------------------------------------"
for i in "${!LAMBDA_ARRAY[@]}"; do
    echo "  $((i+1))) ${LAMBDA_ARRAY[$i]}"
    echo "     ${LAMBDA_INFO[$i]}"
done
echo "----------------------------------------"
echo ""

# 如果只是列出，则退出
if [ "$LIST_ONLY" = true ]; then
    echo "✅ 列出完成 (使用 --list 模式)"
    exit 0
fi

# 计算匹配的 Lambda 数量
LAMBDA_COUNT=${#LAMBDA_ARRAY[@]}

if [ $LAMBDA_COUNT -eq 0 ]; then
    echo "❌ 未找到匹配的 Lambda 函数"
    exit 1
fi

# 确认触发
echo "⚠️  即将触发以上 $LAMBDA_COUNT 个 Lambda 函数"
read -p "确认触发? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "🚀 开始触发 Lambda 函数..."
echo ""

# 创建模拟的 EventBridge 事件
EVENT_PAYLOAD='{
  "version": "0",
  "id": "manual-trigger-'$(date +%s)'",
  "detail-type": "Scheduled Event",
  "source": "aws.events",
  "account": "000000000000",
  "time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "region": "'$REGION'",
  "resources": [],
  "detail": {}
}'

# 触发每个 Lambda
SUCCESS_COUNT=0
FAIL_COUNT=0

for lambda in "${LAMBDA_ARRAY[@]}"; do
    echo "  触发: $lambda"
    
    # 使用 invoke 命令异步触发 Lambda
    RESULT=$($AWS_CMD lambda invoke \
        --function-name "$lambda" \
        --invocation-type Event \
        --payload "$(echo "$EVENT_PAYLOAD" | base64)" \
        --region $REGION \
        /dev/null 2>&1) || true
    
    # 检查是否成功 (Event 类型调用成功返回 202)
    if echo "$RESULT" | grep -q "202\|StatusCode"; then
        echo "    ✅ 触发成功 (异步执行中)"
        ((SUCCESS_COUNT++))
    else
        echo "    ❌ 触发失败: $RESULT"
        ((FAIL_COUNT++))
    fi
done

echo ""
echo "=========================================="
echo "触发完成"
echo "  成功: $SUCCESS_COUNT"
echo "  失败: $FAIL_COUNT"
echo "=========================================="
echo ""
echo "💡 提示: Lambda 正在异步执行，可以通过 CloudWatch Logs 查看执行日志"
echo "   日志组名格式: /aws/lambda/<lambda-function-name>"
