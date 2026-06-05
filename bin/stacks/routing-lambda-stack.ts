import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration } from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as asg from 'aws-cdk-lib/aws-applicationautoscaling'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import * as path from 'path'
import { DynamoDBTableProps } from './routing-database-stack'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'

export interface RoutingLambdaStackProps extends cdk.NestedStackProps {
  poolCacheBucket: aws_s3.Bucket
  poolCacheBucket2: aws_s3.Bucket
  poolCacheBucket3: aws_s3.Bucket
  poolCacheKey: string
  poolCacheGzipKey: string
  jsonRpcProviders: { [chainName: string]: string }
  tokenListCacheBucket: aws_s3.Bucket
  provisionedConcurrency: number
  ethGasStationInfoUrl: string
  tenderlyUser: string
  tenderlyProject: string
  tenderlyAccessKey: string
  tenderlyNodeApiKey: string
  chatbotSNSArn?: string
  routesDynamoDb: aws_dynamodb.Table
  routesDbCachingRequestFlagDynamoDb: aws_dynamodb.Table
  cachedRoutesDynamoDb: aws_dynamodb.Table
  cachingRequestFlagDynamoDb: aws_dynamodb.Table
  cachedV3PoolsDynamoDb: aws_dynamodb.Table
  cachedV2PairsDynamoDb: aws_dynamodb.Table
  cachedFewV2PairsDynamoDb: aws_dynamodb.Table
  tokenPropertiesCachingDynamoDb: aws_dynamodb.Table
  rpcProviderHealthStateDynamoDb: aws_dynamodb.Table
  unicornSecret: string
  uniGraphQLEndpoint: string
  uniGraphQLHeaderOrigin: string
}
export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction
  public readonly routingLambdaAlias: aws_lambda.Alias
  public readonly susdrStatusLambda: aws_lambda_nodejs.NodejsFunction
  public readonly susdrRedeemSimLambda: aws_lambda_nodejs.NodejsFunction
  public readonly susdrV2PoolsLambda: aws_lambda_nodejs.NodejsFunction
  public readonly susdrLiquidityLambda: aws_lambda_nodejs.NodejsFunction
  public readonly susdrReadinessLambda: aws_lambda_nodejs.NodejsFunction

  constructor(scope: Construct, name: string, props: RoutingLambdaStackProps) {
    super(scope, name, props)
    const {
      poolCacheBucket,
      poolCacheBucket2,
      poolCacheBucket3,
      poolCacheGzipKey,
      jsonRpcProviders,
      tokenListCacheBucket,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      tenderlyNodeApiKey,
      routesDynamoDb,
      routesDbCachingRequestFlagDynamoDb,
      cachedRoutesDynamoDb,
      cachingRequestFlagDynamoDb,
      cachedV3PoolsDynamoDb,
      cachedV2PairsDynamoDb,
      cachedFewV2PairsDynamoDb,
      tokenPropertiesCachingDynamoDb,
      rpcProviderHealthStateDynamoDb,
      unicornSecret,
      uniGraphQLEndpoint,
      uniGraphQLHeaderOrigin,
    } = props

    new CfnOutput(this, 'jsonRpcProviders', {
      value: JSON.stringify(jsonRpcProviders),
    })

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })
    const susdrReadOnlyLambdaRole = new aws_iam.Role(this, 'SusdrReadOnlyLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })
    poolCacheBucket.grantRead(lambdaRole)
    poolCacheBucket2.grantRead(lambdaRole)
    poolCacheBucket3.grantRead(lambdaRole)
    tokenListCacheBucket.grantRead(lambdaRole)
    routesDynamoDb.grantReadWriteData(lambdaRole)
    routesDbCachingRequestFlagDynamoDb.grantReadWriteData(lambdaRole)
    cachedRoutesDynamoDb.grantReadWriteData(lambdaRole)
    cachingRequestFlagDynamoDb.grantReadWriteData(lambdaRole)
    cachedV3PoolsDynamoDb.grantReadWriteData(lambdaRole)
    cachedV2PairsDynamoDb.grantReadWriteData(lambdaRole)
    cachedFewV2PairsDynamoDb.grantReadWriteData(lambdaRole)
    tokenPropertiesCachingDynamoDb.grantReadWriteData(lambdaRole)
    rpcProviderHealthStateDynamoDb.grantReadWriteData(lambdaRole)

    const region = cdk.Stack.of(this).region
    const susdrReadOnlyEnvironment = {
      VERSION: '1',
      NODE_OPTIONS: '--enable-source-maps',
      SUSDR_V2_POOLS_JSON: process.env.SUSDR_V2_POOLS_JSON ?? '[]',
      SUSDR_LIQUIDITY_SOURCES_JSON: process.env.SUSDR_LIQUIDITY_SOURCES_JSON ?? '[]',
      ...jsonRpcProviders,
    }

    const cachingRoutingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'CachingRoutingLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteHandler',
      // 04/18/2025: async routing lambda can have much longer timeout
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,//5120->3008
      deadLetterQueueEnabled: true,
      bundling: {
        minify: true,
        sourceMap: true,
        keepNames: true,
      },

      awsSdkConnectionReuse: true,

      description: 'Caching Routing Lambda',
      environment: {
        VERSION: '3',
        NODE_OPTIONS: '--enable-source-maps',
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_3: poolCacheBucket3.bucketName,
        POOL_CACHE_GZIP_KEY: poolCacheGzipKey,
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
        TENDERLY_USER: tenderlyUser,
        TENDERLY_PROJECT: tenderlyProject,
        TENDERLY_ACCESS_KEY: tenderlyAccessKey,
        TENDERLY_NODE_API_KEY: tenderlyNodeApiKey,
        // WARNING: Dynamo table name should be the tableinstance.name, e.g. routesDynamoDb.tableName.
        //          But we tried and had seen lambd version error:
        //          The following resource(s) failed to create: [RoutingLambda2CurrentVersion49A1BB948389ce4f9c26b15e2ccb07b4c1bab726].
        //          2023-09-01 10:22:43 UTC-0700RoutingLambda2CurrentVersion49A1BB948389ce4f9c26b15e2ccb07b4c1bab726CREATE_FAILED
        //          A version for this Lambda function exists ( 261 ). Modify the function to create a new version.
        //          Hence we do not want to modify the table name below.
        ROUTES_TABLE_NAME: DynamoDBTableProps.RoutesDbTable.Name,
        ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
        CACHED_ROUTES_TABLE_NAME: DynamoDBTableProps.CacheRouteDynamoDbTable.Name,
        CACHING_REQUEST_FLAG_TABLE_NAME: DynamoDBTableProps.CachingRequestFlagDynamoDbTable.Name,
        CACHED_V3_POOLS_TABLE_NAME: DynamoDBTableProps.V3PoolsDynamoDbTable.Name,
        V2_PAIRS_CACHE_TABLE_NAME: DynamoDBTableProps.V2PairsDynamoCache.Name,
        FEW_V2_PAIRS_CACHE_TABLE_NAME: DynamoDBTableProps.FewV2PairsDynamoCache.Name,
        RPC_PROVIDER_HEALTH_TABLE_NAME: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,

        // tokenPropertiesCachingDynamoDb.tableName is the correct format.
        // we will start using the correct ones going forward
        TOKEN_PROPERTIES_CACHING_TABLE_NAME: tokenPropertiesCachingDynamoDb.tableName,
        UNICORN_SECRET: unicornSecret,
        GQL_URL: uniGraphQLEndpoint,
        GQL_H_ORGN: uniGraphQLHeaderOrigin,
        ...jsonRpcProviders,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'CachingInsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.TWO_WEEKS,
    })

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'RoutingLambda2', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteHandler',
      // 11/8/23: URA currently calls the Routing API with a timeout of 10 seconds.
      // Set this lambda's timeout to be slightly lower to give them time to
      // log the response in the event of a failure on our end.
      timeout: cdk.Duration.seconds(15),
      memorySize: 2048,//3008,//5120,
      deadLetterQueueEnabled: true,
      bundling: {
        minify: true,
        sourceMap: true,
        keepNames: true,
      },

      awsSdkConnectionReuse: true,

      description: 'Routing Lambda',
      environment: {
        // Application version identifier for tracking and debugging
        VERSION: '30',
        // Node.js runtime options: enable source maps for better error stack traces
        NODE_OPTIONS: '--enable-source-maps',

        // S3 bucket configurations for pool and token list caching
        // POOL_CACHE_BUCKET: Legacy pool cache bucket (deprecated, kept for backward compatibility)
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        // POOL_CACHE_BUCKET_3: Current pool cache bucket storing compressed pool data
        POOL_CACHE_BUCKET_3: poolCacheBucket3.bucketName,
        // POOL_CACHE_GZIP_KEY: S3 key prefix for gzipped pool cache files
        POOL_CACHE_GZIP_KEY: poolCacheGzipKey,
        // TOKEN_LIST_CACHE_BUCKET: S3 bucket for caching token list data
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,

        // External service configurations
        // ETH_GAS_STATION_INFO_URL: URL for fetching Ethereum gas price information
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
        // Tenderly simulation service credentials for transaction simulation
        TENDERLY_USER: tenderlyUser,
        TENDERLY_PROJECT: tenderlyProject,
        TENDERLY_ACCESS_KEY: tenderlyAccessKey,
        TENDERLY_NODE_API_KEY: tenderlyNodeApiKey,

        // DynamoDB table names for route caching and pool data storage
        // WARNING: Dynamo table name should be the tableinstance.name, e.g. routesDynamoDb.tableName.
        //          But we tried and had seen lambd version error:
        //          The following resource(s) failed to create: [RoutingLambda2CurrentVersion49A1BB948389ce4f9c26b15e2ccb07b4c1bab726].
        //          2023-09-01 10:22:43 UTC-0700RoutingLambda2CurrentVersion49A1BB948389ce4f9c26b15e2ccb07b4c1bab726CREATE_FAILED
        //          A version for this Lambda function exists ( 261 ). Modify the function to create a new version.
        //          Hence we do not want to modify the table name below.
        // ROUTES_TABLE_NAME: Stores cached route data for faster quote retrieval
        ROUTES_TABLE_NAME: DynamoDBTableProps.RoutesDbTable.Name,
        // ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME: Tracks which routes are being cached to avoid duplicate work
        ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
        // CACHED_ROUTES_TABLE_NAME: Alternative cached routes storage table
        CACHED_ROUTES_TABLE_NAME: DynamoDBTableProps.CacheRouteDynamoDbTable.Name,
        // CACHING_REQUEST_FLAG_TABLE_NAME: Flags for caching request coordination
        CACHING_REQUEST_FLAG_TABLE_NAME: DynamoDBTableProps.CachingRequestFlagDynamoDbTable.Name,
        // CACHED_V3_POOLS_TABLE_NAME: DynamoDB table for caching V3 pool data
        CACHED_V3_POOLS_TABLE_NAME: DynamoDBTableProps.V3PoolsDynamoDbTable.Name,
        // V2_PAIRS_CACHE_TABLE_NAME: DynamoDB table for caching V2 pair data
        V2_PAIRS_CACHE_TABLE_NAME: DynamoDBTableProps.V2PairsDynamoCache.Name,
        // FEW_V2_PAIRS_CACHE_TABLE_NAME: DynamoDB table for caching FewV2 pair data
        FEW_V2_PAIRS_CACHE_TABLE_NAME: DynamoDBTableProps.FewV2PairsDynamoCache.Name,
        // RPC_PROVIDER_HEALTH_TABLE_NAME: Tracks health status of RPC providers for failover logic
        RPC_PROVIDER_HEALTH_TABLE_NAME: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,

        // tokenPropertiesCachingDynamoDb.tableName is the correct format.
        // we will start using the correct ones going forward
        // TOKEN_PROPERTIES_CACHING_TABLE_NAME: Stores token metadata and properties (fees, etc.)
        TOKEN_PROPERTIES_CACHING_TABLE_NAME: tokenPropertiesCachingDynamoDb.tableName,

        // Security and feature flags
        // UNICORN_SECRET: Secret key for enabling debug/experimental features via unicorn header
        UNICORN_SECRET: unicornSecret,

        // GraphQL service configuration for token fee (FOT - Fee On Transfer) fetching
        // Token Fee 说明：
        // 1. 什么是 Token Fee (FOT)：
        //    - 某些 ERC20 token 在转账时会自动收取费用（Fee On Transfer）
        //    - 买入费用 (buyFeeBps): 购买 token 时收取的费用，以基点 (basis points, 1 bps = 0.01%) 表示
        //    - 卖出费用 (sellFeeBps): 出售 token 时收取的费用，以基点表示
        //    - 例如：如果 buyFeeBps = 100，表示买入时收取 1% 的费用
        //
        // 2. 为什么需要查询 Token Fee：
        //    - 在计算路由报价时，必须考虑这些费用才能准确计算用户实际可获得的 token 数量
        //    - 如果不考虑 FOT，报价会不准确：用户实际收到的 token 数量会少于报价显示的数量
        //    - 例如：报价显示可换 100 USDT，但如果 USDT 有 1% 的卖出费用，用户实际只能收到 99 USDT
        //    - 这会导致用户体验差（实际收到少于预期）或交易失败（滑点保护触发）
        //
        // 3. GraphQL Token Fee 查询的优势：
        //    - 比链上查询更快：GraphQL API 提供预计算的 token fee 数据
        //    - 降低 RPC 调用成本：减少对区块链的直接查询
        //    - 有回退机制：如果 GraphQL 查询失败或某些 token 未找到，会自动回退到链上查询
        //    - 动态 FOT 处理：对于动态 FOT token（费用可能变化），仍使用链上查询获取最新数据
        //
        // 4. 查询的数据包括：
        //    - buyFeeBps: 买入费用（基点）
        //    - sellFeeBps: 卖出费用（基点）
        //    - feeTakenOnTransfer: 是否在转账时收取费用
        //    - externalTransferFailed: 外部转账是否失败
        //    - sellReverted: 卖出交易是否会被回滚
        //
        // GQL_URL: UniGraphQL endpoint URL for querying token fee data
        GQL_URL: uniGraphQLEndpoint,
        // GQL_H_ORGN: Origin header value for GraphQL requests (required for API authentication)
        GQL_H_ORGN: uniGraphQLHeaderOrigin,

        // Lambda function references
        // CACHING_ROUTING_LAMBDA_FUNCTION_NAME: Name of the async caching routing lambda for background route caching
        CACHING_ROUTING_LAMBDA_FUNCTION_NAME: cachingRoutingLambda.functionName,

        // RPC provider configurations: JSON object mapping chain names to RPC endpoint URLs
        // Format: { "WEB3_RPC_1": "https://...", "WEB3_RPC_137": "https://...", ... }
        // Used for chains that don't use the RPC gateway (legacy support)
        ...jsonRpcProviders,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.ONE_WEEK,
    })

    const createSusdrReadOnlyLambda = (id: string, handler: string, description: string, layerId: string) =>
      new aws_lambda_nodejs.NodejsFunction(this, id, {
        role: susdrReadOnlyLambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, '../../lib/handlers/susdr/index.ts'),
        handler,
        timeout: cdk.Duration.seconds(5),
        memorySize: 512,
        deadLetterQueueEnabled: true,
        bundling: {
          minify: true,
          sourceMap: true,
          keepNames: true,
        },
        awsSdkConnectionReuse: true,
        description,
        environment: susdrReadOnlyEnvironment,
        layers: [
          aws_lambda.LayerVersion.fromLayerVersionArn(
            this,
            layerId,
            `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
          ),
        ],
        tracing: aws_lambda.Tracing.ACTIVE,
        logRetention: RetentionDays.ONE_WEEK,
      })

    this.susdrStatusLambda = createSusdrReadOnlyLambda(
      'SusdrStatusLambda',
      'susdrStatusHandler',
      'sUSDR read-only risk status Lambda',
      'SusdrStatusInsightsLayer'
    )
    this.susdrRedeemSimLambda = createSusdrReadOnlyLambda(
      'SusdrRedeemSimLambda',
      'susdrRedeemSimHandler',
      'sUSDR instant redemption simulator Lambda',
      'SusdrRedeemSimInsightsLayer'
    )
    this.susdrV2PoolsLambda = createSusdrReadOnlyLambda(
      'SusdrV2PoolsLambda',
      'susdrV2PoolsHandler',
      'sUSDR read-only V2 pool snapshot Lambda',
      'SusdrV2PoolsInsightsLayer'
    )
    this.susdrLiquidityLambda = createSusdrReadOnlyLambda(
      'SusdrLiquidityLambda',
      'susdrLiquidityHandler',
      'sUSDR read-only liquidity source Lambda',
      'SusdrLiquidityInsightsLayer'
    )
    this.susdrReadinessLambda = createSusdrReadOnlyLambda(
      'SusdrReadinessLambda',
      'susdrReadinessHandler',
      'sUSDR read-only config readiness Lambda',
      'SusdrReadinessInsightsLayer'
    )

    const cachingLambdaAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'CachingRoutingAPI-LambdaErrorRate', {
      metric: new aws_cloudwatch.MathExpression({
        expression: 'errors / invocations',
        usingMetrics: {
          errors: cachingRoutingLambda.metricErrors({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
          invocations: cachingRoutingLambda.metricInvocations({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
        },
      }),
      threshold: 0.05,
      evaluationPeriods: 3,
    })
    const lambdaAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-LambdaErrorRate', {
      metric: new aws_cloudwatch.MathExpression({
        expression: 'errors / invocations',
        usingMetrics: {
          errors: this.routingLambda.metricErrors({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
          invocations: this.routingLambda.metricInvocations({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
        },
      }),
      threshold: 0.05,
      evaluationPeriods: 3,
    })

    const cachingLambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(this, 'CachingRoutingAPI-LambdaThrottles', {
      metric: cachingRoutingLambda.metricThrottles({
        period: Duration.minutes(5),
        statistic: 'sum',
      }),
      threshold: 10,
      evaluationPeriods: 3,
    })
    const lambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-LambdaThrottles', {
      metric: this.routingLambda.metricThrottles({
        period: Duration.minutes(5),
        statistic: 'sum',
      }),
      threshold: 10,
      evaluationPeriods: 3,
    })

    if (chatbotSNSArn) {
      const chatBotTopic = aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn)

      cachingLambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      cachingLambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
    }

    const enableProvisionedConcurrency = provisionedConcurrency > 0

    const cachingRoutingLambdaAlias = new aws_lambda.Alias(this, 'CachingRoutingLiveAlias', {
      aliasName: 'live',
      version: cachingRoutingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency ? provisionedConcurrency : undefined,
    })
    this.routingLambdaAlias = new aws_lambda.Alias(this, 'RoutingLiveAlias', {
      aliasName: 'live',
      version: this.routingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency ? provisionedConcurrency : undefined,
    })

    if (enableProvisionedConcurrency) {
      const cachingTarget = new asg.ScalableTarget(this, 'CachingRoutingProvConcASG', {
        serviceNamespace: asg.ServiceNamespace.LAMBDA,
        maxCapacity: provisionedConcurrency * 10,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${cachingRoutingLambdaAlias.lambda.functionName}:${cachingRoutingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      })

      cachingTarget.node.addDependency(cachingRoutingLambdaAlias)

      cachingTarget.scaleToTrackMetric('CachingRoutingProvConcTracking', {
        targetValue: 0.7,
        predefinedMetric: asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      })

      const target = new asg.ScalableTarget(this, 'RoutingProvConcASG', {
        serviceNamespace: asg.ServiceNamespace.LAMBDA,
        maxCapacity: provisionedConcurrency * 10,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${this.routingLambdaAlias.lambda.functionName}:${this.routingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      })

      target.node.addDependency(this.routingLambdaAlias)

      target.scaleToTrackMetric('RoutingProvConcTracking', {
        targetValue: 0.7,
        predefinedMetric: asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      })
    }
  }
}
