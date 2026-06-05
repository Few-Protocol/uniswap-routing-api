import { BigNumber } from '@ethersproject/bignumber'
import {
  SusdrReserveAsset,
  SusdrReservePolicy,
  SusdrRiskInput,
  SusdrRiskLevel,
  SusdrRiskReport,
  SusdrRiskSignal,
  SusdrRiskThresholds,
} from './types'

export const DEFAULT_SUSDR_RISK_THRESHOLDS: SusdrRiskThresholds = {
  minUsdrPriceBps: 9_950,
  maxUsdrPriceBps: 10_050,
  maxSupplyIncreaseBps24h: 500,
  maxSourceStaleSeconds: 600,
  minApxUsdPriceBps: 9_950,
  maxApyUsdNavDiscountBps: 100,
  maxApyUsdQueueDays: 35,
  apyUsdRecoveryStableDays: 14,
}

const RISK_LEVEL_RANK: Record<SusdrRiskLevel, number> = {
  ok: 0,
  watch: 1,
  pause_deposits: 2,
}

const RING_SUBSIDY_APY_BPS = 200
const SOURCE_APY_BPS_BY_ASSET_ID = {
  'aave-usdc': 400,
  sUSDat: 967,
  apyUSD: 1_032,
}

function maxLevel(current: SusdrRiskLevel, next: SusdrRiskLevel): SusdrRiskLevel {
  return RISK_LEVEL_RANK[next] > RISK_LEVEL_RANK[current] ? next : current
}

function addSignal(signals: SusdrRiskSignal[], signal: SusdrRiskSignal): SusdrRiskLevel {
  signals.push(signal)
  return signal.level
}

function calculateReserveYieldBps(assets: SusdrReserveAsset[]): number {
  return Math.round(
    assets.reduce((total, asset) => total + (asset.targetWeightBps * asset.sourceApyBps) / 10_000, 0)
  )
}

function isApyUsdRecoveryReady(input: SusdrRiskInput, thresholds: SusdrRiskThresholds): boolean {
  return (
    input.apxUsdPriceBps !== undefined &&
    input.apxUsdPriceBps >= thresholds.minApxUsdPriceBps &&
    input.apyUsdNavDiscountBps !== undefined &&
    input.apyUsdNavDiscountBps <= thresholds.maxApyUsdNavDiscountBps &&
    input.apyUsdQueueDays !== undefined &&
    input.apyUsdQueueDays <= thresholds.maxApyUsdQueueDays &&
    input.apyUsdRecoveryStableDays !== undefined &&
    input.apyUsdRecoveryStableDays >= thresholds.apyUsdRecoveryStableDays &&
    input.marketPriceUnavailable !== true
  )
}

function buildApyUsdAsset(input: SusdrRiskInput, thresholds: SusdrRiskThresholds): SusdrReserveAsset {
  const recoveryReady = isApyUsdRecoveryReady(input, thresholds)
  if (recoveryReady) {
    return {
      id: 'apyUSD',
      label: 'Apyx apyUSD',
      targetWeightBps: 1_000,
      maxWeightBps: 2_000,
      sourceApyBps: SOURCE_APY_BPS_BY_ASSET_ID.apyUSD,
      status: 'watch',
      reason: 'Recovery conditions passed; eligible for capped gray allocation',
      priceBps: input.apxUsdPriceBps,
      thresholdBps: thresholds.minApxUsdPriceBps,
      navDiscountBps: input.apyUsdNavDiscountBps,
      queueDays: input.apyUsdQueueDays,
    }
  }

  const reason =
    input.apxUsdPriceBps !== undefined && input.apxUsdPriceBps < thresholds.minApxUsdPriceBps
      ? 'apxUSD below recovery band; new allocation paused'
      : 'Waiting for recovery data before any new allocation'

  return {
    id: 'apyUSD',
    label: 'Apyx apyUSD',
    targetWeightBps: 0,
    maxWeightBps: 0,
    sourceApyBps: SOURCE_APY_BPS_BY_ASSET_ID.apyUSD,
    status: 'paused',
    reason,
    priceBps: input.apxUsdPriceBps,
    thresholdBps: thresholds.minApxUsdPriceBps,
    navDiscountBps: input.apyUsdNavDiscountBps,
    queueDays: input.apyUsdQueueDays,
  }
}

function buildReservePolicy(input: SusdrRiskInput, thresholds: SusdrRiskThresholds): SusdrReservePolicy {
  const apyUsd = buildApyUsdAsset(input, thresholds)
  const recoveryReady = apyUsd.status === 'watch' && apyUsd.targetWeightBps > 0
  const assets: SusdrReserveAsset[] = recoveryReady
    ? [
        {
          id: 'aave-usdc',
          label: 'Aave USDC',
          targetWeightBps: 5_000,
          maxWeightBps: 8_000,
          sourceApyBps: SOURCE_APY_BPS_BY_ASSET_ID['aave-usdc'],
          status: 'active',
          reason: 'Primary cash buffer and instant-redemption source',
        },
        {
          id: 'sUSDat',
          label: 'Saturn sUSDat',
          targetWeightBps: 4_000,
          maxWeightBps: 4_000,
          sourceApyBps: SOURCE_APY_BPS_BY_ASSET_ID.sUSDat,
          status: 'active',
          reason: 'First STRC wrapper allocation after Aave-only test',
        },
        apyUsd,
      ]
    : [
        {
          id: 'aave-usdc',
          label: 'Aave USDC',
          targetWeightBps: 7_000,
          maxWeightBps: 10_000,
          sourceApyBps: SOURCE_APY_BPS_BY_ASSET_ID['aave-usdc'],
          status: 'active',
          reason: 'Primary cash buffer and instant-redemption source',
        },
        {
          id: 'sUSDat',
          label: 'Saturn sUSDat',
          targetWeightBps: 3_000,
          maxWeightBps: 4_000,
          sourceApyBps: SOURCE_APY_BPS_BY_ASSET_ID.sUSDat,
          status: 'active',
          reason: 'First STRC wrapper allocation after Aave-only test',
        },
        apyUsd,
      ]
  const reserveYieldBps = calculateReserveYieldBps(assets)

  return {
    mode: recoveryReady ? 'apyusd_gray_candidate' : 'safe_launch',
    summary: recoveryReady
      ? 'Apyx can be considered for a capped gray allocation; default launch remains Aave + sUSDat.'
      : 'Safe launch: Aave cash buffer plus capped sUSDat; apyUSD new allocation is paused.',
    targetApyBps: reserveYieldBps + RING_SUBSIDY_APY_BPS,
    reserveYieldBps,
    subsidyApyBps: RING_SUBSIDY_APY_BPS,
    tvlCapUsd: 10_000_000,
    assets,
    recoveryRules: {
      minApxUsdPriceBps: thresholds.minApxUsdPriceBps,
      maxApyUsdNavDiscountBps: thresholds.maxApyUsdNavDiscountBps,
      stableDaysRequired: thresholds.apyUsdRecoveryStableDays,
    },
  }
}

export function evaluateSusdrRisk(
  input: SusdrRiskInput,
  thresholds: SusdrRiskThresholds = DEFAULT_SUSDR_RISK_THRESHOLDS
): SusdrRiskReport {
  const signals: SusdrRiskSignal[] = []
  let level: SusdrRiskLevel = 'ok'

  if (input.usdrPriceBps !== undefined) {
    if (input.usdrPriceBps < thresholds.minUsdrPriceBps || input.usdrPriceBps > thresholds.maxUsdrPriceBps) {
      level = maxLevel(
        level,
        addSignal(signals, {
          id: 'USDR_PRICE_OUT_OF_RANGE',
          level: 'pause_deposits',
          message: 'USDR price moved outside the launch band',
          value: input.usdrPriceBps.toString(),
          threshold: `${thresholds.minUsdrPriceBps}-${thresholds.maxUsdrPriceBps}`,
        })
      )
    }
  }

  if (
    input.usdrSupplyIncreaseBps24h !== undefined &&
    input.usdrSupplyIncreaseBps24h > thresholds.maxSupplyIncreaseBps24h
  ) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'USDR_SUPPLY_SPIKE',
        level: 'watch',
        message: 'USDR supply increased faster than the launch threshold',
        value: input.usdrSupplyIncreaseBps24h.toString(),
        threshold: thresholds.maxSupplyIncreaseBps24h.toString(),
      })
    )
  }

  if (input.oldestSourceAgeSeconds !== undefined && input.oldestSourceAgeSeconds > thresholds.maxSourceStaleSeconds) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'SOURCE_DATA_STALE',
        level: 'watch',
        message: 'One or more read-only data sources are stale',
        value: input.oldestSourceAgeSeconds.toString(),
        threshold: thresholds.maxSourceStaleSeconds.toString(),
      })
    )
  }

  if (input.marketPriceUnavailable === true) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'MARKET_PRICE_UNAVAILABLE',
        level: 'watch',
        message: 'External market price feed is unavailable; keep wrapper allocation conservative',
      })
    )
  }

  if (
    input.apyUsdPriceDataAgeSeconds !== undefined &&
    input.apyUsdPriceDataAgeSeconds > thresholds.maxSourceStaleSeconds
  ) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'APYUSD_PRICE_STALE',
        level: 'watch',
        message: 'Apyx market price is stale',
        value: input.apyUsdPriceDataAgeSeconds.toString(),
        threshold: thresholds.maxSourceStaleSeconds.toString(),
      })
    )
  }

  if (input.apxUsdPriceBps !== undefined && input.apxUsdPriceBps < thresholds.minApxUsdPriceBps) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'APXUSD_DEPEG',
        level: 'pause_deposits',
        message: 'apxUSD is below the recovery band; pause new apyUSD allocation',
        value: input.apxUsdPriceBps.toString(),
        threshold: thresholds.minApxUsdPriceBps.toString(),
      })
    )
  }

  if (input.apyUsdNavDiscountBps !== undefined && input.apyUsdNavDiscountBps > thresholds.maxApyUsdNavDiscountBps) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'APYUSD_NAV_DISCOUNT',
        level: 'pause_deposits',
        message: 'apyUSD secondary price is too far below conservative NAV',
        value: input.apyUsdNavDiscountBps.toString(),
        threshold: thresholds.maxApyUsdNavDiscountBps.toString(),
      })
    )
  }

  if (input.apyUsdQueueDays !== undefined && input.apyUsdQueueDays > thresholds.maxApyUsdQueueDays) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'APYUSD_QUEUE_DELAY',
        level: 'watch',
        message: 'Apyx redemption queue is longer than the launch threshold',
        value: input.apyUsdQueueDays.toString(),
        threshold: thresholds.maxApyUsdQueueDays.toString(),
      })
    )
  }

  if (input.requestedAmountRaw !== undefined && input.instantCapacityRaw !== undefined) {
    const requestedAmount = BigNumber.from(input.requestedAmountRaw)
    const instantCapacity = BigNumber.from(input.instantCapacityRaw)
    if (requestedAmount.gt(instantCapacity)) {
      level = maxLevel(
        level,
        addSignal(signals, {
          id: 'INSUFFICIENT_INSTANT_LIQUIDITY',
          level: 'watch',
          message: 'Requested amount exceeds current instant liquidity',
          value: requestedAmount.toString(),
          threshold: instantCapacity.toString(),
        })
      )
    }
  }

  if (input.coreRoleChangeDetected === true) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'USDR_CORE_ROLE_CHANGE',
        level: 'pause_deposits',
        message: 'USDR Core role change detected',
      })
    )
  }

  if (input.pausedExternalAssetCount !== undefined && input.pausedExternalAssetCount > 0) {
    level = maxLevel(
      level,
      addSignal(signals, {
        id: 'EXTERNAL_ASSET_PAUSED',
        level: 'pause_deposits',
        message: 'At least one external reserve asset is paused',
        value: input.pausedExternalAssetCount.toString(),
      })
    )
  }

  return {
    level,
    signals,
    thresholds,
    reservePolicy: buildReservePolicy(input, thresholds),
  }
}
