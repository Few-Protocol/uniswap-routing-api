import Joi from '@hapi/joi'
import { MetricLoggerUnit } from '@ring-protocol/smart-order-router'
import { APIGLambdaHandler, HandleRequestParams, Response } from '../handler'
import { SusdrContainerInjected, SusdrRequestInjected } from './injector'
import { SusdrReadinessQueryParams, SusdrReadinessQueryParamsJoi, SusdrReadinessReportSchemaJoi } from './schema'
import { buildSusdrReadinessReport, SusdrReadinessReport } from '../../susdr'

export class SusdrReadinessHandler extends APIGLambdaHandler<
  SusdrContainerInjected,
  SusdrRequestInjected,
  void,
  SusdrReadinessQueryParams,
  SusdrReadinessReport
> {
  public async handleRequest(
    params: HandleRequestParams<SusdrContainerInjected, SusdrRequestInjected, void, SusdrReadinessQueryParams>
  ): Promise<Response<SusdrReadinessReport>> {
    const query = params.requestQueryParams ?? { chainId: 1 }
    const report = buildSusdrReadinessReport({
      chainId: query.chainId,
      liquiditySourceConfigs: params.containerInjected.liquiditySourceConfigs,
      v2PoolConfigs: params.containerInjected.v2PoolConfigs,
    })

    params.requestInjected.metric.putMetric(
      report.strictReady ? 'SUSDR_READINESS_STRICT_READY' : 'SUSDR_READINESS_STRICT_MISSING',
      1,
      MetricLoggerUnit.Count
    )

    return {
      statusCode: 200,
      body: report,
    }
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return SusdrReadinessQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return SusdrReadinessReportSchemaJoi
  }
}
