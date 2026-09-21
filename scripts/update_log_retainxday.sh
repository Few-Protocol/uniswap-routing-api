#!/bin/bash

# ==========================================
# CloudWatch Logs 日志保留时间更新脚本
# ==========================================
# 用于批量更新 CloudWatch Logs 日志组的保留时间
#
# 用法:
#   ./update_log_retainxday.sh                    # 使用默认配置（1天）
#   ./update_log_retainxday.sh -d 7               # 设置保留 7 天
#   ./update_log_retainxday.sh -d 14 --list       # 仅列出日志组，不更新
#   ./update_log_retainxday.sh -f "PoolCache"     # 只更新包含 "PoolCache" 的日志组
#   ./update_log_retainxday.sh --all              # 更新所有 RoutingAPI 相关日志组

# ========== 配置区域 ==========
RETENTION_DAYS=1            # 日志保留天数 (有效值: 1,3,5,7,14,30,60,90,120,150,180,365,400,545,731,1096,1827,2192,2557,2922,3288,3653)
REGION="us-east-1"          # AWS 区域
PROFILE="tbbeta"            # AWS CLI Profile，留空则使用默认 profile
FILTER=""                   # 日志组名称过滤器，留空则匹配所有 RoutingAPI 相关日志组
# ==============================

set -e

# 有效的保留天数
VALID_RETENTION_DAYS=(1 3 5 7 14 30 60 90 120 150 180 365 400 545 731 1096 1827 2192 2557 2922 3288 3653)

# 解析命令行参数
LIST_ONLY=false
UPDATE_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--days)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -f|--filter)
            FILTER="$2"
            shift 2
            ;;
        -l|--list)
            LIST_ONLY=true
            shift
            ;;
        -a|--all)
            UPDATE_ALL=true
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
            echo "  -d, --days <天数>       日志保留天数 (默认: 1)"
            echo "                          有效值: 1,3,5,7,14,30,60,90,120,150,180,365,..."
            echo "  -f, --filter <关键词>   只更新包含关键词的日志组"
            echo "  -l, --list              仅列出日志组，不更新"
            echo "  -a, --all               更新所有匹配的日志组（跳过确认）"
            echo "  -r, --region <region>   AWS 区域 (默认: us-east-1)"
            echo "      --profile <profile> AWS CLI Profile"
            echo "  -h, --help              显示帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                           # 列出并更新为保留 1 天"
            echo "  $0 -d 7                      # 列出并更新为保留 7 天"
            echo "  $0 -d 1 -f PoolCache         # 只更新 PoolCache 相关日志组"
            echo "  $0 -d 1 --all                # 更新所有日志组，跳过确认"
            echo "  $0 --list                    # 仅列出日志组"
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            echo "使用 -h 或 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 验证保留天数是否有效
is_valid_retention() {
    local days=$1
    for valid in "${VALID_RETENTION_DAYS[@]}"; do
        if [ "$days" -eq "$valid" ]; then
            return 0
        fi
    done
    return 1
}

if ! is_valid_retention "$RETENTION_DAYS"; then
    echo "❌ 错误: 无效的保留天数 '$RETENTION_DAYS'"
    echo "有效值: ${VALID_RETENTION_DAYS[*]}"
    exit 1
fi

# 构建 AWS CLI 基础命令
AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
fi

echo "=========================================="
echo "CloudWatch Logs 日志保留时间更新脚本"
echo "=========================================="
echo "目标保留天数: $RETENTION_DAYS 天"
echo "AWS 区域: $REGION"
echo "AWS Profile: ${PROFILE:-默认}"
if [ -n "$FILTER" ]; then
    echo "过滤关键词: $FILTER"
fi
echo "=========================================="
echo ""

# 获取所有 RoutingAPI 相关的日志组
echo "📋 正在查找日志组..."
echo ""

# 构建查询条件
# 默认查找包含 "Routing" 或 "PoolCache" 的日志组
LOG_GROUPS=$($AWS_CMD logs describe-log-groups --region $REGION \
    --query "logGroups[].{Name:logGroupName,Retention:retentionInDays}" \
    --output json 2>/dev/null)

if [ -z "$LOG_GROUPS" ] || [ "$LOG_GROUPS" = "[]" ]; then
    echo "❌ 未找到任何日志组"
    exit 1
fi

# 过滤日志组
declare -a LOG_GROUP_NAMES
declare -a LOG_GROUP_RETENTIONS

while IFS= read -r line; do
    NAME=$(echo "$line" | jq -r '.Name')
    RETENTION=$(echo "$line" | jq -r '.Retention // "永不过期"')
    
    # 检查是否是 RoutingAPI 相关的日志组
    if ! echo "$NAME" | grep -qiE "(routing|poolcache)"; then
        continue
    fi
    
    # 应用用户过滤器
    if [ -n "$FILTER" ] && ! echo "$NAME" | grep -qi "$FILTER"; then
        continue
    fi
    
    LOG_GROUP_NAMES+=("$NAME")
    LOG_GROUP_RETENTIONS+=("$RETENTION")
done < <(echo "$LOG_GROUPS" | jq -c '.[]')

if [ ${#LOG_GROUP_NAMES[@]} -eq 0 ]; then
    echo "❌ 未找到匹配的日志组"
    if [ -n "$FILTER" ]; then
        echo "提示: 尝试使用不同的过滤关键词，或不使用 -f 参数"
    fi
    exit 1
fi

# 显示找到的日志组
echo "找到以下日志组:"
echo "--------------------------------------------------------------------------------"
printf "%-4s %-60s %s\n" "序号" "日志组名称" "当前保留"
echo "--------------------------------------------------------------------------------"
for i in "${!LOG_GROUP_NAMES[@]}"; do
    # 截断过长的名称
    NAME="${LOG_GROUP_NAMES[$i]}"
    if [ ${#NAME} -gt 58 ]; then
        NAME="${NAME:0:55}..."
    fi
    printf "%-4s %-60s %s\n" "$((i+1))" "$NAME" "${LOG_GROUP_RETENTIONS[$i]}"
done
echo "--------------------------------------------------------------------------------"
echo "共 ${#LOG_GROUP_NAMES[@]} 个日志组"
echo ""

# 如果只是列出，则退出
if [ "$LIST_ONLY" = true ]; then
    echo "✅ 列出完成 (使用 --list 模式)"
    exit 0
fi

# 确认更新
if [ "$UPDATE_ALL" = false ]; then
    echo "⚠️  即将把以上 ${#LOG_GROUP_NAMES[@]} 个日志组的保留时间更新为 $RETENTION_DAYS 天"
    echo ""
    echo "请选择操作:"
    echo "  1) 更新所有日志组"
    echo "  2) 选择特定日志组更新"
    echo "  3) 取消操作"
    read -p "请输入选项 (1/2/3): " CHOICE
    
    case $CHOICE in
        1)
            # 更新所有
            ;;
        2)
            # 选择特定日志组
            read -p "请输入要更新的日志组序号 (用逗号分隔，如 1,3,5): " SELECTED
            IFS=',' read -ra SELECTED_INDICES <<< "$SELECTED"
            
            # 过滤选中的日志组
            declare -a SELECTED_NAMES
            for idx in "${SELECTED_INDICES[@]}"; do
                idx=$((idx - 1))  # 转换为 0-based 索引
                if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#LOG_GROUP_NAMES[@]}" ]; then
                    SELECTED_NAMES+=("${LOG_GROUP_NAMES[$idx]}")
                fi
            done
            
            if [ ${#SELECTED_NAMES[@]} -eq 0 ]; then
                echo "❌ 未选择任何有效的日志组"
                exit 1
            fi
            
            # 替换为选中的日志组
            LOG_GROUP_NAMES=("${SELECTED_NAMES[@]}")
            echo ""
            echo "将更新以下 ${#LOG_GROUP_NAMES[@]} 个日志组:"
            for name in "${LOG_GROUP_NAMES[@]}"; do
                echo "  - $name"
            done
            echo ""
            ;;
        *)
            echo "操作已取消"
            exit 0
            ;;
    esac
fi

# 执行更新
echo ""
echo "🚀 开始更新日志保留时间..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for name in "${LOG_GROUP_NAMES[@]}"; do
    echo -n "  更新: $name ... "
    
    RESULT=$($AWS_CMD logs put-retention-policy \
        --log-group-name "$name" \
        --retention-in-days $RETENTION_DAYS \
        --region $REGION 2>&1) || true
    
    if [ -z "$RESULT" ]; then
        echo "✅ 成功"
        ((SUCCESS_COUNT++))
    else
        echo "❌ 失败: $RESULT"
        ((FAIL_COUNT++))
    fi
done

echo ""
echo "=========================================="
echo "更新完成"
echo "  成功: $SUCCESS_COUNT"
echo "  失败: $FAIL_COUNT"
echo "  新保留时间: $RETENTION_DAYS 天"
echo "=========================================="
