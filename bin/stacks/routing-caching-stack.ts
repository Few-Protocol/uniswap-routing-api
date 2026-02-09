import { Protocol } from '@ring-protocol/router-sdk'
import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { MathExpression } from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_events from 'aws-cdk-lib/aws-events'
import * as aws_events_targets from 'aws-cdk-lib/aws-events-targets'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import * as path from 'path'
import { chainProtocols } from '../../lib/cron/cache-config'
import { STAGE } from '../../lib/util/stage'
import { PoolCachingFilePrefixes } from '../../lib/util/poolCachingFilePrefixes'
import { ChainId } from '@ring-protocol/sdk-core'

export interface RoutingCachingStackProps extends cdk.NestedStackProps {
  stage: string
  route53Arn?: string
  pinata_key?: string
  pinata_secret?: string
  hosted_zone?: string
  chatbotSNSArn?: string
  alchemyQueryKey?: string
  alchemyQueryKey2?: string
  graphBaseV4SubgraphId?: string
  graphBearerToken?: string
  graphBearerToken_X_LAYER?: string
  graphBearerToken_HYPER?: string
  graphBearerToken_BSC?: string
  graphBearerToken_BNB?: string
  graphBearerToken_MEGAETH?: string
}

export class RoutingCachingStack extends cdk.NestedStack {
  public readonly poolCacheBucket: aws_s3.Bucket
  public readonly poolCacheBucket2: aws_s3.Bucket
  public readonly poolCacheBucket3: aws_s3.Bucket
  public readonly poolCacheKey: string
  public readonly poolCacheGzipKey: string
  public readonly tokenListCacheBucket: aws_s3.Bucket
  public readonly poolCacheLambdaNameArray: string[] = []
  public readonly alchemyQueryKey: string | undefined = undefined
  public readonly alchemyQueryKey2: string | undefined = undefined
  public readonly graphBaseV4SubgraphId: string | undefined = undefined
  public readonly graphBearerToken: string | undefined = undefined
  public readonly graphBearerToken_X_LAYER: string | undefined = undefined
  public readonly graphBearerToken_HYPER: string | undefined = undefined
  public readonly graphBearerToken_BSC: string | undefined = undefined
  public readonly graphBearerToken_BNB: string | undefined = undefined
  public readonly graphBearerToken_MEGAETH: string | undefined = undefined

  constructor(scope: Construct, name: string, props: RoutingCachingStackProps) {
    super(scope, name, props)

    const { chatbotSNSArn, alchemyQueryKey, alchemyQueryKey2, graphBaseV4SubgraphId, graphBearerToken, graphBearerToken_X_LAYER, graphBearerToken_HYPER, graphBearerToken_BSC, graphBearerToken_BNB, graphBearerToken_MEGAETH } = props

    const chatBotTopic = chatbotSNSArn ? aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn) : undefined

    this.alchemyQueryKey = alchemyQueryKey
    this.alchemyQueryKey2 = alchemyQueryKey2
    this.graphBaseV4SubgraphId = graphBaseV4SubgraphId
    this.graphBearerToken = graphBearerToken
    this.graphBearerToken_X_LAYER = graphBearerToken_X_LAYER
    this.graphBearerToken_HYPER = graphBearerToken_HYPER
    this.graphBearerToken_BSC = graphBearerToken_BSC
    this.graphBearerToken_BNB = graphBearerToken_BNB
    this.graphBearerToken_MEGAETH = graphBearerToken_MEGAETH
    // TODO: Remove and swap to the new bucket below. Kept around for the rollout, but all requests will go to bucket 2.
    this.poolCacheBucket = new aws_s3.Bucket(this, 'PoolCacheBucket')
    this.poolCacheBucket2 = new aws_s3.Bucket(this, 'PoolCacheBucket2')
    this.poolCacheBucket3 = new aws_s3.Bucket(this, 'PoolCacheBucket3')

    this.poolCacheBucket2.addLifecycleRule({
      enabled: true,
      // This isn't the right fix in the long run, but it will prevent the outage that we experienced when the V2 pool
      // data expired (See https://www.notion.so/uniswaplabs/Routing-API-Mainnet-outage-V2-Subgraph-11527aab3bd540888f92b33017bf26b4 for more detail).
      // The better short-term solution is to bake resilience into the V2SubgraphProvider (https://linear.app/uniswap/issue/ROUTE-31/use-v2-v3-fallback-provider-in-routing-api),
      // instrument the pool cache lambda, and take measures to improve its success rate.

      // Note that there is a trade-off here: we may serve stale V2 pools which can result in a suboptimal routing path if the file hasn't been recently updated.
      // This stale data is preferred to no-data until we can implement the above measures.

      // For now, choose an arbitrarily large TTL (in this case, 10 years) to prevent the key from being deleted.
      expiration: cdk.Duration.days(365 * 10),
    })

    this.poolCacheBucket3.addLifecycleRule({
      enabled: true,
      // See the comment above for the reasoning behind this TTL.
      expiration: cdk.Duration.days(365 * 10),
    })

    this.poolCacheKey = PoolCachingFilePrefixes.PlainText
    this.poolCacheGzipKey = PoolCachingFilePrefixes.GzipText

    const { stage, route53Arn } = props

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
      ],
    })

    if (stage == STAGE.BETA || stage == STAGE.PROD) {
      lambdaRole.addToPolicy(
        new PolicyStatement({
          resources: [route53Arn!],
          actions: ['sts:AssumeRole'],
          sid: '1',
        })
      )
    }

    const region = cdk.Stack.of(this).region

    const lambdaLayerVersion = aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      'InsightsLayerPools',
      `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
    )

    // Spin up a new pool cache lambda for each config in chain X protocol
    for (let i = 0; i < chainProtocols.length; i++) {
      const { protocol, chainId, timeout } = chainProtocols[i]
      // 使用简短易懂的函数名，避免被 AWS 截断
      // 格式: PoolCache-Chain{chainId}-{protocol}
      // 例如: PoolCache-Chain1-FEWV2, PoolCache-Chain1-V3
      const functionName = `PoolCache-Chain${chainId}-${protocol}`
      const lambda = new aws_lambda_nodejs.NodejsFunction(
        this,
        `PoolCacheLambda-ChainId${chainId}-Protocol${protocol}`,
        {
          functionName,
          role: lambdaRole,
          runtime: aws_lambda.Runtime.NODEJS_18_X,
          entry: path.join(__dirname, '../../lib/cron/cache-pools.ts'),
          handler: 'handler',
          timeout: Duration.seconds(900),
          memorySize: chainId === ChainId.BASE ? 1024 : 1024,//3008 : 2560,
          bundling: {
            minify: true,
            sourceMap: true,
            keepNames: true,
          },
          description: `Pool Cache Lambda for Chain ${chainId} - ${protocol}`,
          layers: [lambdaLayerVersion],
          tracing: aws_lambda.Tracing.ACTIVE,
          environment: {
            VERSION: '3',
            POOL_CACHE_BUCKET: this.poolCacheBucket.bucketName,
            POOL_CACHE_BUCKET_3: this.poolCacheBucket3.bucketName,
            POOL_CACHE_GZIP_KEY: this.poolCacheGzipKey,
            ALCHEMY_QUERY_KEY: this.alchemyQueryKey ?? '',
            ALCHEMY_QUERY_KEY_2: this.alchemyQueryKey2 ?? '',
            GRAPH_BASE_V4_SUBGRAPH_ID: this.graphBaseV4SubgraphId ?? '',
            GRAPH_BEARER_TOKEN: chainId === ChainId.XLAYER_MAINNET ? this.graphBearerToken_X_LAYER ?? '' : this.graphBearerToken ?? '',
            GRAPH_BEARER_TOKEN_X_LAYER: this.graphBearerToken_X_LAYER ?? '',
            // HYPER 和 BSC 使用 GOLDSKY_API_KEY 作为 bearer token
            // BNB 可使用 GOLDSKY_API_KEY 或 GRAPH_BEARER_TOKEN_BNB；cache-config 中优先 GOLDSKY_API_KEY，否则用 GRAPH_BEARER_TOKEN_BNB
            GRAPH_BEARER_TOKEN_HYPER: this.graphBearerToken_HYPER ?? '',
            GRAPH_BEARER_TOKEN_BSC: this.graphBearerToken_BSC ?? '',
            GRAPH_BEARER_TOKEN_BNB: this.graphBearerToken_BNB ?? this.graphBearerToken_BSC ?? '',
            GRAPH_BEARER_TOKEN_MEGAETH: this.graphBearerToken_MEGAETH ?? '',
            // 设置 GOLDSKY_API_KEY 到 Lambda 环境变量，供运行时使用
            // HYPER 和 BSC 共享同一个 GOLDSKY_API_KEY，优先使用 HYPER 的值（如果设置了）
            GOLDSKY_API_KEY: this.graphBearerToken_HYPER || this.graphBearerToken_BSC || '',
            GOLDSKY_PROJECT_ID: process.env.GOLDSKY_PROJECT_ID || '',
            chainId: chainId.toString(),
            protocol,
            timeout: timeout.toString(),
          },
        }
      )
      new aws_events.Rule(this, `SchedulePoolCache-ChainId${chainId}-Protocol${protocol}`, {
        schedule: aws_events.Schedule.rate(Duration.minutes(protocol === Protocol.FEWV2 ? 30 : 60)),
        targets: [new aws_events_targets.LambdaFunction(lambda)],
      })
      this.poolCacheBucket2.grantReadWrite(lambda)
      this.poolCacheBucket3.grantReadWrite(lambda)
      const lambdaAlarmErrorRate = new aws_cloudwatch.Alarm(
        this,
        `RoutingAPI-SEV4-PoolCacheToS3LambdaErrorRate-ChainId${chainId}-Protocol${protocol}`,
        {
          metric: new MathExpression({
            expression: '(invocations - errors) < 1',
            usingMetrics: {
              invocations: lambda.metricInvocations({
                period: Duration.minutes(60),
                statistic: 'sum',
              }),
              errors: lambda.metricErrors({
                period: Duration.minutes(60),
                statistic: 'sum',
              }),
            },
          }),
          threshold: protocol === Protocol.V3 ? 50 : 85,
          evaluationPeriods: protocol === Protocol.V3 ? 12 : 144,
        }
      )
      const lambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(
        this,
        `RoutingAPI-PoolCacheToS3LambdaThrottles-ChainId${chainId}-Protocol${protocol}`,
        {
          metric: lambda.metricThrottles({
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          threshold: 5,
          evaluationPeriods: 1,
        }
      )
      if (chatBotTopic) {
        lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
        lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      }
      this.poolCacheLambdaNameArray.push(lambda.functionName)
    }

    this.tokenListCacheBucket = new aws_s3.Bucket(this, 'TokenListCacheBucket')

    const tokenListCachingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'TokenListCacheLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/cron/cache-token-lists.ts'),
      handler: 'handler',
      timeout: Duration.seconds(180),
      memorySize: 1024,
      bundling: {
        minify: true,
        sourceMap: true,
        keepNames: true,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayerTokenList',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      description: 'Token List Cache Lambda',
      tracing: aws_lambda.Tracing.ACTIVE,
      environment: {
        TOKEN_LIST_CACHE_BUCKET: this.tokenListCacheBucket.bucketName,
      },
    })

    this.tokenListCacheBucket.grantReadWrite(tokenListCachingLambda)

    new aws_events.Rule(this, 'ScheduleTokenListCache', {
      schedule: aws_events.Schedule.rate(Duration.minutes(15)),
      targets: [new aws_events_targets.LambdaFunction(tokenListCachingLambda)],
    })
  }
}
