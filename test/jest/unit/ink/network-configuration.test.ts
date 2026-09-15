import { ChainId } from '@ring-protocol/sdk-core'
import { Protocol } from '@ring-protocol/router-sdk'
import { FEW_V2_SUPPORTED_CHAIN_IDS, StaticV2SubgraphProvider, StaticV3SubgraphProvider, StaticV4SubgraphProvider } from '@ring-protocol/smart-order-router'
import { SUPPORTED_CHAINS } from '../../../../lib/handlers/injector-sor'
import { QuoteHandlerInjector } from '../../../../lib/handlers/quote/injector'
import { chainIdToNetworkName, generateProviderUrl } from '../../../../lib/rpc/utils'
import { DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB } from '../../../../lib/util/defaultBlocksToLiveRoutesDB'
import { NEW_CACHED_ROUTES_ROLLOUT_PERCENT } from '../../../../lib/util/newCachedRoutesRolloutPercent'
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN } from '../../../../lib/handlers/shared'

describe('Ink standard protocol configuration', () => {
  it('reuses the existing OP Stack search settings and leaves BSC defaults unchanged', () => {
    expect(DEFAULT_ROUTING_CONFIG_BY_CHAIN(ChainId.INK)).toEqual(DEFAULT_ROUTING_CONFIG_BY_CHAIN(ChainId.OPTIMISM))
    expect(DEFAULT_ROUTING_CONFIG_BY_CHAIN(ChainId.INK).distributionPercent).toBe(20)
    expect(DEFAULT_ROUTING_CONFIG_BY_CHAIN(ChainId.BNB).distributionPercent).toBe(5)
  })
  it('registers Ink without enabling FewV2 or changing existing chain membership', () => {
    expect(SUPPORTED_CHAINS).toContain(ChainId.INK)
    expect(FEW_V2_SUPPORTED_CHAIN_IDS).not.toContain(ChainId.INK)
    for (const chainId of [ChainId.BNB, ChainId.BASE, ChainId.ARBITRUM_ONE, ChainId.ROBINHOOD]) expect(SUPPORTED_CHAINS).toContain(chainId)
    expect(chainIdToNetworkName(ChainId.INK)).toBe('ink')
    expect(generateProviderUrl('ALCHEMY_57073', 'test-key', ChainId.INK)).toBe('https://ink-mainnet.g.alchemy.com/v2/test-key')
    expect(DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB[ChainId.INK]).toBe(60)
    expect(NEW_CACHED_ROUTES_ROLLOUT_PERCENT[ChainId.INK]).toBe(0)
  })
  it.each([[Protocol.V2, StaticV2SubgraphProvider], [Protocol.V3, StaticV3SubgraphProvider], [Protocol.V4, StaticV4SubgraphProvider]])('uses the existing %s chain reader without an index deployment', async (protocol, Provider) => {
    const injector = new QuoteHandlerInjector('ink-test')
    const provider = await (injector as any).instantiateSubgraphProvider(ChainId.INK, protocol, undefined, undefined, undefined)
    expect(provider).toBeInstanceOf(Provider)
  })
})
