import { describe, expect, it } from '@jest/globals'
import { evaluateSusdrRisk } from '../../../../lib/susdr'

describe('evaluateSusdrRisk', () => {
  it('returns ok when all provided signals are inside the launch band', () => {
    const result = evaluateSusdrRisk({
      usdrPriceBps: 10_000,
      usdrSupplyIncreaseBps24h: 100,
      oldestSourceAgeSeconds: 60,
      requestedAmountRaw: '100',
      instantCapacityRaw: '100',
    })

    expect(result.level).toEqual('ok')
    expect(result.signals).toEqual([])
  })

  it('pauses deposits when USDR price moves outside the band', () => {
    const result = evaluateSusdrRisk({ usdrPriceBps: 9_900 })

    expect(result.level).toEqual('pause_deposits')
    expect(result.signals[0].id).toEqual('USDR_PRICE_OUT_OF_RANGE')
  })

  it('pauses new wrapper allocation when apxUSD depegs', () => {
    const result = evaluateSusdrRisk({ apxUsdPriceBps: 9_400 })

    expect(result.level).toEqual('pause_deposits')
    expect(result.signals[0].id).toEqual('APXUSD_DEPEG')
    expect(result.reservePolicy.mode).toEqual('safe_launch')
    expect(result.reservePolicy).toMatchObject({
      reserveYieldBps: 570,
      subsidyApyBps: 200,
      targetApyBps: 770,
    })
    expect(result.reservePolicy.assets.find((asset) => asset.id === 'apyUSD')).toMatchObject({
      sourceApyBps: 1032,
      status: 'paused',
      targetWeightBps: 0,
    })
    expect(result.reservePolicy.assets.find((asset) => asset.id === 'sUSDat')).toMatchObject({
      sourceApyBps: 967,
      targetWeightBps: 3_000,
    })
  })

  it('only allows apyUSD gray allocation after recovery conditions pass', () => {
    const result = evaluateSusdrRisk({
      apxUsdPriceBps: 10_000,
      apyUsdNavDiscountBps: 50,
      apyUsdQueueDays: 30,
      apyUsdRecoveryStableDays: 14,
    })

    expect(result.level).toEqual('ok')
    expect(result.reservePolicy.mode).toEqual('apyusd_gray_candidate')
    expect(result.reservePolicy).toMatchObject({
      reserveYieldBps: 690,
      subsidyApyBps: 200,
      targetApyBps: 890,
    })
    expect(result.reservePolicy.assets.find((asset) => asset.id === 'apyUSD')).toMatchObject({
      sourceApyBps: 1032,
      status: 'watch',
      targetWeightBps: 1_000,
      maxWeightBps: 2_000,
    })
  })

  it('warns when requested amount exceeds instant liquidity', () => {
    const result = evaluateSusdrRisk({
      requestedAmountRaw: '101',
      instantCapacityRaw: '100',
    })

    expect(result.level).toEqual('watch')
    expect(result.signals[0].id).toEqual('INSUFFICIENT_INSTANT_LIQUIDITY')
  })

  it('uses live source APY quotes when they are provided', () => {
    const result = evaluateSusdrRisk({
      sourceApyByAssetId: {
        'aave-usdc': {
          sourceApyBps: 420,
          sourceApyKind: 'live',
          sourceApySource: 'aave-v3-usdc-current-liquidity-rate',
          sourceApyUpdatedAtMs: 1_780_000_000_000,
        },
        sUSDat: {
          sourceApyBps: 1515,
          sourceApyKind: 'live',
          sourceApySource: 'saturn-susdat-onchain',
          sourceApyUpdatedAtMs: 1_780_000_000_000,
        },
        apyUSD: {
          sourceApyBps: 1116,
          sourceApyKind: 'live',
          sourceApySource: 'apyx-rate-view',
          sourceApyUpdatedAtMs: 1_780_000_000_000,
        },
      },
    })

    expect(result.reservePolicy).toMatchObject({
      reserveYieldBps: 749,
      subsidyApyBps: 200,
      targetApyBps: 949,
    })
    expect(result.reservePolicy.assets.find((asset) => asset.id === 'sUSDat')).toMatchObject({
      sourceApyBps: 1515,
      sourceApyKind: 'live',
      sourceApySource: 'saturn-susdat-onchain',
    })
  })

  it('warns when source APY falls back to static values', () => {
    const result = evaluateSusdrRisk({
      sourceApyFallbackAssetIds: ['apyUSD'],
    })

    expect(result.level).toEqual('watch')
    expect(result.signals[0]).toMatchObject({
      id: 'SOURCE_APY_FALLBACK',
      value: 'apyUSD',
    })
  })

  it('keeps the highest risk level when multiple signals fire', () => {
    const result = evaluateSusdrRisk({
      requestedAmountRaw: '101',
      instantCapacityRaw: '100',
      coreRoleChangeDetected: true,
    })

    expect(result.level).toEqual('pause_deposits')
    expect(result.signals.map((signal) => signal.id)).toEqual([
      'INSUFFICIENT_INSTANT_LIQUIDITY',
      'USDR_CORE_ROLE_CHANGE',
    ])
  })
})
