import { MetricsLogger } from 'aws-embedded-metrics'
import { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { default as Logger } from 'bunyan'
import { BaseRInj, Injector } from '../handler'
import {
  parseSusdrLiquiditySourceConfigs,
  parseSusdrV2PoolConfigs,
  SusdrLiquiditySourceConfig,
  SusdrV2PoolConfig,
} from '../../susdr'

export type SusdrContainerInjected = {
  v2PoolConfigs: SusdrV2PoolConfig[]
  liquiditySourceConfigs: SusdrLiquiditySourceConfig[]
}

export interface SusdrRequestInjected extends BaseRInj {
  metric: MetricsLogger
}

export class SusdrHandlerInjector<ReqQueryParams> extends Injector<
  SusdrContainerInjected,
  SusdrRequestInjected,
  void,
  ReqQueryParams
> {
  public async buildContainerInjected(): Promise<SusdrContainerInjected> {
    return {
      v2PoolConfigs: parseSusdrV2PoolConfigs(process.env.SUSDR_V2_POOLS_JSON),
      liquiditySourceConfigs: parseSusdrLiquiditySourceConfigs(process.env.SUSDR_LIQUIDITY_SOURCES_JSON),
    }
  }

  public async getRequestInjected(
    _containerInjected: SusdrContainerInjected,
    _requestBody: void,
    _requestQueryParams: ReqQueryParams,
    _event: APIGatewayProxyEvent,
    context: Context,
    log: Logger,
    metric: MetricsLogger
  ): Promise<SusdrRequestInjected> {
    metric.setNamespace('Ring')
    metric.setDimensions({ Service: 'RoutingAPI', Feature: 'sUSDR' })

    return {
      id: context.awsRequestId,
      log,
      metric,
    }
  }
}
