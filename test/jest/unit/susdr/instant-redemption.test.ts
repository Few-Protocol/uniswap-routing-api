import { describe, expect, it } from '@jest/globals'
import { simulateInstantRedemption } from '../../../../lib/susdr'

describe('simulateInstantRedemption', () => {
  it('fills instant redemption from available sources and queues the rest', () => {
    const result = simulateInstantRedemption({
      requestedAmountRaw: '1000000000000000000000',
      reservedForQueueRaw: '50000000000000000000',
      minSafetyBufferRaw: '100000000000000000000',
      sources: [
        {
          id: 'idle-usdr',
          kind: 'idle-usdr',
          label: 'Idle USDR',
          amountRaw: '100000000000000000000',
          decimals: 18,
        },
        {
          id: 'idle-usdc',
          kind: 'idle-usdc',
          label: 'Idle USDC',
          amountRaw: '200000000',
          decimals: 6,
        },
        {
          id: 'aave-usdc',
          kind: 'aave-usdc',
          label: 'Aave USDC maxWithdraw',
          amountRaw: '300000000',
          decimals: 6,
        },
        {
          id: 'wrapper-sor',
          kind: 'sor-wrapper',
          label: 'Wrapper sellable through SOR',
          amountRaw: '500000000000000000000',
          decimals: 18,
        },
      ],
    })

    expect(result.instantCapacityDecimal).toEqual('950')
    expect(result.instantFillDecimal).toEqual('950')
    expect(result.queueAmountDecimal).toEqual('50')
    expect(result.navBps).toEqual(10_000)
    expect(result.redeemableAmountDecimal).toEqual('1000')
    expect(result.navDiscountDecimal).toEqual('0')
    expect(result.steps.map((step) => step.amountDecimal)).toEqual(['100', '200', '300', '350'])
  })

  it('prices redemption by sUSDR NAV instead of assuming fixed 1:1', () => {
    const result = simulateInstantRedemption({
      requestedAmountRaw: '1000000000000000000000',
      navBps: 9_400,
      sources: [
        {
          id: 'idle-usdr',
          kind: 'idle-usdr',
          label: 'Idle USDR',
          amountRaw: '1000000000000000000000',
          decimals: 18,
        },
      ],
    })

    expect(result.pricingMode).toEqual('nav_pass_through')
    expect(result.oneToOneGuaranteed).toEqual(false)
    expect(result.wrapperLossPassThrough).toEqual(true)
    expect(result.redeemableAmountDecimal).toEqual('940')
    expect(result.navDiscountDecimal).toEqual('60')
    expect(result.instantFillDecimal).toEqual('940')
    expect(result.queueAmountDecimal).toEqual('0')
  })

  it('ignores disabled sources', () => {
    const result = simulateInstantRedemption({
      requestedAmountRaw: '100000000000000000000',
      sources: [
        {
          id: 'idle-usdr',
          kind: 'idle-usdr',
          label: 'Idle USDR',
          amountRaw: '100000000000000000000',
          decimals: 18,
          enabled: false,
        },
      ],
    })

    expect(result.instantCapacityDecimal).toEqual('0')
    expect(result.queueAmountDecimal).toEqual('100')
  })
})
