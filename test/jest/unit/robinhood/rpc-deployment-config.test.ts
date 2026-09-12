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
  ALCHEMY_56: 'https://bnb.example.invalid',
  WEB3_RPC_999: 'https://hyper.example.invalid',
  WEB3_RPC_4663: 'https://robinhood.example.invalid',
}

describe('Robinhood RPC deployment configuration', () => {
  test('passes all existing RPC entries and Robinhood to both quote lambdas', () => {
    const stack = new RoutingAPIStack(new cdk.App(), 'Audit', {
      env: { account: '123456789012', region: 'us-east-1' },
      stage: 'local', provisionedConcurrency: 0, jsonRpcProviders: rpcConfiguration,
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

  test('reads the Robinhood RPC through the existing app configuration map', () => {
    const file = ts.createSourceFile('app.ts', readFileSync(resolve(__dirname, '../../../../bin/app.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
    let initializer: ts.Expression | undefined
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'jsonRpcProviders') initializer = node.initializer
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect(initializer).toBeDefined()
    const script = ts.transpileModule(`result = ${initializer!.getText(file)}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
    const context: any = { process: { env: rpcConfiguration } }
    runInNewContext(script, context)
    expect(context.result.WEB3_RPC_4663).toBe(rpcConfiguration.WEB3_RPC_4663)
    expect(context.result.ALCHEMY_56).toBe(rpcConfiguration.ALCHEMY_56)
  })
})
