import { setRouteEdgeAmounts } from '../../../../lib/handlers/quote/quote'

describe('serialized route boundary amounts', () => {
  it('attaches totals to the retained pools without inventing intermediate amounts', () => {
    const pools = [{ type: 'v4-pool' }, { type: 'v3-pool' }] as Array<{ type: string; amountIn?: string; amountOut?: string }>
    setRouteEdgeAmounts(pools, '10000000000000', '24645')
    expect(pools[0].amountIn).toBe('10000000000000')
    expect(pools[1].amountOut).toBe('24645')
    expect(pools[0].amountOut).toBeUndefined()
    expect(pools[1].amountIn).toBeUndefined()
  })
  it('preserves both amounts when one pool remains', () => {
    const pools: Array<{ amountIn?: string; amountOut?: string }> = [{}]
    setRouteEdgeAmounts(pools, '20000', '8071555395879')
    expect(pools).toEqual([{ amountIn: '20000', amountOut: '8071555395879' }])
  })
  it('does not invent a route when every pool was removed', () => {
    const pools: Array<{ amountIn?: string; amountOut?: string }> = []
    setRouteEdgeAmounts(pools, '1', '2')
    expect(pools).toEqual([])
  })
})
