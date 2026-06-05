import Joi from '@hapi/joi'
import { MetricLoggerUnit } from '@ring-protocol/smart-order-router'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { SusdrContainerInjected, SusdrRequestInjected } from './injector'
import { SusdrLiquidityQueryParams, SusdrLiquidityQueryParamsJoi, SusdrLiquidityReportSchemaJoi } from './schema'
import { buildSusdrReadOnlyProvider, readLiquiditySources, SusdrLiquidityReport } from '../../susdr'

export class SusdrLiquidityHandler extends APIGLambdaHandler<
  SusdrContainerInjected,
  SusdrRequestInjected,
  void,
  SusdrLiquidityQueryParams,
  SusdrLiquidityReport
> {
  public async handleRequest(
    params: HandleRequestParams<SusdrContainerInjected, SusdrRequestInjected, void, SusdrLiquidityQueryParams>
  ): Promise<Response<SusdrLiquidityReport> | ErrorResponse> {
    const query = params.requestQueryParams ?? { chainId: 1 }

    if (params.containerInjected.liquiditySourceConfigs.length === 0) {
      return {
        statusCode: 200,
        body: {
          chainId: query.chainId,
          generatedAtMs: Date.now(),
          sources: [],
        },
      }
    }

    try {
      const provider = buildSusdrReadOnlyProvider(query.chainId)
      const sources = await readLiquiditySources(provider, params.containerInjected.liquiditySourceConfigs)
      params.requestInjected.metric.putMetric('SUSDR_LIQUIDITY_READ_SUCCESS', 1, MetricLoggerUnit.Count)

      return {
        statusCode: 200,
        body: {
          chainId: query.chainId,
          generatedAtMs: Date.now(),
          sources,
        },
      }
    } catch (error) {
      params.requestInjected.log.error({ error }, 'Failed to read sUSDR liquidity sources')
      params.requestInjected.metric.putMetric('SUSDR_LIQUIDITY_READ_FAILURE', 1, MetricLoggerUnit.Count)
      return {
        statusCode: 500,
        errorCode: 'SUSDR_LIQUIDITY_READ_FAILED',
        detail: 'Failed to read sUSDR liquidity sources',
      }
    }
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return SusdrLiquidityQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return SusdrLiquidityReportSchemaJoi
  }
}
