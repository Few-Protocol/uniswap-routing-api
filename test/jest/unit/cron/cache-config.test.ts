import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { Protocol } from '@ring-protocol/router-sdk'
import { ChainId } from '@ring-protocol/sdk-core'
import {
  chainProtocols,
  fewV2SubgraphUrlOverride,
  MEGAETH_FEWV2_SUBGRAPH_URL,
  megaethFewV2TrackedEthThreshold,
} from '../../../../lib/cron/cache-config'

const originalMegaethFewV2Url = process.env.MEGAETH_FEWV2_SUBGRAPH_URL
const originalLegacyMegaethFewV2Url = process.env.GRAPH_FEWV2_SUBGRAPH_URL_MEGAETH

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe('cache-config', () => {
  beforeEach(() => {
    delete process.env.MEGAETH_FEWV2_SUBGRAPH_URL
    delete process.env.GRAPH_FEWV2_SUBGRAPH_URL_MEGAETH
  })

  afterAll(() => {
    restoreEnvVar('MEGAETH_FEWV2_SUBGRAPH_URL', originalMegaethFewV2Url)
    restoreEnvVar('GRAPH_FEWV2_SUBGRAPH_URL_MEGAETH', originalLegacyMegaethFewV2Url)
  })

  it('uses the deployed MegaETH FEWV2 Goldsky subgraph by default', () => {
    expect(fewV2SubgraphUrlOverride(ChainId.MEGAETH_MAINNET)).toBe(MEGAETH_FEWV2_SUBGRAPH_URL)
  })

  it('still allows the MegaETH FEWV2 subgraph URL to be overridden by env', () => {
    process.env.MEGAETH_FEWV2_SUBGRAPH_URL = 'https://example.com/megaeth-fewv2'

    expect(fewV2SubgraphUrlOverride(ChainId.MEGAETH_MAINNET)).toBe('https://example.com/megaeth-fewv2')
  })

  it('uses a MegaETH-specific FEWV2 tracked ETH threshold below the current pool liquidity', () => {
    const megaethFewV2Config = chainProtocols.find(
      (config) => config.chainId === ChainId.MEGAETH_MAINNET && config.protocol === Protocol.FEWV2
    )

    expect(megaethFewV2Config).toBeDefined()
    expect((megaethFewV2Config!.provider as any).trackedEthThreshold).toBe(megaethFewV2TrackedEthThreshold)
    expect(megaethFewV2TrackedEthThreshold).toBeLessThan(0.01)
  })
})
