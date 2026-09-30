import { BigNumber } from 'ethers'
import { ChainId, CurrencyAmount, Token, TradeType } from '@ring-protocol/sdk-core'
import { Protocol } from '@ring-protocol/router-sdk'
import { Pair } from '@ring-protocol/v2-sdk'
import { Pair as FewPair } from '@ring-protocol/few-v2-sdk'
import { Pool as V3Pool } from '@ring-protocol/v3-sdk'
import { Pool as V4Pool } from '@ring-protocol/v4-sdk'
import { UNIVERSAL_ROUTER_VERSION } from '@ring-protocol/universal-router-sdk'
import { V4_ETH_WETH_FAKE_POOL } from '@ring-protocol/smart-order-router'
import { QuoteHandler } from '../../../../lib/handlers/quote/quote'

const chains = [ChainId.MAINNET, ChainId.BNB, ChainId.BASE, ChainId.ARBITRUM_ONE,
  ChainId.HYPER_MAINNET, ChainId.ROBINHOOD, ChainId.INK, ChainId.ARC]
const fewChains = [ChainId.MAINNET, ChainId.BNB, ChainId.HYPER_MAINNET, ChainId.ROBINHOOD]
const cases = chains.flatMap((chainId) => [Protocol.V2, Protocol.V3, Protocol.V4, Protocol.MIXED,
  ...(fewChains.includes(chainId) ? [Protocol.FEWV2] : [])]
  .flatMap((protocol) => ['exactIn', 'exactOut'].map((type) => ({ chainId, protocol, type }))))

function makePool(protocol: Protocol, a: Token, b: Token) {
  const reserve = (token: Token) => CurrencyAmount.fromRawAmount(token, '1000000000000000000000000')
  if (protocol === Protocol.V2) return new Pair(reserve(a), reserve(b))
  if (protocol === Protocol.FEWV2) return new FewPair(reserve(a), reserve(b))
  if (protocol === Protocol.V4) {
    return new V4Pool(a, b, 500, 10, '0x0000000000000000000000000000000000000000',
      '79228162514264337593543950336', '1000000000', 0)
  }
  return new V3Pool(a, b, 500, '79228162514264337593543950336', '1000000000', 0)
}

// Run the real quote handler and published SDK pool classes. Only the SOR quote,
// token lookup and pool-address provider responses are fixtures; no RPC/AWS calls.
describe('quote response amounts on existing and newly added networks', () => {
  it.each(cases)('$chainId $protocol $type preserves single, multihop and split amounts', async ({ chainId, protocol, type }) => {
    for (const reverse of [false, true]) {
      const tokenA = new Token(chainId, '0x1111111111111111111111111111111111111111', 6, 'A')
      const tokenB = new Token(chainId, '0x2222222222222222222222222222222222222222', 18, 'B')
      const intermediate = new Token(chainId, '0x3333333333333333333333333333333333333333', 6, 'C')
      const [input, output] = reverse ? [tokenB, tokenA] : [tokenA, tokenB]
      for (const layout of ['single', 'multihop', 'split']) {
        const expected = layout === 'split'
          ? [['400000000000000000', '1000001'], ['600000000000000000', '1500000']]
          : [['1000000000000000000', '2500001']]
        const path = layout === 'single' && protocol !== Protocol.MIXED
          ? [input, output] : [input, intermediate, output]
        const pools = path.slice(0, -1).map((token, i) => makePool(
          protocol === Protocol.MIXED ? (i === 0 ? (layout === 'split' ? Protocol.V4 : Protocol.V2) : Protocol.V3) : protocol,
          token, path[i + 1]
        ))
        const exactIn = type === 'exactIn'
        const amountCurrency = exactIn ? input : output
        const quoteCurrency = exactIn ? output : input
        const amountRaw = exactIn ? '1000000000000000000' : '2500001'
        const quoteRaw = exactIn ? '2500001' : '1000000000000000000'
        const subroutes = expected.map(([amountIn, amountOut], i) => ({
          protocol,
          percent: layout === 'split' ? (i === 0 ? 40 : 60) : 100,
          amount: CurrencyAmount.fromRawAmount(amountCurrency, exactIn ? amountIn : amountOut),
          quote: CurrencyAmount.fromRawAmount(quoteCurrency, exactIn ? amountOut : amountIn),
          tokenPath: path,
          route: { protocol, pairs: pools, pools, tokenPath: path, path, currencyPath: path },
        }))
        const quote = CurrencyAmount.fromRawAmount(quoteCurrency, quoteRaw)
        const gasCost = CurrencyAmount.fromRawAmount(quoteCurrency, '1')
        const router = { route: jest.fn().mockResolvedValue({
          quote, quoteGasAdjusted: quote, route: subroutes,
          estimatedGasUsed: BigNumber.from(10000000),
          estimatedGasUsedQuoteToken: gasCost, estimatedGasUsedUSD: gasCost,
          gasPriceWei: BigNumber.from(1), blockNumber: BigNumber.from(1234),
        }) }
        const handler = new QuoteHandler('amount-regression', Promise.resolve(undefined as any))
        const tokenListProvider = {
          getTokenByAddress: jest.fn(async (address: string) => [input, output].find(t => t.address === address)),
        }
        const poolAddress = '0x4444444444444444444444444444444444444444'
        const provider = { getPoolAddress: () => ({ poolAddress }), getPoolId: () => ({ poolId: '0x' + '44'.repeat(32) }) }
        const response = await (handler as any).handleRequestInternal({
          event: { headers: { 'x-universal-router-version': UNIVERSAL_ROUTER_VERSION(chainId) } },
          requestQueryParams: {
            tokenInAddress: input.address, tokenOutAddress: output.address,
            tokenInChainId: chainId, tokenOutChainId: chainId, amount: amountRaw, type,
            protocols: protocol === Protocol.MIXED ? ['v2', 'v3', 'mixed'] : [protocol.toLowerCase()],
          },
          requestInjected: {
            router, chainId, id: 'quote-regression', tokenListProvider,
            tokenProvider: { getTokens: jest.fn(() => { throw new Error('Unexpected RPC lookup') }) },
            v2PoolProvider: provider, fewV2PoolProvider: provider, v3PoolProvider: provider, v4PoolProvider: provider,
            metric: { putMetric: jest.fn() }, log: { info: jest.fn(), debug: jest.fn() },
          },
        }, Date.now())
        expect(response.statusCode).toBe(200)
        const body = JSON.parse(JSON.stringify(response.body))
        expect(body.amount).toBe(amountRaw)
        expect(body.quote).toBe(quoteRaw)
        expect(body.route).toHaveLength(expected.length)
        body.route.forEach((route: any[], i: number) => {
          expect(route).toHaveLength(pools.length)
          expect(route[0].amountIn).toBe(expected[i][0])
          expect(route[route.length - 1].amountOut).toBe(expected[i][1])
          expect(route[0].tokenIn.address).toBe(input.address)
          expect(route[route.length - 1].tokenOut.address).toBe(output.address)
          for (let hop = 0; hop < route.length; hop++) {
            if (hop > 0) expect(route[hop]).not.toHaveProperty('amountIn')
            if (hop < route.length - 1) expect(route[hop]).not.toHaveProperty('amountOut')
          }
        })
        expect(router.route.mock.calls[0][0].quotient.toString()).toBe(amountRaw)
        expect(router.route.mock.calls[0][2]).toBe(exactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT)
      }
    }
  })

  it('Arc has no synthetic wrapper pool; its real V4 pools must still serialize', () => {
    expect(V4_ETH_WETH_FAKE_POOL[ChainId.ARC]).toBeUndefined()
  })
})
