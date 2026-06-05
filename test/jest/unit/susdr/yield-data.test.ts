import { BigNumber } from '@ethersproject/bignumber'
import { describe, expect, it } from '@jest/globals'
import {
  aaveLiquidityRateRayToBps,
  calculateSaturnSusdatApyBps,
  scaledRatioToBps,
} from '../../../../lib/susdr'

describe('sUSDR yield data helpers', () => {
  it('converts Aave ray liquidity rates to basis points', () => {
    expect(aaveLiquidityRateRayToBps(BigNumber.from('42500000000000000000000000'))).toEqual(425)
  })

  it('converts Apyx scaled APY values to basis points', () => {
    expect(scaledRatioToBps(BigNumber.from('111583674087475344'), BigNumber.from('1000000000000000000'))).toEqual(1116)
  })

  it('matches the Saturn sUSDat on-chain APY formula used by the app', () => {
    expect(
      calculateSaturnSusdatApyBps({
        strcPrice: 95.415,
        totalAssetsRaw: BigNumber.from('97271633344298'),
        usdatBalanceRaw: BigNumber.from('8080787694057'),
        vestingAmountRaw: BigNumber.from('900000000'),
        vestingPeriodSeconds: 259200,
      })
    ).toEqual(1515)
  })
})
