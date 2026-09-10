import { ChainId } from '@ring-protocol/sdk-core'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib'
import * as chatbot from 'aws-cdk-lib/aws-chatbot'
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild'
import { PipelineNotificationEvents } from 'aws-cdk-lib/aws-codepipeline'
import * as sm from 'aws-cdk-lib/aws-secretsmanager'
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines'
import { Construct } from 'constructs'
import dotenv from 'dotenv'
import 'source-map-support/register'
import { SUPPORTED_CHAINS } from '../lib/handlers/injector-sor'
import { STAGE } from '../lib/util/stage'
import { RoutingAPIStack } from './stacks/routing-api-stack'

dotenv.config()

export class RoutingAPIStage extends Stage {
  public readonly url: CfnOutput

  constructor(
    scope: Construct,
    id: string,
    props: StageProps & {
      jsonRpcProviders: { [chainName: string]: string }
      provisionedConcurrency: number
      ethGasStationInfoUrl: string
      chatbotSNSArn?: string
      stage: string
      internalApiKey?: string
      route53Arn?: string
      pinata_key?: string
      pinata_secret?: string
      hosted_zone?: string
      tenderlyUser: string
      tenderlyProject: string
      tenderlyAccessKey: string
      tenderlyNodeApiKey: string
      unicornSecret: string
      alchemyQueryKey?: string
      alchemyQueryKey2?: string
      graphBaseV4SubgraphId?: string
      graphBearerToken?: string
      graphBearerToken_X_LAYER?: string
      graphBearerToken_HYPER?: string
      graphBearerToken_BNB?: string
      graphBearerToken_MEGAETH?: string
      robinhoodFewV2SubgraphUrl?: string
      graphBearerToken_ROBINHOOD?: string
      // Extra per-chain Graph bearer tokens
      graphBearerToken_ARB?: string
      graphBearerToken_BASE?: string
      graphBearerToken_UNICHAIN?: string
      uniGraphQLEndpoint: string
      uniGraphQLHeaderOrigin: string
    }
  ) {
    super(scope, id, props)
    const {
      jsonRpcProviders,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      internalApiKey,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      tenderlyNodeApiKey,
      unicornSecret,
      alchemyQueryKey,
      alchemyQueryKey2,
      graphBaseV4SubgraphId,
      graphBearerToken,
      graphBearerToken_X_LAYER,
      graphBearerToken_HYPER,
      graphBearerToken_BNB,
      graphBearerToken_MEGAETH,
      robinhoodFewV2SubgraphUrl,
      graphBearerToken_ROBINHOOD,
      graphBearerToken_ARB,
      graphBearerToken_BASE,
      graphBearerToken_UNICHAIN,
      uniGraphQLEndpoint,
      uniGraphQLHeaderOrigin,
    } = props

    const { url } = new RoutingAPIStack(this, 'RoutingAPI', {
      jsonRpcProviders,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      internalApiKey,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      tenderlyNodeApiKey,
      unicornSecret,
      alchemyQueryKey,
      alchemyQueryKey2,
      graphBaseV4SubgraphId,
      graphBearerToken,
      graphBearerToken_X_LAYER,
      graphBearerToken_HYPER,
      graphBearerToken_BNB,
      graphBearerToken_MEGAETH,
      robinhoodFewV2SubgraphUrl,
      graphBearerToken_ROBINHOOD,
      graphBearerToken_ARB,
      graphBearerToken_BASE,
      graphBearerToken_UNICHAIN,
      uniGraphQLEndpoint,
      uniGraphQLHeaderOrigin,
    })
    this.url = url
  }
}

export class RoutingAPIPipeline extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // update to use codestar for standard connections
    const code = CodePipelineSource.connection('Uniswap/routing-api', 'ring_main', {
      connectionArn:
        'arn:aws:codestar-connections:us-east-1:513278913266:connection/4806faf1-c31e-4ea2-a5bf-c6fc1fa79487',
    })

    const robinhoodFewV2SubgraphUrl = process.env.ROBINHOOD_FEWV2_SUBGRAPH_URL || process.env.GRAPH_FEWV2_SUBGRAPH_URL_ROBINHOOD
    const robinhoodGraphSecretName = process.env.GRAPH_BEARER_TOKEN_ROBINHOOD_SECRET_NAME

    const synthStep = new CodeBuildStep('Synth', {
      input: code,
      buildEnvironment: {
        environmentVariables: {
          ...(robinhoodFewV2SubgraphUrl ? {
            ROBINHOOD_FEWV2_SUBGRAPH_URL: { value: robinhoodFewV2SubgraphUrl },
            ...(robinhoodGraphSecretName ? {
              GRAPH_BEARER_TOKEN_ROBINHOOD_SECRET_NAME: { value: robinhoodGraphSecretName },
            } : {}),
          } : {}),
          NPM_TOKEN: {
            value: 'npm-private-repo-access-token',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
        },
      },
      commands: [
        'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
        'npm run build',
        'npx cdk synth',
      ],
    })

    const pipeline = new CodePipeline(this, 'RoutingAPIPipeline', {
      // The pipeline name
      pipelineName: 'RoutingAPI',
      crossAccountKeys: true,
      synth: synthStep,
    })

    // Secrets are stored in secrets manager in the pipeline account. Accounts we deploy to
    // have been granted permissions to access secrets via resource policies.

    const jsonRpcProvidersSecret = sm.Secret.fromSecretAttributes(this, 'RPCProviderUrls', {
      // The main secrets use our Alchemy RPC urls
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-1:513278913266:secret:routing-api-rpc-urls-json-primary-ixS8mw',

      /*
      The backup secrets mostly use our Alchemy RPC urls
      When switching to the backups,
      we must set the multicall chunk size to 50 so that optimism
      does not bug out on Alchemy's end
      */
      //secretCompleteArn: arn:aws:secretsmanager:us-east-1:513278913266:secret:routing-api-rpc-urls-json-backup-D2sWoe
    })

    // Secret that controls the access to the debugging query string params
    const unicornSecrets = sm.Secret.fromSecretAttributes(this, 'DebugConfigUnicornSecrets', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:debug-config-unicornsecrets-jvmCsq',
    })

    const tenderlyCreds = sm.Secret.fromSecretAttributes(this, 'TenderlyCreds', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:tenderly-api-wQaI2R',
    })

    const ethGasStationInfoUrl = sm.Secret.fromSecretAttributes(this, 'ETHGasStationUrl', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:eth-gas-station-info-url-ulGncX',
    })

    const pinataApi = sm.Secret.fromSecretAttributes(this, 'PinataAPI', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:pinata-api-key-UVLAfM',
    })
    const route53Arn = sm.Secret.fromSecretAttributes(this, 'Route53Arn', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:Route53Arn-elRmmw',
    })

    const pinataSecret = sm.Secret.fromSecretAttributes(this, 'PinataSecret', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:pinata-secret-svGaPt',
    })

    const hostedZone = sm.Secret.fromSecretAttributes(this, 'HostedZone', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:hosted-zone-JmPDNV',
    })

    const internalApiKey = sm.Secret.fromSecretAttributes(this, 'internal-api-key', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:routing-api-internal-api-key-Z68NmB',
    })

    const routingApiNewSecrets = sm.Secret.fromSecretAttributes(this, 'RoutingApiNewSecrets', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:RoutingApiNewSecrets-7EijpM',
    })

    // ALchemy subgraphs are split between two accounts, hence the two keys alchemy-query-key and alchemy-query-key-2
    const alchemySubgraphSecret = sm.Secret.fromSecretAttributes(this, 'RoutingAlchemySubgraphSecret', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:513278913266:secret:RoutingAlchemySubgraphSecret-QKtgMX',
    })

    // Load RPC provider URLs from AWS secret
    let jsonRpcProviders = {} as { [chainId: string]: string }
    SUPPORTED_CHAINS.forEach((chainId: ChainId) => {
      // Exclude newly introduced chains here. This section can be probably removed but needs to be tested.
      if (
        chainId !== ChainId.WORLDCHAIN &&
        chainId !== ChainId.UNICHAIN_SEPOLIA &&
        chainId !== ChainId.MONAD_TESTNET &&
        chainId !== ChainId.BASE_SEPOLIA &&
        chainId !== ChainId.UNICHAIN &&
        chainId !== ChainId.SONEIUM
      ) {
        const key = `WEB3_RPC_${chainId}`
        jsonRpcProviders[key] = jsonRpcProvidersSecret.secretValueFromJson(key).toString()
        new CfnOutput(this, key, {
          value: jsonRpcProviders[key],
        })
      }
    })

    // Load RPC provider URLs from AWS secret (for RPC Gateway)
    const RPC_GATEWAY_PROVIDERS = [
      'ALCHEMY_11155111',
      'ALCHEMY_1',
      'ALCHEMY_999',
      'ALCHEMY_56',
      'ALCHEMY_4326',
      'ALCHEMY_42161',
      'ALCHEMY_8453',
      'ALCHEMY_130',
      'ALCHEMY_10',
      'ALCHEMY_196',
    ]
    for (const provider of RPC_GATEWAY_PROVIDERS) {
      jsonRpcProviders[provider] = jsonRpcProvidersSecret.secretValueFromJson(provider).toString()
      new CfnOutput(this, provider, {
        value: jsonRpcProviders[provider],
      })
    }

    // Optional private-subgraph credentials remain a Secrets Manager reference.
    const graphBearerToken_ROBINHOOD = robinhoodFewV2SubgraphUrl && robinhoodGraphSecretName
      ? sm.Secret.fromSecretNameV2(this, 'RobinhoodFewV2SubgraphToken', robinhoodGraphSecretName).secretValue.toString()
      : undefined

    // Beta us-east-1
    const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-us-east-1', {
      env: { account: '513278913266'/*145079444317*/, region: 'us-east-1' },
      jsonRpcProviders: jsonRpcProviders,
      internalApiKey: internalApiKey.secretValue.toString(),
      provisionedConcurrency: 5,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      stage: STAGE.BETA,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
      tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
      tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
      tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
      tenderlyNodeApiKey: tenderlyCreds.secretValueFromJson('tenderly-node-api-key').toString(),
      unicornSecret: unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString(),
      alchemyQueryKey: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key').toString(),
      alchemyQueryKey2: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key-2').toString(),
      // bearer token and base subgraph id are not from alchemy subgraph, but from the graph
      // below secret namings are wrong, but we take it as is
      graphBearerToken: alchemySubgraphSecret.secretValueFromJson('alchemy-bearer-token').toString(),
      graphBaseV4SubgraphId: alchemySubgraphSecret.secretValueFromJson('alchemy-base-v4-subgraph-id').toString(),
      graphBearerToken_HYPER: routingApiNewSecrets.secretValueFromJson('goldsky-api-key').toString(),
      graphBearerToken_BNB: routingApiNewSecrets.secretValueFromJson('goldsky-api-key').toString(),
      graphBearerToken_MEGAETH: routingApiNewSecrets.secretValueFromJson('goldsky-api-key').toString(),
      robinhoodFewV2SubgraphUrl,
      graphBearerToken_ROBINHOOD,
      graphBearerToken_X_LAYER: routingApiNewSecrets.secretValueFromJson('graph-bearer-token-x-layer').toString(),
      uniGraphQLEndpoint: routingApiNewSecrets.secretValueFromJson('uni-graphql-endpoint').toString(),
      uniGraphQLHeaderOrigin: routingApiNewSecrets.secretValueFromJson('uni-graphql-header-origin').toString(),
    })

    const betaUsEast2AppStage = pipeline.addStage(betaUsEast2Stage)

    const unicornSecret = unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString()
    this.addIntegTests(code, betaUsEast2Stage, betaUsEast2AppStage, unicornSecret)

    // Prod us-east-1
    const prodUsEast2Stage = new RoutingAPIStage(this, 'prod-us-east-1', {
      env: { account: '513278913266', region: 'us-east-1' },
      jsonRpcProviders: jsonRpcProviders,
      internalApiKey: internalApiKey.secretValue.toString(),
      provisionedConcurrency: 70,
      ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
      chatbotSNSArn: 'arn:aws:sns:us-east-1:513278913266:SlackChatbotTopic',
      stage: STAGE.PROD,
      route53Arn: route53Arn.secretValueFromJson('arn').toString(),
      pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
      pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
      hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
      tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
      tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
      tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
      tenderlyNodeApiKey: tenderlyCreds.secretValueFromJson('tenderly-node-api-key').toString(),
      unicornSecret: unicornSecrets.secretValueFromJson('debug-config-unicorn-key').toString(),
      alchemyQueryKey: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key').toString(),
      alchemyQueryKey2: alchemySubgraphSecret.secretValueFromJson('alchemy-query-key-2').toString(),
      // bearer token and base subgraph id are not from alchemy subgraph, but from the graph
      // below secret namings are wrong, but we take it as is
      graphBearerToken: alchemySubgraphSecret.secretValueFromJson('alchemy-bearer-token').toString(),
      graphBaseV4SubgraphId: alchemySubgraphSecret.secretValueFromJson('alchemy-base-v4-subgraph-id').toString(),
      graphBearerToken_HYPER: routingApiNewSecrets.secretValueFromJson('goldsky-api-key').toString(),
      graphBearerToken_BNB: routingApiNewSecrets.secretValueFromJson('goldsky-api-key').toString(),
      graphBearerToken_MEGAETH: routingApiNewSecrets.secretValueFromJson('goldsky-api-key').toString(),
      robinhoodFewV2SubgraphUrl,
      graphBearerToken_ROBINHOOD,
      graphBearerToken_X_LAYER: routingApiNewSecrets.secretValueFromJson('graph-bearer-token-x-layer').toString(),
      uniGraphQLEndpoint: routingApiNewSecrets.secretValueFromJson('uni-graphql-endpoint').toString(),
      uniGraphQLHeaderOrigin: routingApiNewSecrets.secretValueFromJson('uni-graphql-header-origin').toString(),
    })

    const prodUsEast2AppStage = pipeline.addStage(prodUsEast2Stage)

    this.addIntegTests(code, prodUsEast2Stage, prodUsEast2AppStage, unicornSecret)

    const slackChannel = chatbot.SlackChannelConfiguration.fromSlackChannelConfigurationArn(
      this,
      'SlackChannel',
      'arn:aws:chatbot::513278913266:chat-configuration/slack-channel/eng-ops-slack-chatbot'
    )

    pipeline.buildPipeline()
    pipeline.pipeline.notifyOn('NotifySlack', slackChannel, {
      events: [PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED],
    })
  }

  private addIntegTests(
    sourceArtifact: cdk.pipelines.CodePipelineSource,
    routingAPIStage: RoutingAPIStage,
    applicationStage: cdk.pipelines.StageDeployment,
    unicornSecret: string
  ) {
    const testAction = new CodeBuildStep(`IntegTests-${routingAPIStage.stageName}`, {
      projectName: `IntegTests-${routingAPIStage.stageName}`,
      input: sourceArtifact,
      envFromCfnOutputs: {
        UNISWAP_ROUTING_API: routingAPIStage.url,
      },
      buildEnvironment: {
        computeType: cdk.aws_codebuild.ComputeType.LARGE,
        environmentVariables: {
          NPM_TOKEN: {
            value: 'npm-private-repo-access-token',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
          ARCHIVE_NODE_RPC: {
            value: 'archive-node-rpc-url-default-kms',
            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          },
        },
      },
      commands: [
        'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
        'echo "UNISWAP_ROUTING_API=${UNISWAP_ROUTING_API}" > .env',
        'echo "ARCHIVE_NODE_RPC=${ARCHIVE_NODE_RPC}" >> .env',
        `echo "UNICORN_SECRET=${unicornSecret}" >> .env`,
        'npm install',
        'npm run build',
        'set NODE_OPTIONS=--max-old-space-size=16384 && npm run test:e2e',
      ],
    })

    applicationStage.addPost(testAction)
  }
}

const app = new cdk.App()

const jsonRpcProviders = {
  ...(process.env.WEB3_RPC_4663 ? { WEB3_RPC_4663: process.env.WEB3_RPC_4663 } : {}),
  ALCHEMY_11155111: process.env.ALCHEMY_11155111!,
  ALCHEMY_1: process.env.ALCHEMY_1!,
  ALCHEMY_56: process.env.ALCHEMY_56!,
  ALCHEMY_4326: process.env.ALCHEMY_4326!,
  ALCHEMY_999: process.env.ALCHEMY_999!,
  ALCHEMY_42161: process.env.ALCHEMY_42161!,
  ALCHEMY_8453: process.env.ALCHEMY_8453!,
  ALCHEMY_130: process.env.ALCHEMY_130!,
  ALCHEMY_10: process.env.ALCHEMY_10!,
  ALCHEMY_196: process.env.ALCHEMY_196!,
}

// Local dev stack
new RoutingAPIStack(app, 'RoutingAPIStack', {
  jsonRpcProviders: jsonRpcProviders,
  provisionedConcurrency: process.env.PROVISION_CONCURRENCY ? parseInt(process.env.PROVISION_CONCURRENCY) : 0,
  throttlingOverride: process.env.THROTTLE_PER_FIVE_MINS,
  ethGasStationInfoUrl: process.env.ETH_GAS_STATION_INFO_URL!,
  chatbotSNSArn: process.env.CHATBOT_SNS_ARN,
  stage: STAGE.LOCAL,
  internalApiKey: 'test-api-key',
  route53Arn: process.env.ROLE_ARN,
  pinata_key: process.env.PINATA_API_KEY!,
  pinata_secret: process.env.PINATA_API_SECRET!,
  hosted_zone: process.env.HOSTED_ZONE!,
  tenderlyUser: process.env.TENDERLY_USER!,
  tenderlyProject: process.env.TENDERLY_PROJECT!,
  tenderlyAccessKey: process.env.TENDERLY_ACCESS_KEY!,
  tenderlyNodeApiKey: process.env.TENDERLY_NODE_API_KEY!,
  unicornSecret: process.env.UNICORN_SECRET!,
  uniGraphQLEndpoint: process.env.GQL_URL!,
  uniGraphQLHeaderOrigin: process.env.GQL_H_ORGN!,
  alchemyQueryKey: process.env.ALCHEMY_QUERY_KEY!,
  alchemyQueryKey2: process.env.ALCHEMY_QUERY_KEY_2!,
  graphBaseV4SubgraphId: process.env.GRAPH_BASE_V4_SUBGRAPH_ID!,
  graphBearerToken: process.env.GRAPH_BEARER_TOKEN!,
  graphBearerToken_X_LAYER: process.env.GRAPH_BEARER_TOKEN_X_LAYER!,
  graphBearerToken_HYPER: process.env.GOLDSKY_API_KEY || '',
  graphBearerToken_BNB: process.env.GRAPH_BEARER_TOKEN_BNB || process.env.GOLDSKY_API_KEY || '',
  graphBearerToken_MEGAETH: process.env.GRAPH_BEARER_TOKEN_MEGAETH || process.env.GOLDSKY_API_KEY || '',
  robinhoodFewV2SubgraphUrl: process.env.ROBINHOOD_FEWV2_SUBGRAPH_URL || process.env.GRAPH_FEWV2_SUBGRAPH_URL_ROBINHOOD,
  graphBearerToken_ROBINHOOD: process.env.GRAPH_BEARER_TOKEN_ROBINHOOD,
  // Extra per-chain Graph bearer tokens (optional)
  graphBearerToken_ARB: process.env.GRAPH_BEARER_TOKEN_ARB || '',
  graphBearerToken_BASE: process.env.GRAPH_BEARER_TOKEN_BASE || '',
  graphBearerToken_UNICHAIN: process.env.GRAPH_BEARER_TOKEN_UNICHAIN || '',
})

new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
  env: { account: '513278913266', region: 'us-east-1' },
})
