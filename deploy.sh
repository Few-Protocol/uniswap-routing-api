#!/bin/bash

# 部署脚本
# 用法: ./deploy.sh -t beta 或 ./deploy.sh -t prod

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 解析参数
TARGET=""
while getopts "t:" opt; do
  case $opt in
    t)
      TARGET="$OPTARG"
      ;;
    \?)
      echo "用法: $0 -t beta|prod"
      exit 1
      ;;
  esac
done

# 检查参数
if [ -z "$TARGET" ]; then
  echo -e "${RED}错误: 必须指定 -t 参数 (beta 或 prod)${NC}"
  echo "用法: $0 -t beta|prod"
  exit 1
fi

if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
  echo -e "${RED}错误: -t 参数必须是 beta 或 prod${NC}"
  exit 1
fi

# 根据目标设置分支名
if [ "$TARGET" == "beta" ]; then
  BRANCH="ring_main"
  CDK_PROFILE=""
elif [ "$TARGET" == "prod" ]; then
  BRANCH="ring_main_prod"
  CDK_PROFILE="--profile ringprod"
fi

echo -e "${GREEN}开始部署到 ${TARGET} 环境...${NC}"
echo -e "${YELLOW}目标分支: ${BRANCH}${NC}"

# 1. 检查是否有未提交的更改
echo -e "\n${YELLOW}[1/5] 检查本地更改...${NC}"
if ! git diff-index --quiet HEAD --; then
  echo -e "${RED}错误: 检测到未提交的更改，请先提交或暂存更改${NC}"
  echo "未提交的文件:"
  git status --short
  exit 1
fi
echo -e "${GREEN}✓ 本地工作区干净${NC}"

# 2. 切换到目标分支
echo -e "\n${YELLOW}[2/5] 切换到分支 ${BRANCH}...${NC}"
git checkout "$BRANCH"
echo -e "${GREEN}✓ 已切换到 ${BRANCH}${NC}"

# 3. 拉取最新代码
echo -e "\n${YELLOW}[3/5] 拉取最新代码...${NC}"
git pull origin "$BRANCH"
echo -e "${GREEN}✓ 代码已更新到最新${NC}"

# 再次检查是否有未提交的更改（拉取后可能产生冲突）
if ! git diff-index --quiet HEAD --; then
  echo -e "${RED}错误: 拉取后检测到未提交的更改，可能存在冲突，请手动处理${NC}"
  git status --short
  exit 1
fi

# 4. 安装依赖并构建
echo -e "\n${YELLOW}[4/5] 安装依赖并构建...${NC}"
npm install
npm run build
echo -e "${GREEN}✓ 构建完成${NC}"

# 5. 部署
echo -e "\n${YELLOW}[5/5] 部署到 AWS...${NC}"
if [ -n "$CDK_PROFILE" ]; then
  echo -e "${YELLOW}使用 AWS profile: ringprod${NC}"
  cdk deploy RoutingAPIStack $CDK_PROFILE
else
  cdk deploy RoutingAPIStack
fi

echo -e "\n${GREEN}✓ 部署完成！${NC}"

