import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as ts from 'typescript'
import { runInNewContext } from 'vm'

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

const rpcConfiguration = {
  WEB3_RPC_5042: 'https://arc.example.invalid',
  WEB3_RPC_57073: 'https://ink.example.invalid',
  WEB3_RPC_4663: 'https://robinhood.example.invalid',
  ALCHEMY_11155111: 'synthetic-sepolia-key',
  ALCHEMY_1: 'synthetic-ethereum-key',
  ALCHEMY_56: 'synthetic-bnb-key',
  ALCHEMY_4326: 'synthetic-megaeth-key',
  ALCHEMY_999: 'synthetic-hyper-key',
  ALCHEMY_4663: 'synthetic-robinhood-key',
  ALCHEMY_42161: 'synthetic-arbitrum-key',
  ALCHEMY_8453: 'synthetic-base-key',
  ALCHEMY_130: 'synthetic-unichain-key',
  ALCHEMY_10: 'synthetic-optimism-key',
  ALCHEMY_196: 'synthetic-xlayer-key',
}

// Evaluate the real deploy.sh app map with synthetic inputs, without loading .env.
// Supplying the fixture directly to the stack would miss keys omitted by bin/app.ts.
function readAppRpcConfiguration(): Record<string, string> {
  const file = ts.createSourceFile('app.ts', readFileSync(resolve(__dirname, '../../../../bin/app.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
  let initializer: ts.Expression | undefined
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(file) === 'jsonRpcProviders') initializer = declaration.initializer
    }
  }
  expect(initializer).toBeDefined()
  const script = ts.transpileModule(`result = ${initializer!.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const context: any = { process: { env: rpcConfiguration } }
  runInNewContext(script, context)
  return context.result
}

describe('RPC deployment configuration', () => {
  test('passes Arc, Ink and every existing RPC entry from the app to both quote lambdas', () => {
    const stack = new RoutingAPIStack(new cdk.App(), 'Audit', {
      env: { account: '123456789012', region: 'us-east-1' },
      stage: 'local', provisionedConcurrency: 0, jsonRpcProviders: readAppRpcConfiguration(),
      ethGasStationInfoUrl: 'https://gas.example.invalid',
      tenderlyUser: '', tenderlyProject: '', tenderlyAccessKey: '', tenderlyNodeApiKey: '',
      unicornSecret: 'synthetic-debug-value',
      uniGraphQLEndpoint: 'https://graphql.example.invalid', uniGraphQLHeaderOrigin: 'https://example.invalid',
    })
    const template = Template.fromStack(stack.node.findChild('RoutingLambdaStack') as cdk.Stack)
    const environments = Object.values(template.findResources('AWS::Lambda::Function'))
      .map((resource: any) => resource.Properties.Environment?.Variables)
      .filter((env: any) => env?.WEB3_RPC_4663)
    expect(environments).toHaveLength(2)
    for (const env of environments) expect(env).toMatchObject(rpcConfiguration)
  })

  test('preserves all configured RPC values through the existing app configuration map', () => {
    expect(readAppRpcConfiguration()).toEqual(rpcConfiguration)
  })
})
