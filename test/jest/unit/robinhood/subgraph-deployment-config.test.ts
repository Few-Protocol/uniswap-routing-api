import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { ChainId } from '@ring-protocol/sdk-core'
import { Protocol } from '@ring-protocol/router-sdk'
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as ts from 'typescript'
import { runInNewContext } from 'vm'

// Build actual CloudFormation environments without bundling source or contacting AWS.
jest.mock('aws-cdk-lib/aws-lambda-nodejs', () => {
  const lambda = jest.requireActual('aws-cdk-lib/aws-lambda')
  return {
    NodejsFunction: class extends lambda.Function {
      constructor(scope: any, id: string, props: any) {
        const { entry, bundling, handler, ...rest } = props
        super(scope, id, { ...rest, handler: 'index.handler', code: lambda.Code.fromInline('exports.handler = async () => ({})') })
      }
    },
  }
})

jest.mock('../../../../lib/cron/cache-config', () => ({
  chainProtocols: [56, 999, 4663].map(chainId => ({ chainId, protocol: 'FEWV2', timeout: 840000 })),
}))

import { RoutingAPIStack } from '../../../../bin/stacks/routing-api-stack'

const optionalURL = 'https://subgraph.example.invalid/ring-fewv2'
const syntheticToken = 'synthetic-subgraph-token'

function environments(url?: string, token?: string) {
  const app = new cdk.App()
  const stack = new RoutingAPIStack(app, 'Audit', {
    env: { account: '123456789012', region: 'us-east-1' },
    stage: 'local', provisionedConcurrency: 0,
    jsonRpcProviders: { WEB3_RPC_4663: 'https://rpc.example.invalid' },
    ethGasStationInfoUrl: 'https://gas.example.invalid',
    tenderlyUser: '', tenderlyProject: '', tenderlyAccessKey: '', tenderlyNodeApiKey: '',
    unicornSecret: 'synthetic-debug-value',
    uniGraphQLEndpoint: 'https://graphql.example.invalid', uniGraphQLHeaderOrigin: 'https://example.invalid',
    robinhoodFewV2SubgraphUrl: url, graphBearerToken_ROBINHOOD: token,
  })
  const lambdas = (id: string) => Object.values(Template.fromStack(stack.node.findChild(id) as cdk.Stack)
    .findResources('AWS::Lambda::Function'))
    .map((resource: any) => resource.Properties.Environment?.Variables)
    .filter((env: any) => env && (env.chainId || env.WEB3_RPC_4663))
  return { pools: lambdas('RoutingCachingStack'), quotes: lambdas('RoutingLambdaStack') }
}

describe('Robinhood FewV2 optional subgraph deployment', () => {
  test('keeps the static default without requiring a subgraph or secret', () => {
    const { pools, quotes } = environments()
    expect(pools.find(env => env.chainId === String(ChainId.ROBINHOOD)).protocol).toBe(Protocol.FEWV2)
    for (const env of [...pools, ...quotes]) {
      expect(env.ROBINHOOD_FEWV2_SUBGRAPH_URL).toBeUndefined()
      expect(env.GRAPH_BEARER_TOKEN_ROBINHOOD).toBeUndefined()
    }
  })

  test('propagates configured sources into both quote lambdas and only the Robinhood pool lambda', () => {
    const { pools, quotes } = environments(optionalURL, syntheticToken)
    const robinhood = pools.filter(env => env.chainId === String(ChainId.ROBINHOOD))
    expect(robinhood).toHaveLength(1)
    expect(quotes).toHaveLength(2)
    for (const env of [...robinhood, ...quotes]) {
      expect(env.ROBINHOOD_FEWV2_SUBGRAPH_URL).toBe(optionalURL)
      expect(env.GRAPH_BEARER_TOKEN_ROBINHOOD).toBe(syntheticToken)
    }
    for (const env of pools.filter(env => env.chainId !== String(ChainId.ROBINHOOD))) {
      expect(env.ROBINHOOD_FEWV2_SUBGRAPH_URL).toBeUndefined()
      expect(env.GRAPH_BEARER_TOKEN_ROBINHOOD).toBeUndefined()
    }
  })

  test('permits public subgraphs and does not inject an orphan bearer token', () => {
    const configured = environments(optionalURL)
    expect(configured.quotes.every(env => env.ROBINHOOD_FEWV2_SUBGRAPH_URL === optionalURL)).toBe(true)
    expect(configured.quotes.every(env => env.GRAPH_BEARER_TOKEN_ROBINHOOD === undefined)).toBe(true)
    const absent = environments(undefined, syntheticToken)
    expect([...absent.pools, ...absent.quotes].every(env => env.GRAPH_BEARER_TOKEN_ROBINHOOD === undefined)).toBe(true)
  })

  test.each([
    [undefined, undefined],
    [optionalURL, undefined],
    [optionalURL, 'synthetic-existing-secret-name'],
  ])('preserves optional source settings during pipeline synth without embedding a bearer token', (url, secretName) => {
    const file = ts.createSourceFile('app.ts', readFileSync(resolve(__dirname, '../../../../bin/app.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
    let synthProps: ts.Expression | undefined
    const visit = (node: ts.Node) => {
      if (ts.isNewExpression(node) && node.expression.getText(file) === 'CodeBuildStep' && node.arguments?.[0].getText(file) === "'Synth'") {
        synthProps = node.arguments[1]
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect(synthProps).toBeDefined()
    const script = ts.transpileModule(`result = ${synthProps!.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
    const context: any = { code: {}, robinhoodFewV2SubgraphUrl: url, robinhoodGraphSecretName: secretName, BuildEnvironmentVariableType }
    runInNewContext(script, context)
    const variables = context.result.buildEnvironment.environmentVariables
    expect(variables.ROBINHOOD_FEWV2_SUBGRAPH_URL?.value).toBe(url)
    expect(variables.GRAPH_BEARER_TOKEN_ROBINHOOD_SECRET_NAME?.value).toBe(url ? secretName : undefined)
    expect(variables.GRAPH_BEARER_TOKEN_ROBINHOOD).toBeUndefined()
  })
})
