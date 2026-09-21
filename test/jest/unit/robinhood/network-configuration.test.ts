import { ChainId } from '@ring-protocol/sdk-core'
import { Protocol } from '@ring-protocol/router-sdk'
import {
  StaticV2SubgraphProvider,
  StaticV3SubgraphProvider,
  StaticV4SubgraphProvider,
  V4SubgraphPool,
} from '@ring-protocol/smart-order-router'
import { UniGraphQLProvider } from '../../../../lib/graphql/graphql-provider'
import { QuoteHandlerInjector } from '../../../../lib/handlers/quote/injector'
import { RingV2AWSSubgraphProvider } from '../../../../lib/handlers/router-entities/aws-subgraph-provider'
import { chainProtocols } from '../../../../lib/cron/cache-config'
import { v4HooksPoolsFiltering } from '../../../../lib/util/v4HooksPoolsFiltering'

describe('network configuration', () => {
  test.each([
    [Protocol.V2, StaticV2SubgraphProvider],
    [Protocol.V3, StaticV3SubgraphProvider],
    [Protocol.V4, StaticV4SubgraphProvider],
  ])('uses the existing %s static provider without a Robinhood indexer', async (protocol, Provider) => {
    const injector = new QuoteHandlerInjector('network-configuration-test')
    const provider = await (injector as any).instantiateSubgraphProvider(
      ChainId.ROBINHOOD, protocol, undefined, undefined, undefined
    )
    expect(provider).toBeInstanceOf(Provider)
  })

  test.each([ChainId.BNB, ChainId.HYPER_MAINNET, ChainId.ROBINHOOD])(
    'uses the existing FewV2 cache provider on chain %s', async chainId => {
      const cached = new RingV2AWSSubgraphProvider(chainId, 'test-bucket', 'test-key')
      const eagerBuild = jest.spyOn(RingV2AWSSubgraphProvider, 'EagerBuild').mockResolvedValue(cached)
      try {
        const injector = new QuoteHandlerInjector('network-configuration-test')
        const provider = await (injector as any).instantiateSubgraphProvider(
          chainId, Protocol.FEWV2, 'test-bucket', 'test-key', undefined
        )
        expect(provider).toBe(cached)
        expect(eagerBuild).toHaveBeenCalledWith('test-bucket', 'test-key', chainId)
      } finally {
        eagerBuild.mockRestore()
      }
    }
  )

  test('keeps the Robinhood FewV2 index empty until its indexer is deployed', async () => {
    const source = chainProtocols.find(config => config.chainId === ChainId.ROBINHOOD && config.protocol === Protocol.FEWV2)
    expect(source).toBeDefined()
    expect(await source!.provider.getPools()).toEqual([])
  })

  test.each([
    [ChainId.BNB, 'BNB'],
    [ChainId.ROBINHOOD, 'ROBINHOOD'],
  ])('sends chain %s through the existing token-info GraphQL requests', async (chainId, chain) => {
    const previousUrl = process.env.GQL_URL
    const previousOrigin = process.env.GQL_H_ORGN
    process.env.GQL_URL = 'https://graphql.example.invalid'
    process.env.GQL_H_ORGN = 'https://example.invalid'
    try {
      const provider = new UniGraphQLProvider()
      const fetchData = jest.spyOn((provider as any).client, 'fetchData').mockResolvedValue({})
      const address = '0x0000000000000000000000000000000000000010'
      await provider.getTokenInfo(chainId as ChainId, address)
      expect(fetchData.mock.calls[0][1]).toEqual({ chain, address })
      await provider.getTokensInfo(chainId as ChainId, [address])
      expect(fetchData.mock.calls[1][1]).toEqual({ contracts: [{ chain, address }] })
      fetchData.mockRestore()
    } finally {
      if (previousUrl === undefined) delete process.env.GQL_URL
      else process.env.GQL_URL = previousUrl
      if (previousOrigin === undefined) delete process.env.GQL_H_ORGN
      else process.env.GQL_H_ORGN = previousOrigin
    }
  })

  test.each([ChainId.BNB, ChainId.HYPER_MAINNET, ChainId.ROBINHOOD])(
    'retains ordinary V4 pools and filters unapproved swap hooks on chain %s', chainId => {
      const pool: V4SubgraphPool = {
        id: 'ordinary-pool', feeTier: '500', tickSpacing: '10',
        hooks: '0x0000000000000000000000000000000000000000', liquidity: '1000',
        token0: { symbol: 'ETH', name: 'Ether', id: '0x0000000000000000000000000000000000000000', decimals: '18' },
        token1: { symbol: 'USD', name: 'Dollar', id: '0x0000000000000000000000000000000000000010', decimals: '6' },
        tvlETH: 1, tvlUSD: 2000,
      }
      const swapHook = { ...pool, id: 'unapproved-hook-pool', hooks: '0x0000000000000000000000000000000000000080' }
      const higherLiquidityPools = Array.from({ length: 11 }, (_, index) => ({
        ...pool, id: `higher-liquidity-${index}`, tickSpacing: String(index + 20), tvlETH: index + 2,
      }))
      const filtered = v4HooksPoolsFiltering(chainId, [pool, ...higherLiquidityPools, swapHook])
      // The zero-hook allowlist preserves ordinary pools even outside the top-TVL group.
      expect(filtered).toContainEqual(pool)
      expect(filtered).toHaveLength(12)
      expect(filtered).not.toContainEqual(swapHook)
    }
  )
})
