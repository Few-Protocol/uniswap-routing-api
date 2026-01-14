/**
 * 本地调试 XLAYER_MAINNET (chainId = 196) quote 接口的脚本
 *
 * 运行方式（任意一种）:
 * - npx ts-node --project=tsconfig.cdk.json scripts/debug_quote_xlayer.ts
 *
 * 这个脚本会：
 * - 构造一个和线上 API Gateway 类似的 GET 事件（使用你给的 curl 参数）
 * - 直接调用 QuoteHandler，打印响应或错误
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import dotenv from 'dotenv'
import { QuoteHandler } from '../lib/handlers/quote/quote'
import { QuoteHandlerInjector } from '../lib/handlers/quote/injector'

dotenv.config()

// 本地调试时，给必需的环境变量一些安全默认值，避免初始化阶段直接报错
if (!process.env.RPC_PROVIDER_HEALTH_TABLE_NAME) {
  process.env.RPC_PROVIDER_HEALTH_TABLE_NAME = 'rpc-provider-health-state-local-dev'
}

// 如果你只配置了 ALCHEMY_196 而没有 WEB3_RPC_196，这里做一个本地调试用的兜底映射
if (!process.env.WEB3_RPC_196 && process.env.ALCHEMY_196) {
  process.env.WEB3_RPC_196 = process.env.ALCHEMY_196
}

// 同样给 Sepolia 一个兜底，避免 SUPPORTED_CHAINS 里 SEPOLIA 初始化失败
if (!process.env.WEB3_RPC_11155111 && process.env.ALCHEMY_11155111) {
  process.env.WEB3_RPC_11155111 = process.env.ALCHEMY_11155111
}

function createMockEvent(): APIGatewayProxyEvent {
  const queryStringParameters: Record<string, string> = {
    tokenInAddress: '0x5a77f1443d16ee5761d310e38b62f77f726bc71c',
    tokenOutAddress: '0x74b7f16337b8972027f6196a17a631ac6de26d22',
    tokenInChainId: '196',
    tokenOutChainId: '196',
    amount: '1000000000000000000',
    type: 'exactIn',
    slippageTolerance: '0.5',
    deadline: '10800',
    protocols: 'v2,v3,v4',
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Cloudflare Worker',
    'x-api-key': 'TRADING_API_KEY',
    'x-app-version': '',
    'x-request-source': 'uniswap-web',
    'x-uniquote-enabled': 'true',
    'x-universal-router-version': '2.0',
    'x-viem-provider-enabled': 'false',
    ringallowed: 'ring',
  }

  return {
    httpMethod: 'GET',
    path: '/quote',
    pathParameters: null,
    queryStringParameters,
    // 兼容较老的 TS/JS 目标环境：不用 Object.fromEntries
    multiValueQueryStringParameters: (function () {
      const mv: Record<string, string[]> = {}
      Object.keys(queryStringParameters).forEach((key) => {
        const v = queryStringParameters[key]
        if (v !== undefined) {
          mv[key] = [v]
        }
      })
      return mv
    })(),
    headers,
    multiValueHeaders: (function () {
      const mv: Record<string, string[]> = {}
      for (const key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
          mv[key] = [headers[key]]
        }
      }
      return mv
    })(),
    body: null,
    isBase64Encoded: false,
    resource: '/quote',
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'local-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/quote',
      stage: 'local',
      requestId: 'local-request-id',
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      resourceId: 'local-resource',
      resourcePath: '/quote',
      authorizer: {},
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'local-test',
        userArn: null,
      },
    },
  }
}

function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'local-test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:local:test-function',
    memoryLimitInMB: '512',
    awsRequestId: 'local-aws-request-id-' + Date.now(),
    logGroupName: '/aws/lambda/local-test-function',
    logStreamName: 'local-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  }
}

async function main() {
  const event = createMockEvent()
  const context = createMockContext()

  console.log('本地 XLAYER_MAINNET 调试开始，查询参数:')
  console.log(JSON.stringify(event.queryStringParameters, null, 2))
  console.log('\n')

  try {
    const injectorPromise = new QuoteHandlerInjector('quoteInjector-local-xlayer').build()
    const quoteHandler = new QuoteHandler('quote-local-xlayer', injectorPromise)

    const result = await quoteHandler.handler(event, context)

    console.log('响应状态码:', result.statusCode)
    console.log('响应体:')
    try {
      console.log(JSON.stringify(JSON.parse(result.body || '{}'), null, 2))
    } catch {
      console.log(result.body)
    }
  } catch (error: any) {
    console.error('\n❌ 本地调用发生异常:')
    console.error('错误类型:', error?.constructor?.name)
    console.error('错误消息:', error?.message)
    console.error('\n错误堆栈:')
    console.error(error?.stack)
  }
}

main().catch(console.error)

