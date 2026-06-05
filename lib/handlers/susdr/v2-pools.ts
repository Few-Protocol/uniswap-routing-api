import Joi from '@hapi/joi'
import { Provider } from '@ethersproject/providers'
import { MetricLoggerUnit } from '@ring-protocol/smart-order-router'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { SusdrContainerInjected, SusdrRequestInjected } from './injector'
import { SusdrV2PoolsQueryParams, SusdrV2PoolsQueryParamsJoi, SusdrV2PoolsReportSchemaJoi } from './schema'
import {
  buildSusdrReadOnlyProvider,
  isSusdrAutoRingV2PoolsEnabled,
  readV2PoolSnapshot,
  resolveDefaultSusdrV2PoolConfigs,
  SusdrV2PoolConfig,
  SusdrV2PoolsReport,
} from '../../susdr'

function parseAddressList(raw: string | undefined): string[] {
  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address.length > 0)
}

function directPoolConfig(query: SusdrV2PoolsQueryParams): SusdrV2PoolConfig | undefined {
  if (!query.poolAddress) {
    return undefined
  }

  return {
    poolAddress: query.poolAddress,
    label: query.label ?? query.poolAddress,
    capacityMode: query.capacityMode ?? 'team-lp',
    teamAddresses: parseAddressList(query.teamAddresses),
    usableTeamLpBps: query.capacityMode === 'full-reserve' ? 10_000 : query.usableTeamLpBps ?? 0,
    maxSlippageBps: query.capacityMode === 'full-reserve' ? query.maxSlippageBps ?? 50 : query.maxSlippageBps,
  }
}

export class SusdrV2PoolsHandler extends APIGLambdaHandler<
  SusdrContainerInjected,
  SusdrRequestInjected,
  void,
  SusdrV2PoolsQueryParams,
  SusdrV2PoolsReport
> {
  public async handleRequest(
    params: HandleRequestParams<SusdrContainerInjected, SusdrRequestInjected, void, SusdrV2PoolsQueryParams>
  ): Promise<Response<SusdrV2PoolsReport> | ErrorResponse> {
    const query = params.requestQueryParams ?? { chainId: 1 }
    const directConfig = directPoolConfig(query)
    let provider: Provider | undefined
    let configs = directConfig ? [directConfig] : params.containerInjected.v2PoolConfigs

    if (!directConfig && configs.length === 0 && isSusdrAutoRingV2PoolsEnabled()) {
      try {
        provider = buildSusdrReadOnlyProvider(query.chainId)
        configs = await resolveDefaultSusdrV2PoolConfigs(provider, query.chainId)
      } catch {
        configs = []
      }
    }

    if (configs.length === 0) {
      return {
        statusCode: 200,
        body: {
          chainId: query.chainId,
          generatedAtMs: Date.now(),
          pools: [],
        },
      }
    }

    try {
      const activeProvider = provider ?? buildSusdrReadOnlyProvider(query.chainId)
      const pools = await Promise.all(configs.map((config) => readV2PoolSnapshot(activeProvider, config)))
      params.requestInjected.metric.putMetric('SUSDR_V2_POOLS_READ_SUCCESS', 1, MetricLoggerUnit.Count)

      return {
        statusCode: 200,
        body: {
          chainId: query.chainId,
          generatedAtMs: Date.now(),
          pools,
        },
      }
    } catch (error) {
      params.requestInjected.log.error({ error }, 'Failed to read sUSDR V2 pool snapshots')
      params.requestInjected.metric.putMetric('SUSDR_V2_POOLS_READ_FAILURE', 1, MetricLoggerUnit.Count)
      return {
        statusCode: 500,
        errorCode: 'SUSDR_V2_POOL_READ_FAILED',
        detail: 'Failed to read sUSDR V2 pool snapshots',
      }
    }
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return SusdrV2PoolsQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return SusdrV2PoolsReportSchemaJoi
  }
}
