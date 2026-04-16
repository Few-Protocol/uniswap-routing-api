/**
 * 本地调试 MEGAETH_MAINNET (chainId = 4326) quote 接口的脚本
 *
 * 运行方式:
 * - npx ts-node --project=tsconfig.cdk.json scripts/debug_quote_megaeth.ts
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import dotenv from 'dotenv'
import { QuoteHandler } from '../lib/handlers/quote/quote'
import { QuoteHandlerInjector } from '../lib/handlers/quote/injector'

dotenv.config()

if (!process.env.RPC_PROVIDER_HEALTH_TABLE_NAME) {
  process.env.RPC_PROVIDER_HEALTH_TABLE_NAME = 'rpc-provider-health-state-local-dev'
}

if (!process.env.WEB3_RPC_11155111 && process.env.ALCHEMY_11155111) {
  process.env.WEB3_RPC_11155111 = process.env.ALCHEMY_11155111
}

function createMockEvent(): APIGatewayProxyEvent {
  const queryStringParameters: Record<string, string> = {
    tokenInAddress: '0x4200000000000000000000000000000000000006',
    tokenOutAddress: '0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7',
    tokenInChainId: '4326',
    tokenOutChainId: '4326',
    amount: '100000000000000000', // 0.1 WETH
    type: 'exactIn',
    slippageTolerance: '0.5',
    deadline: '10800',
    protocols: 'fewv2,v2,v3,v4',
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

  console.log('本地 MEGAETH_MAINNET (4326) 调试开始，查询参数:')
  console.log(JSON.stringify(event.queryStringParameters, null, 2))
  console.log('\n')

  try {
    const injectorPromise = new QuoteHandlerInjector('quoteInjector-local-megaeth').build()
    const quoteHandler = new QuoteHandler('quote-local-megaeth', injectorPromise)

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
