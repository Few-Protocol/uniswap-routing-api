import Joi from '@hapi/joi'
import { MetricLoggerUnit } from '@ring-protocol/smart-order-router'
import { APIGLambdaHandler, HandleRequestParams, Response } from '../handler'
import { SusdrContainerInjected, SusdrRequestInjected } from './injector'
import { SusdrRiskReportSchemaJoi, SusdrStatusQueryParams, SusdrStatusQueryParamsJoi } from './schema'
import {
  evaluateSusdrRisk,
  readSusdrMarketRiskInput,
  readSusdrYieldRiskInput,
  SusdrRiskInput,
  SusdrRiskReport,
} from '../../susdr'

function queryToRiskInput(queryRiskInput: SusdrStatusQueryParams): SusdrRiskInput {
  const riskInput = { ...queryRiskInput } as SusdrRiskInput & { chainId?: number }
  delete riskInput.chainId
  return riskInput
}

function mergeRiskInputs(
  marketRiskInput: SusdrRiskInput,
  yieldRiskInput: SusdrRiskInput,
  queryRiskInput: SusdrStatusQueryParams
): SusdrRiskInput {
  return {
    ...marketRiskInput,
    ...yieldRiskInput,
    ...queryToRiskInput(queryRiskInput),
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
    const chainId = queryRiskInput.chainId ?? 1
    const [marketRiskInput, yieldRiskInput] = await Promise.all([
      shouldReadMarketRiskInput(queryRiskInput) ? readSusdrMarketRiskInput() : Promise.resolve({}),
      readSusdrYieldRiskInput(chainId),
    ])
    const riskReport = evaluateSusdrRisk(mergeRiskInputs(marketRiskInput, yieldRiskInput, queryRiskInput))

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
