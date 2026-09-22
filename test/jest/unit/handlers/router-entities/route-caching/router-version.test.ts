import { Protocol } from '@ring-protocol/router-sdk'
import { CurrencyAmount, Token, TradeType } from '@ring-protocol/sdk-core'
import { UniversalRouterVersion } from '@ring-protocol/universal-router-sdk'
import { DynamoRouteCachingProvider, PairTradeTypeChainId } from '../../../../../../lib/handlers/router-entities/route-caching'

// Capture the outbound Lambda payload; no AWS or RPC traffic is allowed.
describe('cache refresh Router version', () => {
  it.each([
    [UniversalRouterVersion.V2_1_1, [Protocol.V2, Protocol.V3], UniversalRouterVersion.V2_1_1],
    [UniversalRouterVersion.V2_1_1, [Protocol.V4], UniversalRouterVersion.V2_1_1],
    [UniversalRouterVersion.V2_0, [Protocol.V3], UniversalRouterVersion.V2_0],
    [UniversalRouterVersion.V1_2, [Protocol.V3], UniversalRouterVersion.V1_2],
    [undefined, [Protocol.V3], UniversalRouterVersion.V1_2],
    [undefined, [Protocol.V4], UniversalRouterVersion.V2_0],
  ])('keeps selected %s for %s', (version, protocols, expected) => {
    const invoke = jest.fn((_params: { Payload: string }) => ({ promise: () => Promise.resolve({}) }))
    const provider = Object.create(DynamoRouteCachingProvider.prototype)
    provider.lambdaClient = { invoke }
    provider.cachingQuoteLambdaName = 'test-only'
    const token = new Token(1, '0x1111111111111111111111111111111111111111', 18)
    provider.sendAsyncCachingRequest(new PairTradeTypeChainId({
      currencyIn: token.address,
      currencyOut: '0x2222222222222222222222222222222222222222',
      chainId: 1, tradeType: TradeType.EXACT_INPUT,
    }), protocols, CurrencyAmount.fromRawAmount(token, '100'), [],
    version ? { universalRouterVersion: version } : undefined)
    expect(invoke).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(invoke.mock.calls[0][0].Payload)
    expect(payload.headers['x-universal-router-version']).toBe(expected)
  })
})
