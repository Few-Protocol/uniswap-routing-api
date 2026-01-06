# Cache Route 逻辑分析

## 概述

Cache Route 是 Uniswap Routing API 中的一个性能优化机制，用于缓存之前计算过的路由，避免重复计算，提高响应速度。

## 核心组件

### 1. DynamoRouteCachingProvider
位置: `lib/handlers/router-entities/route-caching/dynamo-route-caching-provider.ts`

这是实现 `IRouteCachingProvider` 接口的类，负责：
- 从 DynamoDB 读取缓存的 routes
- 将新的 routes 写入 DynamoDB
- 管理缓存的生命周期和过期策略

### 2. Intent 配置
位置: `lib/handlers/shared.ts`

不同的 intent 有不同的 cache route 行为：

```typescript
INTENT_SPECIFIC_CONFIG = {
  caching: {
    useCachedRoutes: false,        // 创建缓存时不使用缓存
    optimisticCachedRoutes: false, // 不使用乐观缓存（避免无限循环）
    overwriteCacheMode: CacheMode.Darkmode
  },
  quote: {
    useCachedRoutes: false,        // ⚠️ 注意：quote intent 不使用缓存
    optimisticCachedRoutes: true    // 但使用乐观缓存
  },
  swap: {
    useCachedRoutes: true,         // swap intent 使用缓存
    optimisticCachedRoutes: false   // 但不使用乐观缓存
  },
  pricing: {
    useCachedRoutes: true,
    optimisticCachedRoutes: true
  }
}
```

**⚠️ 重要发现：quote intent 的 `useCachedRoutes: false`，这意味着正常的 quote 请求不会使用缓存！**

## 工作流程

### 1. 读取缓存 (Get Cached Route)

#### 在 Smart-Order-Router 中
位置: `node_modules/@uniswap/smart-order-router/build/main/routers/alpha-router/alpha-router.js`

AlphaRouter 的 `route` 方法中：

```javascript
// 1. 检查是否应该使用缓存
if (routingConfig.useCachedRoutes && 
    cacheMode !== CacheMode.Darkmode && 
    isAllowedToEnterCachedRoutes) {
  
  // 2. 调用 routeCachingProvider 获取缓存
  cachedRoutes = await this.routeCachingProvider?.getCachedRoute(
    this.chainId, 
    amount, 
    quoteCurrency, 
    tradeType, 
    protocols, 
    await blockNumber, 
    routingConfig.optimisticCachedRoutes
  )
}

// 3. 如果找到缓存，使用缓存生成 swap route
if (cachedRoutes) {
  swapRouteFromCachePromise = this.getSwapRouteFromCache(...)
}
```

#### 在 DynamoRouteCachingProvider 中

`_getCachedRoute` 方法流程：

1. **构建 Partition Key**: `pairTradeTypeChainId` = `currencyIn/currencyOut/tradeType/chainId`
2. **查询 DynamoDB**: 根据 partition key 查询所有相关 routes
3. **过滤和排序**:
   - 按 protocol 过滤
   - 按 `protocolsInvolved` 过滤（对于 MIXED routes）
   - 按 `blockNumber` 降序排序
   - 取前 8 条 (`ROUTES_TO_TAKE_FROM_ROUTES_DB`)
4. **解析和合并**: 
   - 将多条记录解析为 `CachedRoutes` 对象
   - 去重（基于 routeId）
   - 合并为单个 `CachedRoutes` 对象
5. **检查过期**: 使用 `notExpired(currentBlockNumber, optimistic)` 检查
6. **触发异步缓存更新**: 如果 `optimistic=true`，异步触发新的缓存请求

### 2. 写入缓存 (Set Cached Route)

#### 在 Smart-Order-Router 中

当路由计算完成后：

```javascript
// 如果配置允许写入缓存
if (routingConfig.writeToCachedRoutes && routesToCache) {
  await this.routeCachingProvider?.setCachedRoute(routesToCache, amount)
}
```

#### 在 DynamoRouteCachingProvider 中

`_setCachedRoute` 方法流程：

1. **拆分 routes**: 将 `CachedRoutes` 中的每个 route 拆分为单独的记录
2. **序列化**: 使用 `CachedRoutesMarshaller` 序列化
3. **存储到 DynamoDB**: 
   - Partition Key: `pairTradeTypeChainId`
   - Sort Key: `routeId`
   - TTL: 24 小时
   - 存储格式：同时存储 `plainRoutes` (JSON) 和 `item` (Binary)

### 3. 异步缓存预热机制

当从缓存读取时（`optimistic=true`），会触发异步缓存更新：

```typescript
private async maybeSendCachingQuoteForRoutesDb(...) {
  // 1. 检查是否已经有缓存请求在最近发送过
  const result = await this.ddbClient.query({
    KeyConditionExpression: '#pk = :pk AND #amount BETWEEN :amount AND :amount_ratio',
    // 使用黄金比例 (514229/317811) 来匹配相近的金额
  })
  
  // 2. 如果没有最近的请求，发送异步 Lambda 调用
  if (shouldSendCachingRequest) {
    this.sendAsyncCachingRequest(...)  // 调用 caching lambda
    this.setRoutesDbCachingIntentFlag(...)  // 设置标志，避免重复请求
  }
}
```

**缓存请求标志表** (`routesCachingRequestFlagTableName`):
- 用于防止重复的缓存请求
- TTL: 2 分钟
- 使用金额范围匹配（黄金比例）来判断是否已有请求

## 关键参数和配置

### Blocks to Live
位置: `lib/util/defaultBlocksToLiveRoutesDB.ts`

不同链有不同的 blocks-to-live 配置：
- Mainnet: 5 blocks (~1 分钟)
- Optimism: 30 blocks (~1 分钟)
- Arbitrum: 240 blocks (~1 分钟)
- Base: 900 blocks (~30 分钟)

### 缓存策略

1. **Optimistic Cached Routes**: 
   - `true`: 允许使用稍微过期的缓存（在当前 block 之前几个 blocks）
   - `false`: 只使用完全不过期的缓存

2. **Cache Mode**:
   - `Darkmode`: 不写入缓存，只读取
   - `Livemode`: 正常读写缓存
   - `Tapcompare`: 用于测试和对比

## 潜在问题分析

### 问题 1: Quote Intent 不使用缓存

在 `INTENT_SPECIFIC_CONFIG` 中：
```typescript
quote: {
  useCachedRoutes: false,  // ⚠️ 这里设置为 false
  optimisticCachedRoutes: true
}
```

这意味着：
- 正常的 quote 请求 (`intent=quote`) **不会使用缓存**
- 只有 `intent=swap` 或 `intent=pricing` 才会使用缓存
- 这可能导致 quote 请求总是重新计算路由，性能较差

### 问题 2: 缓存过期检查

在 `parseCachedRoutes` 中：
```typescript
const notExpiredCachedRoute = cachedRoutes.notExpired(currentBlockNumber, optimistic)
```

但是 `filterExpiredCachedRoutes` 被覆盖为：
```typescript
protected override filterExpiredCachedRoutes(...) {
  return cachedRoutes  // 不进行过滤，总是返回
}
```

这意味着即使缓存过期，也可能被使用（如果 `optimistic=true`）。

### 问题 3: 缓存更新机制

异步缓存更新依赖于：
1. `optimisticCachedRoutes=true` 才会触发
2. 需要检查 `routesCachingRequestFlagTableName` 避免重复
3. 使用 Lambda 异步调用，可能失败或延迟

如果这些机制失效，缓存可能不会及时更新。

## 建议的修复方向

1. **检查 quote intent 配置**: 考虑是否应该让 quote 也使用缓存
2. **改进缓存过期逻辑**: 确保过期缓存不会被不当使用
3. **增强缓存更新机制**: 添加重试和监控
4. **添加更多日志和指标**: 帮助诊断缓存问题

## 相关文件

- `lib/handlers/router-entities/route-caching/dynamo-route-caching-provider.ts` - 主要实现
- `lib/handlers/shared.ts` - Intent 配置
- `lib/handlers/quote/quote.ts` - Quote handler
- `lib/util/defaultBlocksToLiveRoutesDB.ts` - Blocks to live 配置
- `lib/handlers/router-entities/route-caching/model/` - 数据模型

