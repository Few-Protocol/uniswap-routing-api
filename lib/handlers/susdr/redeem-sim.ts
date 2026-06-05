import Joi from '@hapi/joi'
import { MetricLoggerUnit } from '@ring-protocol/smart-order-router'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { SusdrContainerInjected, SusdrRequestInjected } from './injector'
import { SusdrRedeemSimQueryParams, SusdrRedeemSimQueryParamsJoi, SusdrRedeemSimResponseSchemaJoi } from './schema'
import {
  buildSusdrReadOnlyProvider,
  readLiquiditySources,
  simulateInstantRedemption,
  SusdrLiquiditySource,
  SusdrRedemptionSimulation,
} from '../../susdr'

export class SusdrRedeemSimHandler extends APIGLambdaHandler<
  SusdrContainerInjected,
  SusdrRequestInjected,
  void,
  SusdrRedeemSimQueryParams,
  SusdrRedemptionSimulation
> {
  public async handleRequest(
    params: HandleRequestParams<SusdrContainerInjected, SusdrRequestInjected, void, SusdrRedeemSimQueryParams>
  ): Promise<Response<SusdrRedemptionSimulation> | ErrorResponse> {
    if (!params.requestQueryParams) {
      return {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        detail: 'amountRaw is required',
      }
    }

    const {
      amountRaw,
      chainId = 1,
      useConfiguredSources = false,
      idleUsdrRaw = '0',
      idleUsdcRaw = '0',
      aaveUsdcRaw = '0',
      wrapperSellableRaw = '0',
      navBps = 10_000,
      reservedForQueueRaw = '0',
      minSafetyBufferRaw = '0',
    } = params.requestQueryParams

    let sources: SusdrLiquiditySource[]
    if (useConfiguredSources) {
      if (params.containerInjected.liquiditySourceConfigs.length === 0) {
        sources = []
      } else {
        try {
          const provider = buildSusdrReadOnlyProvider(chainId)
          sources = await readLiquiditySources(provider, params.containerInjected.liquiditySourceConfigs)
          params.requestInjected.metric.putMetric(
            'SUSDR_REDEEM_SIM_LIVE_SOURCE_READ_SUCCESS',
            1,
            MetricLoggerUnit.Count
          )
        } catch (error) {
          params.requestInjected.log.error({ error }, 'Failed to read configured sUSDR liquidity sources')
          params.requestInjected.metric.putMetric(
            'SUSDR_REDEEM_SIM_LIVE_SOURCE_READ_FAILURE',
            1,
            MetricLoggerUnit.Count
          )
          return {
            statusCode: 500,
            errorCode: 'SUSDR_LIQUIDITY_READ_FAILED',
            detail: 'Failed to read configured sUSDR liquidity sources',
          }
        }
      }
    } else {
      sources = [
        {
          id: 'idle-usdr',
          kind: 'idle-usdr',
          label: 'Idle USDR',
          amountRaw: idleUsdrRaw,
          decimals: 18,
        },
        {
          id: 'idle-usdc',
          kind: 'idle-usdc',
          label: 'Idle USDC',
          amountRaw: idleUsdcRaw,
          decimals: 6,
        },
        {
          id: 'aave-usdc',
          kind: 'aave-usdc',
          label: 'Aave USDC maxWithdraw',
          amountRaw: aaveUsdcRaw,
          decimals: 6,
        },
        {
          id: 'wrapper-sor',
          kind: 'sor-wrapper',
          label: 'Wrapper sellable through SOR',
          amountRaw: wrapperSellableRaw,
          decimals: 18,
        },
      ]
    }

    const simulation = simulateInstantRedemption({
      requestedAmountRaw: amountRaw,
      navBps,
      reservedForQueueRaw,
      minSafetyBufferRaw,
      sources,
    })

    params.requestInjected.metric.putMetric('SUSDR_REDEEM_SIM_REQUEST', 1, MetricLoggerUnit.Count)

    return {
      statusCode: 200,
      body: simulation,
    }
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return SusdrRedeemSimQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return SusdrRedeemSimResponseSchemaJoi
  }
}
