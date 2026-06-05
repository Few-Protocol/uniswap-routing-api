import { describe, expect, it, jest } from '@jest/globals'
import type * as Susdr from '../../../../lib/susdr'

const mockBalanceOf = jest.fn<(owner: string) => Promise<string>>().mockResolvedValue('1000')
const mockATokenBalanceOf = jest.fn<(owner: string) => Promise<string>>().mockResolvedValue('2000')
const mockUnderlyingBalanceOf = jest.fn<(owner: string) => Promise<string>>().mockResolvedValue('1500')
const mockContract = jest
  .fn<(address: string) => { balanceOf: typeof mockBalanceOf }>()
  .mockImplementation((address) => {
    if (address === '0x0000000000000000000000000000000000000001') {
      return {
        balanceOf: mockBalanceOf,
      }
    }

    if (address === '0x0000000000000000000000000000000000000003') {
      return {
        balanceOf: mockATokenBalanceOf,
      }
    }

    return {
      balanceOf: mockUnderlyingBalanceOf,
    }
  })

jest.mock('@ethersproject/contracts', () => ({
  Contract: mockContract,
}))

const { readLiquiditySources } = require('../../../../lib/susdr') as typeof Susdr

describe('readLiquiditySources', () => {
  it('reads ERC20 balances and Aave maxWithdraw values', async () => {
    const sources = await readLiquiditySources({} as any, [
      {
        id: 'idle-usdr',
        kind: 'idle-usdr',
        label: 'Vault USDR',
        readType: 'erc20-balance',
        decimals: 18,
        tokenAddress: '0x0000000000000000000000000000000000000001',
        holderAddress: '0x0000000000000000000000000000000000000002',
      },
      {
        id: 'aave-usdc',
        kind: 'aave-usdc',
        label: 'Aave USDC',
        readType: 'aave-max-withdraw',
        decimals: 6,
        tokenAddress: '0x0000000000000000000000000000000000000005',
        aTokenAddress: '0x0000000000000000000000000000000000000003',
        ownerAddress: '0x0000000000000000000000000000000000000004',
      },
    ])

    expect(sources.map((source) => source.amountRaw)).toEqual(['1000', '1500'])
    expect(mockBalanceOf).toHaveBeenCalledWith('0x0000000000000000000000000000000000000002')
    expect(mockATokenBalanceOf).toHaveBeenCalledWith('0x0000000000000000000000000000000000000004')
    expect(mockUnderlyingBalanceOf).toHaveBeenCalledWith('0x0000000000000000000000000000000000000003')
  })
})
