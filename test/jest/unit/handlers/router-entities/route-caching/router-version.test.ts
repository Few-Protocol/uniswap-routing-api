import { Protocol } from '@ring-protocol/router-sdk'
import { ChainId, CurrencyAmount, Token, TradeType } from '@ring-protocol/sdk-core'
import { UniversalRouterVersion } from '@ring-protocol/universal-router-sdk'
import { DynamoRouteCachingProvider, PairTradeTypeChainId } from '../../../../../../lib/handlers/router-entities/route-caching'

// Capture the outbound Lambda payload; no AWS or RPC traffic is allowed.
describe('cache refresh Router version', () => {
  const legacyChains = [ChainId.MAINNET, ChainId.BNB, ChainId.BASE, ChainId.ARBITRUM_ONE,
    ChainId.HYPER_MAINNET, ChainId.ROBINHOOD, ChainId.INK]
  const cases = legacyChains.flatMap(chainId => [undefined, UniversalRouterVersion.V1_2, UniversalRouterVersion.V2_0]
    .flatMap(version => [
      { chainId, version, protocols: [Protocol.V3], expected: UniversalRouterVersion.V1_2 },
      { chainId, version, protocols: [Protocol.V4], expected: UniversalRouterVersion.V2_0 },
    ]))
  cases.push(...[undefined, UniversalRouterVersion.V2_1_1].flatMap(version => [
    { chainId: ChainId.ARC, version, protocols: [Protocol.V2, Protocol.V3], expected: UniversalRouterVersion.V2_1_1 },
    { chainId: ChainId.ARC, version, protocols: [Protocol.V4], expected: UniversalRouterVersion.V2_1_1 },
  ]))

  it.each(cases)('$chainId keeps $expected for $protocols with configured $version', ({ chainId, version, protocols, expected }) => {
    const invoke = jest.fn((_params: { Payload: string }) => ({ promise: () => Promise.resolve({}) }))
    const provider = Object.create(DynamoRouteCachingProvider.prototype)
    provider.lambdaClient = { invoke }
    provider.cachingQuoteLambdaName = 'test-only'
    const token = new Token(chainId, '0x1111111111111111111111111111111111111111', 18)
    provider.sendAsyncCachingRequest(new PairTradeTypeChainId({
      currencyIn: token.address,
      currencyOut: '0x2222222222222222222222222222222222222222',
      chainId, tradeType: TradeType.EXACT_INPUT,
    }), protocols, CurrencyAmount.fromRawAmount(token, '100'), [],
    version ? { universalRouterVersion: version } : undefined)
    expect(invoke).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(invoke.mock.calls[0][0].Payload)
    expect(payload.headers['x-universal-router-version']).toBe(expected)
  })
})
