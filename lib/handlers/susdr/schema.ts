import Joi from '@hapi/joi'

const rawAmount = Joi.string()
  .pattern(/^[0-9]+$/)
  .max(77)

export type SusdrRedeemSimQueryParams = {
  amountRaw: string
  chainId?: number
  useConfiguredSources?: boolean
  idleUsdrRaw?: string
  idleUsdcRaw?: string
  aaveUsdcRaw?: string
  wrapperSellableRaw?: string
  navBps?: number
  reservedForQueueRaw?: string
  minSafetyBufferRaw?: string
}

export type SusdrStatusQueryParams = {
  requestedAmountRaw?: string
  instantCapacityRaw?: string
  usdrPriceBps?: number
  usdrSupplyIncreaseBps24h?: number
  oldestSourceAgeSeconds?: number
  apxUsdPriceBps?: number
  apyUsdNavDiscountBps?: number
  apyUsdQueueDays?: number
  apyUsdPriceDataAgeSeconds?: number
  apyUsdRecoveryStableDays?: number
  marketPriceUnavailable?: boolean
  coreRoleChangeDetected?: boolean
  pausedExternalAssetCount?: number
}

export type SusdrV2PoolsQueryParams = {
  chainId: number
  poolAddress?: string
  label?: string
  capacityMode?: 'team-lp' | 'full-reserve'
  teamAddresses?: string
  usableTeamLpBps?: number
  maxSlippageBps?: number
}

export type SusdrLiquidityQueryParams = {
  chainId: number
}

export type SusdrReadinessQueryParams = {
  chainId: number
}

export const SusdrRedeemSimQueryParamsJoi = Joi.object().keys({
  amountRaw: rawAmount.required(),
  chainId: Joi.number().integer().min(1).default(1),
  useConfiguredSources: Joi.boolean().default(false),
  idleUsdrRaw: rawAmount.default('0'),
  idleUsdcRaw: rawAmount.default('0'),
  aaveUsdcRaw: rawAmount.default('0'),
  wrapperSellableRaw: rawAmount.default('0'),
  navBps: Joi.number().integer().min(0).max(20_000).default(10_000),
  reservedForQueueRaw: rawAmount.default('0'),
  minSafetyBufferRaw: rawAmount.default('0'),
})

export const SusdrStatusQueryParamsJoi = Joi.object().keys({
  requestedAmountRaw: rawAmount.optional(),
  instantCapacityRaw: rawAmount.optional(),
  usdrPriceBps: Joi.number().integer().min(0).max(20_000).optional(),
  usdrSupplyIncreaseBps24h: Joi.number().integer().min(0).max(100_000).optional(),
  oldestSourceAgeSeconds: Joi.number().integer().min(0).optional(),
  apxUsdPriceBps: Joi.number().integer().min(0).max(20_000).optional(),
  apyUsdNavDiscountBps: Joi.number().integer().min(0).max(100_000).optional(),
  apyUsdQueueDays: Joi.number().integer().min(0).max(365).optional(),
  apyUsdPriceDataAgeSeconds: Joi.number().integer().min(0).optional(),
  apyUsdRecoveryStableDays: Joi.number().integer().min(0).max(365).optional(),
  marketPriceUnavailable: Joi.boolean().optional(),
  coreRoleChangeDetected: Joi.boolean().optional(),
  pausedExternalAssetCount: Joi.number().integer().min(0).optional(),
})

export const SusdrV2PoolsQueryParamsJoi = Joi.object().keys({
  chainId: Joi.number().integer().min(1).default(1),
  poolAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  label: Joi.string().optional(),
  capacityMode: Joi.string().valid('team-lp', 'full-reserve').optional(),
  teamAddresses: Joi.string().optional(),
  usableTeamLpBps: Joi.number().integer().min(0).max(10_000).optional(),
  maxSlippageBps: Joi.number().integer().min(0).max(10_000).optional(),
})

export const SusdrLiquidityQueryParamsJoi = Joi.object().keys({
  chainId: Joi.number().integer().min(1).default(1),
})

export const SusdrReadinessQueryParamsJoi = Joi.object().keys({
  chainId: Joi.number().integer().min(1).default(1),
})

export const SusdrRiskReportSchemaJoi = Joi.object()
  .keys({
    level: Joi.string().valid('ok', 'watch', 'pause_deposits').required(),
    signals: Joi.array()
      .items(
        Joi.object().keys({
          id: Joi.string().required(),
          level: Joi.string().valid('ok', 'watch', 'pause_deposits').required(),
          message: Joi.string().required(),
          value: Joi.string().optional(),
          threshold: Joi.string().optional(),
        })
      )
      .required(),
    thresholds: Joi.object()
      .keys({
        minUsdrPriceBps: Joi.number().required(),
        maxUsdrPriceBps: Joi.number().required(),
        maxSupplyIncreaseBps24h: Joi.number().required(),
        maxSourceStaleSeconds: Joi.number().required(),
        minApxUsdPriceBps: Joi.number().required(),
        maxApyUsdNavDiscountBps: Joi.number().required(),
        maxApyUsdQueueDays: Joi.number().required(),
        apyUsdRecoveryStableDays: Joi.number().required(),
      })
      .required(),
    reservePolicy: Joi.object()
      .keys({
        mode: Joi.string().valid('safe_launch', 'apyusd_gray_candidate').required(),
        summary: Joi.string().required(),
        targetApyBps: Joi.number().required(),
        reserveYieldBps: Joi.number().required(),
        subsidyApyBps: Joi.number().required(),
        tvlCapUsd: Joi.number().required(),
        assets: Joi.array()
          .items(
            Joi.object().keys({
              id: Joi.string().required(),
              label: Joi.string().required(),
              targetWeightBps: Joi.number().required(),
              maxWeightBps: Joi.number().required(),
              sourceApyBps: Joi.number().required(),
              status: Joi.string().valid('active', 'paused', 'watch').required(),
              reason: Joi.string().required(),
              priceBps: Joi.number().optional(),
              thresholdBps: Joi.number().optional(),
              navDiscountBps: Joi.number().optional(),
              queueDays: Joi.number().optional(),
            })
          )
          .required(),
        recoveryRules: Joi.object()
          .keys({
            minApxUsdPriceBps: Joi.number().required(),
            maxApyUsdNavDiscountBps: Joi.number().required(),
            stableDaysRequired: Joi.number().required(),
          })
          .required(),
      })
      .required(),
  })
  .required()

export const SusdrRedeemSimResponseSchemaJoi = Joi.object()
  .keys({
    pricingMode: Joi.string().valid('nav_pass_through').required(),
    oneToOneGuaranteed: Joi.boolean().valid(false).required(),
    wrapperLossPassThrough: Joi.boolean().valid(true).required(),
    navBps: Joi.number().required(),
    requestedAmountRaw: Joi.string().required(),
    requestedAmountDecimal: Joi.string().required(),
    redeemableAmountRaw: Joi.string().required(),
    redeemableAmountDecimal: Joi.string().required(),
    navDiscountRaw: Joi.string().required(),
    navDiscountDecimal: Joi.string().required(),
    navPremiumRaw: Joi.string().required(),
    navPremiumDecimal: Joi.string().required(),
    instantCapacityRaw: Joi.string().required(),
    instantCapacityDecimal: Joi.string().required(),
    instantFillRaw: Joi.string().required(),
    instantFillDecimal: Joi.string().required(),
    queueAmountRaw: Joi.string().required(),
    queueAmountDecimal: Joi.string().required(),
    reservedForQueueRaw: Joi.string().required(),
    minSafetyBufferRaw: Joi.string().required(),
    steps: Joi.array()
      .items(
        Joi.object().keys({
          sourceId: Joi.string().required(),
          kind: Joi.string().valid('idle-usdr', 'idle-usdc', 'aave-usdc', 'sor-wrapper').required(),
          label: Joi.string().required(),
          amountRaw: Joi.string().required(),
          amountDecimal: Joi.string().required(),
        })
      )
      .required(),
  })
  .required()

export const SusdrV2PoolsReportSchemaJoi = Joi.object()
  .keys({
    chainId: Joi.number().required(),
    generatedAtMs: Joi.number().required(),
    pools: Joi.array()
      .items(
        Joi.object().keys({
          poolAddress: Joi.string().required(),
          label: Joi.string().required(),
          capacityMode: Joi.string().valid('team-lp', 'full-reserve').required(),
          token0: Joi.string().required(),
          token1: Joi.string().required(),
          token0Symbol: Joi.string().required(),
          token1Symbol: Joi.string().required(),
          token0Decimals: Joi.number().required(),
          token1Decimals: Joi.number().required(),
          reserve0Raw: Joi.string().required(),
          reserve1Raw: Joi.string().required(),
          reserve0Decimal: Joi.string().required(),
          reserve1Decimal: Joi.string().required(),
          totalSupplyRaw: Joi.string().required(),
          teamLpRaw: Joi.string().required(),
          teamLpShareBps: Joi.number().required(),
          usableTeamLpBps: Joi.number().required(),
          maxSlippageBps: Joi.number().required(),
          usableInput0Raw: Joi.string().required(),
          usableInput1Raw: Joi.string().required(),
          usableReserve0Raw: Joi.string().required(),
          usableReserve1Raw: Joi.string().required(),
          usableInput0Decimal: Joi.string().required(),
          usableInput1Decimal: Joi.string().required(),
          usableReserve0Decimal: Joi.string().required(),
          usableReserve1Decimal: Joi.string().required(),
          blockNumber: Joi.number().required(),
        })
      )
      .required(),
  })
  .required()

export const SusdrLiquidityReportSchemaJoi = Joi.object()
  .keys({
    chainId: Joi.number().required(),
    generatedAtMs: Joi.number().required(),
    sources: Joi.array()
      .items(
        Joi.object().keys({
          id: Joi.string().required(),
          kind: Joi.string().valid('idle-usdr', 'idle-usdc', 'aave-usdc', 'sor-wrapper').required(),
          label: Joi.string().required(),
          amountRaw: Joi.string().required(),
          decimals: Joi.number().required(),
          enabled: Joi.boolean().optional(),
        })
      )
      .required(),
  })
  .required()

export const SusdrReadinessReportSchemaJoi = Joi.object()
  .keys({
    chainId: Joi.number().required(),
    generatedAtMs: Joi.number().required(),
    liveConfigReady: Joi.boolean().required(),
    strictReady: Joi.boolean().required(),
    counts: Joi.object()
      .keys({
        liquiditySourceConfigs: Joi.number().required(),
        v2PoolConfigs: Joi.number().required(),
      })
      .required(),
    missing: Joi.array().items(Joi.string()).required(),
    checks: Joi.array()
      .items(
        Joi.object().keys({
          id: Joi.string().required(),
          label: Joi.string().required(),
          status: Joi.string().valid('ready', 'missing').required(),
          detail: Joi.string().required(),
          requiredForStrict: Joi.boolean().required(),
        })
      )
      .required(),
  })
  .required()
