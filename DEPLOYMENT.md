# Uniswap Routing API - AWS 部署指南

本文档详细说明如何将 Uniswap Routing API 部署到 AWS。

## 前置条件

- Node.js (建议使用 `.nvmrc` 文件中指定的版本)
- npm 或 yarn
- AWS 账号和安全凭证 (Access Key ID 和 Secret Access Key)
- 具有必要权限的 IAM 用户 (建议权限：AdministratorAccess 或 CloudFormation、Lambda、API Gateway、DynamoDB 等服务的完整权限)

## 步骤 1: 安装 AWS CLI

如果还没有安装 AWS CLI，请先安装：

### macOS
```bash
brew install awscli
```

### Linux
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 验证安装
```bash
aws --version
```

## 步骤 2: 配置 AWS 凭证

使用以下命令配置您的 AWS 凭证：

```bash
aws configure
```

系统会提示您输入以下信息：

```
AWS Access Key ID [None]: <输入您的 Access Key ID>
AWS Secret Access Key [None]: <输入您的 Secret Access Key>
Default region name [None]: us-east-1
Default output format [None]: json
```

**推荐区域：** `us-east-1`（美国东部）或 `ap-southeast-1`（新加坡，如果您在亚洲）

### 验证凭证配置
```bash
aws sts get-caller-identity
```

如果配置成功，您会看到类似以下的输出：
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### 多配置文件管理（可选）

如果您需要管理多个 AWS 账号，可以使用命名配置文件：

```bash
# 创建名为 "uniswap" 的配置文件
aws configure --profile uniswap

# 使用特定配置文件部署
export AWS_PROFILE=uniswap
```

## 步骤 3: 安装项目依赖

```bash
# 使用推荐的 Node.js 版本（如果安装了 nvm）
nvm use

# 安装依赖
npm install
```

## 步骤 4: 配置环境变量

创建 `.env` 文件并配置必要的环境变量：

```bash
# 复制默认配置模板
cp env_default .env
```

编辑 `.env` 文件，至少需要配置以下内容：

```bash
# 主网 RPC (必需) - 您需要从 Infura、Alchemy 或其他 RPC 提供商获取
WEB3_RPC_1=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# 其他链的 RPC（根据需要配置）
WEB3_RPC_10=  # Optimism
WEB3_RPC_42161=  # Arbitrum One
WEB3_RPC_137=  # Polygon
WEB3_RPC_56=  # BNB Chain
WEB3_RPC_8453=  # Base
WEB3_RPC_81457=  # Blast
WEB3_RPC_324=  # zkSync

# Tenderly 配置（用于 gas 估算模拟，可选但推荐）
TENDERLY_USER=
TENDERLY_PROJECT=
TENDERLY_ACCESS_KEY=
TENDERLY_NODE_API_KEY=

# 限流配置（可选）
THROTTLE_PER_FIVE_MINS=100
```

**重要提示：** 
- 至少需要配置 `WEB3_RPC_1`（以太坊主网）
- 您可以从 [Infura](https://infura.io/)、[Alchemy](https://www.alchemy.com/) 或 [QuickNode](https://www.quicknode.com/) 获取免费的 RPC 端点

## 步骤 5: 构建项目

```bash
npm run build
```

## 步骤 6: 安装 AWS CDK

如果还没有全局安装 AWS CDK，请安装：

```bash
npm install -g aws-cdk
```

验证安装：
```bash
cdk --version
```

## 步骤 7: CDK Bootstrap（首次部署必需）

**重要：** 首次在某个 AWS 账号和区域使用 CDK 时，必须先进行 bootstrap。

```bash
cdk bootstrap
```

该命令会在您的 AWS 账号中创建必要的基础设施（S3 桶、IAM 角色等）用于 CDK 部署。

如果需要为特定账号和区域进行 bootstrap：
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
# 例如：cdk bootstrap aws://123456789012/us-east-1
```

**注意：** Bootstrap 操作只需要执行一次，后续在同一账号和区域的部署不需要再次执行。

## 步骤 8: 预览部署变更（可选但推荐）

在实际部署前，可以先查看将要创建的资源：

```bash
cdk diff RoutingAPIStack
```

## 步骤 9: 部署 API

现在可以部署 API 了：

```bash
cdk deploy RoutingAPIStack
```

部署过程可能需要 5-15 分钟。CDK 会：
1. 合成 CloudFormation 模板
2. 上传资源到 S3
3. 创建 CloudFormation 栈
4. 部署 Lambda 函数、API Gateway、DynamoDB 表等资源

部署完成后，您会看到类似以下的输出：

```
✅  RoutingAPIStack

Outputs:
RoutingAPIStack.Url = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/RoutingAPIStack/...
```

**记录 API URL**，您将需要它来测试 API。

## 步骤 10: 测试部署的 API

使用 curl 或其他 HTTP 客户端测试 API：

```bash
curl --request GET 'https://YOUR_API_URL/quote?tokenInAddress=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenInChainId=1&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=1&amount=1000000000000000000&type=exactIn'
```

参数说明：
- `tokenInAddress`: 输入代币地址（示例中为 WETH）
- `tokenInChainId`: 输入代币链 ID（1 = 以太坊主网）
- `tokenOutAddress`: 输出代币地址（示例中为 UNI）
- `tokenOutChainId`: 输出代币链 ID
- `amount`: 数量（Wei 单位）
- `type`: 交易类型（`exactIn` 或 `exactOut`）

## 部署其他栈（可选）

该项目包含多个栈，您可以根据需要部署：

```bash
# 部署所有栈
cdk deploy --all

# 或单独部署特定栈
cdk deploy RoutingCachingStack
cdk deploy RoutingDashboardStack
cdk deploy RoutingDatabaseStack
cdk deploy RPCGatewayFallbackStack
```

查看所有可用的栈：
```bash
cdk list
```

## 更新现有部署

当您修改代码后，重新部署：

```bash
# 重新构建
npm run build

# 重新部署
cdk deploy RoutingAPIStack
```

## 删除部署

如果需要删除所有 AWS 资源：

```bash
cdk destroy RoutingAPIStack

# 删除所有栈
cdk destroy --all
```

**警告：** 这将删除所有相关的 AWS 资源，包括数据库中的数据。

## 监控和日志

### 查看日志

1. 登录 [AWS CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
2. 选择 "Logs" → "Log groups"
3. 查找 `/aws/lambda/RoutingAPIStack-*` 相关的日志组

### 查看 API Gateway 指标

1. 登录 [AWS API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. 选择您的 API
3. 点击 "Stages" → "Metrics" 查看请求量、延迟等指标

### 查看 Lambda 指标

1. 登录 [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. 选择您的函数
3. 点击 "Monitor" 标签查看调用次数、错误、持续时间等

## 成本估算

AWS 资源成本主要包括：
- **Lambda**: 按请求次数和执行时间计费
- **API Gateway**: 按 API 调用次数计费
- **DynamoDB**: 按读写容量和存储计费
- **CloudWatch**: 日志存储和查询

**免费套餐：** 如果是新 AWS 账号，许多服务在一定限额内是免费的。

**成本控制建议：**
- 设置 AWS 预算警报
- 定期查看 AWS Cost Explorer
- 测试完成后及时删除不需要的资源

## 常见问题

### 1. Bootstrap 失败

**问题：** `cdk bootstrap` 失败，提示权限不足

**解决：** 确保您的 IAM 用户有足够的权限，至少需要以下服务的访问权限：
- CloudFormation
- S3
- IAM
- Systems Manager

### 2. 部署超时

**问题：** 部署过程中超时

**解决：** 
```bash
# 增加超时时间
cdk deploy --require-approval never --timeout 30
```

### 3. RPC 端点错误

**问题：** API 返回 RPC 相关错误

**解决：** 检查 `.env` 文件中的 `WEB3_RPC_*` 配置是否正确，确保 RPC 端点可访问

### 4. 区域不匹配

**问题：** 资源创建在错误的区域

**解决：** 
```bash
# 在部署时指定区域
AWS_REGION=us-east-1 cdk deploy RoutingAPIStack
```

### 5. 清理 CDK Bootstrap 资源

**问题：** 如何完全清理 CDK 创建的资源

**解决：**
1. 先删除所有部署的栈：`cdk destroy --all`
2. 手动删除 CloudFormation 中的 `CDKToolkit` 栈
3. 删除对应的 S3 桶（名称类似 `cdk-*-assets-*`）

## 安全建议

1. **不要提交敏感信息到版本控制：** 确保 `.env` 文件在 `.gitignore` 中
2. **使用 AWS Secrets Manager：** 对于生产环境，考虑使用 Secrets Manager 管理敏感配置
3. **限制 API 访问：** 考虑添加 API Key 或 WAF 规则
4. **定期轮换凭证：** 定期更换 AWS 访问密钥
5. **最小权限原则：** 仅授予必要的 IAM 权限

## 生产环境部署建议

1. **使用多阶段部署：** 创建 dev、staging、prod 等多个环境
2. **配置自动扩缩容：** 根据流量自动调整 Lambda 并发数
3. **启用 CloudWatch 告警：** 监控错误率、延迟等关键指标
4. **配置 DynamoDB 备份：** 启用自动备份保护数据
5. **使用自定义域名：** 通过 Route 53 配置自定义域名
6. **启用 X-Ray：** 用于分布式追踪和性能分析

## 相关链接

- [AWS CLI 文档](https://docs.aws.amazon.com/cli/)
- [AWS CDK 文档](https://docs.aws.amazon.com/cdk/)
- [Uniswap Routing API GitHub](https://github.com/Uniswap/routing-api)
- [Infura RPC 服务](https://infura.io/)
- [Alchemy RPC 服务](https://www.alchemy.com/)

## 获取帮助

如果遇到问题：
1. 查看 CloudWatch 日志中的错误信息
2. 检查 CloudFormation 栈事件查看部署失败原因
3. 查看项目的 GitHub Issues
4. 确保所有依赖和环境变量配置正确

---

祝部署顺利！🚀
