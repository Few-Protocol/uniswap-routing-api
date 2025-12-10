# AWS 部署快速启动 - 命令清单

本文档提供最精简的部署命令清单，详细说明请参考 `DEPLOYMENT.md`。

## 📋 前置检查清单

- [ ] 已有 AWS 账号和安全凭证（Access Key ID 和 Secret Access Key）
- [ ] 已安装 Node.js
- [ ] 已准备好 RPC 端点（如 Infura 或 Alchemy）

## 🚀 快速部署步骤

### 1. 安装 AWS CLI（如未安装）

```bash
# macOS
brew install awscli

# 验证
aws --version
```

### 2. 配置 AWS 凭证

```bash
aws configure
```

输入信息：
```
AWS Access Key ID: <您的密钥>
AWS Secret Access Key: <您的密文>
Default region name: us-east-1
Default output format: json
```

验证配置：
```bash
aws sts get-caller-identity
```

### 3. 安装项目依赖

```bash
# 使用推荐的 Node 版本（可选）
nvm use

# 安装依赖
npm install
```

### 4. 配置环境变量

```bash
# 复制模板
cp env_default .env

# 编辑 .env 文件，至少配置以下内容：
# WEB3_RPC_1=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
```

最小配置示例（`.env` 文件）：
```bash
WEB3_RPC_1=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID
THROTTLE_PER_FIVE_MINS=100
```

### 5. 构建项目

```bash
npm run build
```

### 6. 安装 AWS CDK（如未安装）

```bash
npm install -g aws-cdk

# 验证
cdk --version
```

### 7. CDK Bootstrap（首次部署必需）

```bash
cdk bootstrap
```

> ⚠️ 此命令只需在首次使用 CDK 时执行一次

### 8. 部署 API

```bash
# 预览变更（可选）
cdk diff RoutingAPIStack

# 执行部署
cdk deploy RoutingAPIStack
```

### 9. 测试 API

部署成功后，使用输出的 URL 测试：

```bash
# 替换 YOUR_API_URL 为实际的 API 地址
curl --request GET 'https://YOUR_API_URL/quote?tokenInAddress=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenInChainId=1&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=1&amount=1000000000000000000&type=exactIn'
```

## 🔄 更新部署

```bash
# 修改代码后重新构建和部署
npm run build
cdk deploy RoutingAPIStack
```

## 🗑️ 删除部署

```bash
# 删除单个栈
cdk destroy RoutingAPIStack

# 删除所有栈
cdk destroy --all
```

## 📝 常用命令

```bash
# 查看所有可部署的栈
cdk list

# 查看栈的差异
cdk diff RoutingAPIStack

# 合成 CloudFormation 模板（不部署）
cdk synth RoutingAPIStack

# 查看 AWS 账号信息
aws sts get-caller-identity

# 查看已配置的 AWS 配置文件
cat ~/.aws/credentials

# 运行本地测试
npm run test:unit
```

## ⚡ 完整命令流（首次部署）

```bash
# 1. 配置 AWS
aws configure

# 2. 安装和构建
npm install
npm run build

# 3. 安装 CDK（全局）
npm install -g aws-cdk

# 4. Bootstrap（首次）
cdk bootstrap

# 5. 部署
cdk deploy RoutingAPIStack
```

## 🔍 故障排查命令

```bash
# 查看 CloudFormation 栈状态
aws cloudformation describe-stacks --stack-name RoutingAPIStack

# 查看 CloudFormation 栈事件
aws cloudformation describe-stack-events --stack-name RoutingAPIStack --max-items 10

# 查看 Lambda 函数列表
aws lambda list-functions --query 'Functions[?contains(FunctionName, `RoutingAPI`)].FunctionName'

# 查看 API Gateway 列表
aws apigateway get-rest-apis

# 查看最近的 Lambda 日志
aws logs tail /aws/lambda/FUNCTION_NAME --follow
```

## 💡 实用技巧

### 使用命名配置文件

```bash
# 创建命名配置
aws configure --profile uniswap

# 使用配置
export AWS_PROFILE=uniswap
cdk deploy RoutingAPIStack

# 或一次性使用
AWS_PROFILE=uniswap cdk deploy RoutingAPIStack
```

### 指定区域部署

```bash
AWS_REGION=ap-southeast-1 cdk bootstrap
AWS_REGION=ap-southeast-1 cdk deploy RoutingAPIStack
```

### 自动批准部署

```bash
cdk deploy RoutingAPIStack --require-approval never
```

### 部署多个栈

```bash
# 部署所有栈
cdk deploy --all

# 部署多个指定栈
cdk deploy RoutingAPIStack RoutingCachingStack
```

## 📊 监控命令

```bash
# 查看 Lambda 调用次数（最近1小时）
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=YOUR_FUNCTION_NAME \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# 查看 API Gateway 请求数
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=RoutingAPIStack \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## 🔐 安全提醒

- ✅ 确保 `.env` 文件已在 `.gitignore` 中
- ✅ 不要将 AWS 凭证提交到代码仓库
- ✅ 定期轮换 AWS 访问密钥
- ✅ 使用 IAM 最小权限原则

## 📚 更多信息

详细说明、故障排查和生产环境建议，请查看 `DEPLOYMENT.md`。

---

**提示：** 保存部署后的 API URL，您会需要它来调用 API！
