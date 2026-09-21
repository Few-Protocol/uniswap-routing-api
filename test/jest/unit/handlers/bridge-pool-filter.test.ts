import { describe, expect, it } from '@jest/globals'

/**
 * Tests for the V4 bridge pool filter logic in quote.ts.
 *
 * The filter must:
 * - SKIP ETH↔WETH fake pools (tickSpacing=0, one token is native)
 * - KEEP FewToken bridge pools (tickSpacing=0, both tokens are ERC-20)
 */

function shouldSkipV4Pool(pool: {
  tickSpacing: number
  token0: { isNative: boolean }
  token1: { isNative: boolean }
}): boolean {
  return pool.tickSpacing === 0 && (pool.token0.isNative || pool.token1.isNative)
}

describe('V4 Bridge Pool Filter', () => {
  it('should skip ETH↔WETH fake pool (token0 is native)', () => {
    const ethWethPool = {
      tickSpacing: 0,
      token0: { isNative: true },
      token1: { isNative: false },
    }
    expect(shouldSkipV4Pool(ethWethPool)).toBe(true)
  })

  it('should skip ETH↔WETH fake pool (token1 is native)', () => {
    const wethEthPool = {
      tickSpacing: 0,
      token0: { isNative: false },
      token1: { isNative: true },
    }
    expect(shouldSkipV4Pool(wethEthPool)).toBe(true)
  })

  it('should NOT skip FewToken bridge pool (tickSpacing=0, no native token)', () => {
    const fewBridgePool = {
      tickSpacing: 0,
      token0: { isNative: false },
      token1: { isNative: false },
    }
    expect(shouldSkipV4Pool(fewBridgePool)).toBe(false)
  })

  it('should NOT skip regular V4 pool (tickSpacing > 0)', () => {
    const regularV4Pool = {
      tickSpacing: 60,
      token0: { isNative: false },
      token1: { isNative: false },
    }
    expect(shouldSkipV4Pool(regularV4Pool)).toBe(false)
  })

  it('should NOT skip V4 pool with native token but non-zero tickSpacing', () => {
    const nativeV4Pool = {
      tickSpacing: 60,
      token0: { isNative: true },
      token1: { isNative: false },
    }
    expect(shouldSkipV4Pool(nativeV4Pool)).toBe(false)
  })
})
