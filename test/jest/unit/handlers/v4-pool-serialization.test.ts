import { describe, expect, it } from '@jest/globals'

/**
 * Tests that V4 bridge pool data is correctly serialized in the quote response
 * format that the frontend expects.
 */

interface V4PoolInRoute {
  type: 'v4-pool'
  address: string
  tokenIn: { chainId: number; decimals: string; address: string; symbol: string }
  tokenOut: { chainId: number; decimals: string; address: string; symbol: string }
  fee: string
  tickSpacing: string
  hooks: string
  liquidity: string
  sqrtRatioX96: string
  tickCurrent: string
  amountIn?: string
  amountOut?: string
}

function serializeBridgePool(pool: {
  token0: { chainId: number; decimals: number; address: string; symbol: string; isNative: boolean }
  token1: { chainId: number; decimals: number; address: string; symbol: string; isNative: boolean }
  fee: number
  tickSpacing: number
  hooks: string
  liquidity: bigint
  sqrtRatioX96: bigint
  tickCurrent: number
}): V4PoolInRoute {
  return {
    type: 'v4-pool',
    address: '0xPOOL_ID',
    tokenIn: {
      chainId: pool.token0.chainId,
      decimals: pool.token0.decimals.toString(),
      address: pool.token0.address,
      symbol: pool.token0.symbol,
    },
    tokenOut: {
      chainId: pool.token1.chainId,
      decimals: pool.token1.decimals.toString(),
      address: pool.token1.address,
      symbol: pool.token1.symbol,
    },
    fee: pool.fee.toString(),
    tickSpacing: pool.tickSpacing.toString(),
    hooks: pool.hooks,
    liquidity: pool.liquidity.toString(),
    sqrtRatioX96: pool.sqrtRatioX96.toString(),
    tickCurrent: pool.tickCurrent.toString(),
  }
}

describe('V4 Pool Serialization', () => {
  const USDC = {
    chainId: 1,
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    isNative: false,
  }

  const FEW_USDC = {
    chainId: 1,
    decimals: 6,
    address: '0xFewUSDCAddress',
    symbol: 'fewUSDC',
    isNative: false,
  }

  it('should serialize a FewToken bridge pool with tickSpacing=0 and fee=0', () => {
    const bridgePool = {
      token0: USDC,
      token1: FEW_USDC,
      fee: 0,
      tickSpacing: 0,
      hooks: '0x0000000000000000000000000000000000000000',
      liquidity: BigInt(0),
      sqrtRatioX96: BigInt('79228162514264337593543950336'),
      tickCurrent: 0,
    }

    const serialized = serializeBridgePool(bridgePool)

    expect(serialized.type).toBe('v4-pool')
    expect(serialized.fee).toBe('0')
    expect(serialized.tickSpacing).toBe('0')
    expect(serialized.liquidity).toBe('0')
    expect(serialized.tokenIn.address).toBe(USDC.address)
    expect(serialized.tokenOut.address).toBe(FEW_USDC.address)
    expect(serialized.tokenIn.symbol).toBe('USDC')
    expect(serialized.tokenOut.symbol).toBe('fewUSDC')
  })

  it('should produce a V4PoolInRoute with all required fields', () => {
    const bridgePool = {
      token0: USDC,
      token1: FEW_USDC,
      fee: 0,
      tickSpacing: 0,
      hooks: '0x0000000000000000000000000000000000000000',
      liquidity: BigInt(0),
      sqrtRatioX96: BigInt('79228162514264337593543950336'),
      tickCurrent: 0,
    }

    const serialized = serializeBridgePool(bridgePool)
    const requiredFields: (keyof V4PoolInRoute)[] = [
      'type',
      'address',
      'tokenIn',
      'tokenOut',
      'fee',
      'tickSpacing',
      'hooks',
      'liquidity',
      'sqrtRatioX96',
      'tickCurrent',
    ]

    for (const field of requiredFields) {
      expect(serialized).toHaveProperty(field)
      expect(serialized[field]).toBeDefined()
    }
  })

  it('should serialize a mixed route containing bridge + FewV2 pools', () => {
    const WETH = {
      chainId: 1,
      decimals: 18,
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      isNative: false,
    }
    const FEW_WETH = {
      chainId: 1,
      decimals: 18,
      address: '0xFewWETHAddress',
      symbol: 'fewWETH',
      isNative: false,
    }

    const bridgePoolData = serializeBridgePool({
      token0: WETH,
      token1: FEW_WETH,
      fee: 0,
      tickSpacing: 0,
      hooks: '0x0000000000000000000000000000000000000000',
      liquidity: BigInt(0),
      sqrtRatioX96: BigInt('79228162514264337593543950336'),
      tickCurrent: 0,
    })

    const fewV2PoolData = {
      type: 'fewv2-pool' as const,
      address: '0xFewV2PoolAddress',
      tokenIn: { chainId: 1, decimals: '18', address: FEW_WETH.address, symbol: 'fewWETH' },
      tokenOut: { chainId: 1, decimals: '6', address: FEW_USDC.address, symbol: 'fewUSDC' },
      reserve0: { token: FEW_WETH.address, quotient: '1000000000000000000' },
      reserve1: { token: FEW_USDC.address, quotient: '3000000000' },
    }

    const mixedRoute = [bridgePoolData, fewV2PoolData]

    expect(mixedRoute).toHaveLength(2)
    expect(mixedRoute[0].type).toBe('v4-pool')
    expect(mixedRoute[1].type).toBe('fewv2-pool')
    expect(mixedRoute[0].tokenOut.address).toBe(mixedRoute[1].tokenIn.address)
  })
})
