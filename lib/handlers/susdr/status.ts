import Joi from '@hapi/joi'
import { MetricLoggerUnit } from '@ring-protocol/smart-order-router'
import { APIGLambdaHandler, HandleRequestParams, Response } from '../handler'
import { SusdrContainerInjected, SusdrRequestInjected } from './injector'
import { SusdrRiskReportSchemaJoi, SusdrStatusQueryParams, SusdrStatusQueryParamsJoi } from './schema'
import { evaluateSusdrRisk, readSusdrMarketRiskInput, SusdrRiskInput, SusdrRiskReport } from '../../susdr'

function mergeRiskInputs(marketRiskInput: SusdrRiskInput, queryRiskInput: SusdrStatusQueryParams): SusdrRiskInput {
  return {
    ...marketRiskInput,
    ...queryRiskInput,
  }
}

function shouldReadMarketRiskInput(queryRiskInput: SusdrStatusQueryParams): boolean {
  return queryRiskInput.apxUsdPriceBps === undefined && queryRiskInput.marketPriceUnavailable !== true
}

export class SusdrStatusHandler extends APIGLambdaHandler<
  SusdrContainerInjected,
  SusdrRequestInjected,
  void,
  SusdrStatusQueryParams,
  SusdrRiskReport
> {
  public async handleRequest(
    params: HandleRequestParams<SusdrContainerInjected, SusdrRequestInjected, void, SusdrStatusQueryParams>
  ): Promise<Response<SusdrRiskReport>> {
    const queryRiskInput = params.requestQueryParams ?? {}
    const marketRiskInput = shouldReadMarketRiskInput(queryRiskInput) ? await readSusdrMarketRiskInput() : {}
    const riskReport = evaluateSusdrRisk(mergeRiskInputs(marketRiskInput, queryRiskInput))

    params.requestInjected.metric.putMetric(
      `SUSDR_RISK_LEVEL_${riskReport.level.toUpperCase()}`,
      1,
      MetricLoggerUnit.Count
    )

    return {
      statusCode: 200,
      body: riskReport,
    }
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return SusdrStatusQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return SusdrRiskReportSchemaJoi
  }
}
