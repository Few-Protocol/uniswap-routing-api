import {
  AlphaRouter,
  AlphaRouterConfig,
  ID_TO_CHAIN_ID,
  IRouter,
  LegacyRoutingConfig,
  setGlobalLogger,
  setGlobalMetric,
} from '@ring-protocol/smart-order-router'
import { V3HeuristicGasModelFactory } from '@ring-protocol/smart-order-router/build/main/routers/alpha-router/gas-models/v3/v3-heuristic-gas-model'
import { RingFewV2HeuristicGasModelFactory } from '@ring-protocol/smart-order-router/build/main/routers/alpha-router/gas-models/fewV2/v2-heuristic-gas-model'
import { MetricsLogger } from 'aws-embedded-metrics'
import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { default as bunyan, default as Logger } from 'bunyan'
import { BigNumber } from 'ethers'
import { ContainerInjected, InjectorSOR, RequestInjected } from '../injector-sor'
import { AWSMetricsLogger } from '../router-entities/aws-metrics-logger'
import { StaticGasPriceProvider } from '../router-entities/static-gas-price-provider'
import { QuoteQueryParams } from './schema/quote-schema'
export class QuoteHandlerInjector extends InjectorSOR<
  IRouter<AlphaRouterConfig | LegacyRoutingConfig>,
  QuoteQueryParams
> {
  public async getRequestInjected(
    containerInjected: ContainerInjected,
    _requestBody: void,
    requestQueryParams: QuoteQueryParams,
    _event: APIGatewayProxyEvent,
    context: Context,
    log: Logger,
    metricsLogger: MetricsLogger
  ): Promise<RequestInjected<IRouter<AlphaRouterConfig | LegacyRoutingConfig>>> {
    const {
      tokenInAddress,
      tokenInChainId,
      tokenOutAddress,
      amount,
      type,
      algorithm,
      gasPriceWei,
      quoteSpeed,
      intent,
      gasToken,
      enableDebug,
    } = requestQueryParams

    const { dependencies, activityId } = containerInjected

    const requestId = context.awsRequestId
    const quoteId = requestId.substring(0, 5)
    // Sample 10% of all requests at the INFO log level for debugging purposes.
    // All other requests will only log warnings and errors.
    // Note that we use WARN as a default rather than ERROR
    // to capture Tapcompare logs in the smart-order-router.
    const logLevel = enableDebug ? bunyan.DEBUG : Math.random() < 0.1 ? bunyan.INFO : bunyan.WARN

    log = log.child({
      serializers: bunyan.stdSerializers,
      level: logLevel,
      requestId,
      quoteId,
      tokenInAddress,
      chainId: tokenInChainId,
      tokenOutAddress,
      amount,
      type,
      algorithm,
      gasToken,
      activityId: activityId,
    })
    setGlobalLogger(log)

    metricsLogger.setNamespace('Uniswap')
    metricsLogger.setDimensions({ Service: 'RoutingAPI' })
    const metric = new AWSMetricsLogger(metricsLogger)
    setGlobalMetric(metric)

    // Today API is restricted such that both tokens must be on the same chain.
    const chainId = tokenInChainId
    const chainIdEnum = ID_TO_CHAIN_ID(chainId)

    if (!dependencies[chainIdEnum]) {
      // Request validation should prevent reject unsupported chains with 4xx already, so this should not be possible.
      throw new Error(`No container injected dependencies for chain: ${chainIdEnum}`)
    }

    const {
      provider,
      v4PoolProvider,
      v4SubgraphProvider,
      v3PoolProvider,
      multicallProvider,
      ringSwapMulticall2Provider,
      tokenProvider,
      tokenListProvider,
      v3SubgraphProvider,
      blockedTokenListProvider,
      v2PoolProvider,
      fewV2PoolProvider,
      tokenValidatorProvider,
      tokenPropertiesProvider,
      v2QuoteProvider,
      ringV2QuoteProvider,
      v2SubgraphProvider,
      ringV2SubgraphProvider,
      gasPriceProvider: gasPriceProviderOnChain,
      simulator,
      routeCachingProvider,
      v2Supported,
      v4Supported,
      mixedSupported,
      mixedCrossLiquidityV3AgainstV4Supported,
      v4PoolParams,
      cachedRoutesCacheInvalidationFixRolloutPercentage,
      deleteCacheEnabledChains,
    } = dependencies[chainIdEnum]!

    let onChainQuoteProvider = dependencies[chainIdEnum]!.onChainQuoteProvider
    let gasPriceProvider = gasPriceProviderOnChain
    if (gasPriceWei) {
      const gasPriceWeiBN = BigNumber.from(gasPriceWei)
      gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN)
    }

    let router
    switch (algorithm) {
      case 'alpha':
      default:
        router = new AlphaRouter({
          chainId,
          provider,
          v4SubgraphProvider,
          v4PoolProvider,
          v3SubgraphProvider,
          multicall2Provider: multicallProvider,
          ringFewV2Multicall2Provider: ringSwapMulticall2Provider,
          v3PoolProvider,
          onChainQuoteProvider,
          gasPriceProvider,
          v3GasModelFactory: new V3HeuristicGasModelFactory(provider),
          ringFewV2GasModelFactory: new RingFewV2HeuristicGasModelFactory(provider),
          blockedTokenListProvider,
          tokenProvider,
          v2PoolProvider,
          ringFewV2PoolProvider: fewV2PoolProvider,
          v2QuoteProvider,
          ringFewV2QuoteProvider: ringV2QuoteProvider,
          v2SubgraphProvider,
          ringFewV2SubgraphProvider: ringV2SubgraphProvider,
          simulator,
          routeCachingProvider,
          tokenValidatorProvider,
          tokenPropertiesProvider,
          v2Supported,
          v4Supported,
          mixedSupported,
          mixedCrossLiquidityV3AgainstV4Supported,
          v4PoolParams,
          cachedRoutesCacheInvalidationFixRolloutPercentage,
          deleteCacheEnabledChains,
        })
        break
    }

    return {
      chainId: chainIdEnum,
      id: quoteId,
      log,
      metric,
      router,
      v4PoolProvider,
      v3PoolProvider,
      v2PoolProvider,
      fewV2PoolProvider,
      tokenProvider,
      tokenListProvider,
      quoteSpeed,
      intent,
    }
  }
}
