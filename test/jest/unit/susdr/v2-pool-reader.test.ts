import { describe, expect, it, jest } from '@jest/globals'
import type * as Susdr from '../../../../lib/susdr'

const mockToken0 = jest.fn<() => Promise<string>>().mockResolvedValue('0x0000000000000000000000000000000000000001')
const mockToken1 = jest.fn<() => Promise<string>>().mockResolvedValue('0x0000000000000000000000000000000000000002')
const mockGetReserves = jest.fn<() => Promise<[string, string, number]>>().mockResolvedValue(['1000', '2000', 1])
const mockTotalSupply = jest.fn<() => Promise<string>>().mockResolvedValue('100')
const mockBalanceOf = jest.fn<(address: string) => Promise<string>>().mockResolvedValue('30')
const mockSymbol = jest.fn<() => Promise<string>>().mockResolvedValue('fwTEST')
const mockDecimals = jest.fn<() => Promise<number>>().mockResolvedValue(0)

jest.mock('@ethersproject/contracts', () => ({
  Contract: jest.fn().mockImplementation(() => ({
    token0: mockToken0,
    token1: mockToken1,
    getReserves: mockGetReserves,
    totalSupply: mockTotalSupply,
    balanceOf: mockBalanceOf,
    symbol: mockSymbol,
    decimals: mockDecimals,
  })),
}))

const { readV2PoolSnapshot } = require('../../../../lib/susdr') as typeof Susdr

describe('readV2PoolSnapshot', () => {
  it('computes team-owned usable reserves from V2 LP balances', async () => {
    const provider = {
      getBlockNumber: jest.fn<() => Promise<number>>().mockResolvedValue(123),
    }

    const snapshot = await readV2PoolSnapshot(provider as any, {
      poolAddress: '0x0000000000000000000000000000000000000003',
      label: 'USDR/USDC',
      capacityMode: 'team-lp',
      teamAddresses: ['0x0000000000000000000000000000000000000004'],
      usableTeamLpBps: 2_000,
    })

    expect(snapshot.capacityMode).toEqual('team-lp')
    expect(snapshot.teamLpShareBps).toEqual(3_000)
    expect(snapshot.usableTeamLpBps).toEqual(2_000)
    expect(snapshot.maxSlippageBps).toEqual(0)
    expect(snapshot.usableInput0Raw).toEqual('200')
    expect(snapshot.usableInput1Raw).toEqual('400')
    expect(snapshot.usableReserve0Raw).toEqual('200')
    expect(snapshot.usableReserve1Raw).toEqual('400')
    expect(snapshot.token0Symbol).toEqual('fwTEST')
    expect(snapshot.token1Symbol).toEqual('fwTEST')
    expect(snapshot.reserve0Decimal).toEqual('1000')
    expect(snapshot.usableInput0Decimal).toEqual('200')
    expect(snapshot.blockNumber).toEqual(123)
  })

  it('computes full-reserve usable output from max slippage', async () => {
    const provider = {
      getBlockNumber: jest.fn<() => Promise<number>>().mockResolvedValue(123),
    }
    mockBalanceOf.mockClear()
    mockGetReserves.mockResolvedValueOnce(['1000000', '2000000', 1])

    const snapshot = await readV2PoolSnapshot(provider as any, {
      poolAddress: '0x0000000000000000000000000000000000000003',
      label: 'fwWETH/fwUSDC',
      capacityMode: 'full-reserve',
      maxSlippageBps: 50,
    })

    expect(mockBalanceOf).not.toHaveBeenCalled()
    expect(snapshot.capacityMode).toEqual('full-reserve')
    expect(snapshot.teamLpShareBps).toEqual(10_000)
    expect(snapshot.usableTeamLpBps).toEqual(10_000)
    expect(snapshot.maxSlippageBps).toEqual(50)
    expect(snapshot.usableInput0Raw).toEqual('2016')
    expect(snapshot.usableInput1Raw).toEqual('4032')
    expect(snapshot.usableReserve0Raw).toEqual('2005')
    expect(snapshot.usableReserve1Raw).toEqual('4011')
    expect(snapshot.blockNumber).toEqual(123)
  })
})
