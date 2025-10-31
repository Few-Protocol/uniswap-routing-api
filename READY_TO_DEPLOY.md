# 🚀 Uniswap Routing API - 准备部署

## ✅ 完成的准备工作

### 1. 环境变量配置 (`.env`)
- ✓ 所有 RPC Gateway 必需变量（QUICKNODE_*, ALCHEMY_*, UNIRPC_0）
- ✓ 格式已修正为代码要求的格式
- ✓ 使用您的 Infura key: `Q3EUEtQ0XUKtceDSkJNfX`
- ✓ 使用您的 Tenderly 配置
- ✓ **关键修复**：补充了导致启动失败的 `QUICKNODE_42220`

### 2. 部署脚本 (`deploy-clean.sh`)
- ✓ 自动清理失败的旧堆栈
- ✓ 自动构建和部署
- ✓ 显示 API 端点和测试命令
- ✓ 彩色输出，易于跟踪进度

### 3. 文档
- ✓ `ENV_SETUP_GUIDE.md` - 环境变量配置指南
- ✓ `DEPLOY_INSTRUCTIONS.md` - 详细部署步骤
- ✓ `READY_TO_DEPLOY.md` - 本文档

---

## 🎯 立即开始部署

### 一键部署（推荐）

```bash
./deploy-clean.sh
```

这个脚本会自动完成所有步骤，大约需要 10-15 分钟。

### 手动部署

如果您想手动控制每一步：

```bash
# 1. 删除旧堆栈（如果存在）
aws cloudformation delete-stack --stack-name RoutingAPIStack --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name RoutingAPIStack --region us-east-1

# 2. 构建
npm run build

# 3. 部署
cdk deploy RoutingAPIStack --require-approval never
```

---

## 🔍 部署后验证

### 1. 获取 API 端点

```bash
aws cloudformation describe-stacks \
  --stack-name RoutingAPIStack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`Url`].OutputValue' \
  --output text
```

### 2. 测试 Quote API

```bash
# 替换 YOUR-API-ENDPOINT 为实际端点
curl "https://YOUR-API-ENDPOINT/prod/quote?tokenInAddress=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenInChainId=1&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=1&amount=100&type=exactIn"
```

**预期成功响应：**
```json
{
  "quote": "...",
  "quoteGasAdjusted": "...",
  "route": [...],
  "routeString": "..."
}
```

### 3. 查看 Lambda 日志

```bash
# 查找 Lambda 函数
aws lambda list-functions --region us-east-1 \
  --query 'Functions[?contains(FunctionName, `RoutingLambda`)].FunctionName'

# 实时查看日志
aws logs tail /aws/lambda/YOUR-FUNCTION-NAME \
  --follow --since 5m --region us-east-1
```

---

## 🐛 故障排查

### 问题 1: "Internal server error"

**原因**: Lambda 启动失败（通常是环境变量问题）

**解决方案**:
```bash
# 检查 Lambda 环境变量
aws lambda get-function-configuration \
  --function-name YOUR-FUNCTION-NAME \
  --region us-east-1 \
  --query 'Environment.Variables' | grep QUICKNODE_42220
```

**如果变量缺失**，重新部署：
```bash
./deploy-clean.sh
```

### 问题 2: DynamoDB 表已存在

**原因**: 之前的部署回滚时没有清理表

**解决方案**:
```bash
# 手动删除表
for table in V2PairsCachingDB RoutesDB TokenPropertiesCachingDb V3PoolsCachingDB CacheReqFlagDB RouteCachingDB RoutesDbCacheReqFlagDB RpcProviderHealthState RpcProviderState; do
  aws dynamodb delete-table --table-name $table --region us-east-1 2>/dev/null
done

# 等待删除完成后重新部署
./deploy-clean.sh
```

### 问题 3: CDK 引导错误

**解决方案**:
```bash
cdk bootstrap aws://513278913266/us-east-1
```

### 问题 4: 超时或性能问题

**检查项**:
- RPC 端点是否可访问
- Lambda 内存设置（当前 5120 MB）
- Lambda 超时设置（当前 9 秒）

---

## 📊 部署信息

- **AWS 账号**: 513278913266
- **Region**: us-east-1
- **堆栈名称**: RoutingAPIStack
- **Lambda 内存**: 5120 MB
- **Lambda 超时**: 9 秒
- **Runtime**: Node.js 18.x

---

## 🔧 关键环境变量说明

### RPC Gateway 变量（Lambda 启动必需）

这些变量在 Lambda 冷启动时被 `GlobalRpcProviders.validateProdConfig()` 验证：

- `QUICKNODE_42220` - Celo RPC（之前导致启动失败）
- `QUICKNODE_1`, `ALCHEMY_1` - Ethereum Mainnet
- `UNIRPC_0` - Uniswap RPC（所有链的备用）
- 其他链的 RPC 变量...

### 格式要求

- **QUICKNODE_***: `domain,token` （逗号分隔，无空格）
  - 例如: `forno.celo.org,` 或 `example.quiknode.pro,abc123`
  
- **ALCHEMY_***: 只需要 token
  - 例如: `Q3EUEtQ0XUKtceDSkJNfX`

- **UNIRPC_0**: 完整 URL（不带尾部斜杠）
  - 例如: `https://eth.public-rpc.com`

---

## 📝 下一步

1. **运行部署脚本**: `./deploy-clean.sh`
2. **等待完成**: 约 10-15 分钟
3. **测试 API**: 使用脚本输出的 curl 命令
4. **查看日志**: 如有问题，查看 CloudWatch 日志

---

## 💡 提示

- 部署日志会保存在 `deploy.log`
- 如遇问题，先查看 CloudWatch Logs
- 公共 RPC 有速率限制，生产环境建议使用付费服务
- 可以在 `lib/config/rpcProviderProdConfig.json` 中禁用不需要的链

---

## 🆘 需要帮助？

如果部署失败，请提供：
1. `deploy.log` 的最后 50 行
2. CloudWatch Logs 的错误信息
3. 堆栈状态：`aws cloudformation describe-stacks --stack-name RoutingAPIStack --region us-east-1`

---

**准备好了吗？运行部署命令：**

```bash
./deploy-clean.sh
```

🎉 祝部署顺利！
